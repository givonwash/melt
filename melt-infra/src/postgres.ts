import { Helm } from "cdk8s";
import { Construct } from "constructs";
import { KubeService } from "../imports/k8s.js";
import { MeltChart, MeltChartProps } from "./chart.js";
import { MeltSecret, MeltSecretProps } from "./secrets.js";
import * as path from "node:path";

export const postgresAdminPasswordSecretKey = "adminPassword";
export const postgresMeltPasswordKey = "meltPassword";

interface MeltPostgresSecretProps extends MeltSecretProps {
  stringData: {
    [postgresAdminPasswordSecretKey]: string;
    [postgresMeltPasswordKey]: string;
  };
}

interface MeltPostgresChartProps extends MeltChartProps {
  database: string;
  meltUser: string;
  port?: number;
  secrets: MeltPostgresSecretProps;
}

export class MeltPostgresChart extends MeltChart {
  readonly database: string;
  readonly meltUser: string;
  readonly port: number;
  readonly secretName: string;

  constructor(scope: Construct, id: string, props: MeltPostgresChartProps) {
    super(scope, id, props);

    const { namespace } = this;
    const { database, meltUser, port, secrets } = props;

    this.database = database;
    this.meltUser = meltUser;
    this.port = port ?? 5432;
    this.secretName = secrets.name;

    const secret = new MeltSecret(this, "secret", props.secrets);

    const postgres = new Helm(this, "helm", {
      namespace,
      chart: path.join(import.meta.dirname, "../charts/postgresql-15.4.0.tgz"),
      // see: https://github.com/bitnami/charts/blob/postgresql/15.4.0/bitnami/postgresql/values.yaml
      values: {
        auth: {
          database: database,
          username: meltUser,
          existingSecret: secret.name,
          secretKeys: {
            adminPasswordKey: postgresAdminPasswordSecretKey,
            userPasswordKey: postgresMeltPasswordKey,
          },
        },
        global: { service: { ports: { postgresql: port } } },
      },
    });

    postgres.node.addDependency(secret);
  }

  get service(): KubeService {
    return this.getApiObject(
      (o) =>
        o.kind === "Service" && !Object.hasOwn(o.toJson() as object, "publishNotReadyAddresses"),
    ) as KubeService;
  }

  get hostname(): string {
    return `${this.service.name}.${this.namespace}.svc.cluster.local`;
  }
}

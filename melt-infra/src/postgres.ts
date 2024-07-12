/**
 * Functionality for generating Kubernetes manifests that "stand up" a Postgres database
 */

import { Helm } from "cdk8s";
import { Construct } from "constructs";
import { KubeService } from "../imports/k8s.js";
import { MeltChart, MeltChartProps } from "./chart.js";
import { MeltSecret, MeltSecretProps } from "./secrets.js";
import * as path from "node:path";

export const postgresAdminPasswordSecretKey = "adminPassword";
export const postgresMeltPasswordKey = "meltPassword";

// NOTE: `stringData` is added to `MeltSecretProps` to ensure that `MeltPostgresChart` (see below)
//       is guaranteed to have secrets to which the admin and user (`melt`) password keys are guaranteed
//       to be known at runtime
interface MeltPostgresSecretProps extends MeltSecretProps {
  stringData: {
    [postgresAdminPasswordSecretKey]: string;
    [postgresMeltPasswordKey]: string;
  };
}

interface MeltPostgresChartProps extends MeltChartProps {
  /**
   * The name of the database to be created inside an eventually "stood up" Postgres
   * service
   */
  database: string;
  /**
   * The username of the "regular" user to be created inside an eventually "stood up" Postgres
   * service
   */
  meltUser: string;
  /**
   * The port on which the Postgres database responds to requests
   */
  port?: number;
  secrets: MeltPostgresSecretProps;
}

/**
 * `Chart` to generate Kubernetes manifests needed to "stand up" a Postgres database
 */
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

    // NOTE: the below `Construct` ID of `secret` should not be changed unless the logic relying
    //       upon this ID existing in `MeltArgoWorkflows` (see src/argo-workflows/index.ts) is also
    //       changed
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

  /**
   * `KubeService` object belonging to _the_ Postgres service [1] stood up by bitnami/postgresql@15.4.0
   *
   * [1]: https://github.com/bitnami/charts/blob/postgresql/15.4.0/bitnami/postgresql/templates/primary/svc.yaml
   */
  get service(): KubeService {
    // NOTE: bitnami/postgresql@15.4.0 makes use of two `Service`s to make available a single
    //       Postgres database — a "headless" `Service` [1] and a non-"headless" `Service` [2]. Only
    //       the former is of interest in `melt-infra`'s use-case
    //
    // [1]: https://github.com/bitnami/charts/blob/postgresql/15.4.0/bitnami/postgresql/templates/primary/svc-headless.yaml
    // [2]: https://github.com/bitnami/charts/blob/postgresql/15.4.0/bitnami/postgresql/templates/primary/svc.yaml
    return this.getApiObject(
      (o) =>
        o.kind === "Service" && !Object.hasOwn(o.toJson() as object, "publishNotReadyAddresses"),
    ) as KubeService;
  }

  /**
   * The hostname at which the _eventually_ stood up Postgres database can be found (by other
   * `Pod`s on the same cluster)
   */
  get hostname(): string {
    return `${this.service.name}.${this.namespace}.svc.cluster.local`;
  }
}

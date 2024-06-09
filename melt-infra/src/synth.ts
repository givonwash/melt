import { App } from "cdk8s";
import yargs from "yargs";

import { MeltAirbyteChart } from "./airbyte.js";
import { MeltArgoWorkflows } from "./argo-workflows/index.js";
import { MeltNamespaceChart } from "./namespace.js";
import * as postgres from "./postgres.js";
import { MeltPostgresChart } from "./postgres.js";

function parseSynthArgs(args: string | readonly string[]) {
  return yargs(args)
    .env("MELT_SYNTH")
    .options({
      airbyteNamespace: { type: "string", demandOption: true },
      airbyteServerUrl: { type: "string", demandOption: true },

      argoNamespace: { type: "string", demandOption: true },

      postgresNamespace: { type: "string", demandOption: true },
      postgresDatabase: { type: "string", demandOption: true },
      postgresAdminPassword: { type: "string", demandOption: true },
      postgresMeltUser: { type: "string", demandOption: true },
      postgresMeltPassword: { type: "string", demandOption: true },
    })
    .help()
    .parseSync();
}

function main() {
  const app = new App();

  const args = parseSynthArgs(process.argv.slice(2));

  const airbyteNamespaceChart = new MeltNamespaceChart(app, "melt-airbyte-namespace", {
    name: args.airbyteNamespace,
  });

  const airbyteChart = new MeltAirbyteChart(app, "melt-airbyte", {
    namespaceChart: airbyteNamespaceChart,
    serverUrl: args.airbyteServerUrl,
  });

  const postgresNamespaceChart = new MeltNamespaceChart(app, "melt-postgres-namespace", {
    name: args.postgresNamespace,
  });

  const postgresChart = new MeltPostgresChart(app, "melt-postgres", {
    namespaceChart: postgresNamespaceChart,
    database: args.postgresDatabase,
    meltUser: args.postgresMeltUser,
    secrets: {
      namespace: postgresNamespaceChart.name,
      name: "melt-postgres-secret",
      stringData: {
        [postgres.postgresAdminPasswordSecretKey]: args.postgresAdminPassword,
        [postgres.postgresMeltPasswordKey]: args.postgresMeltPassword,
      },
    },
  });

  const argoNamespaceChart = new MeltNamespaceChart(app, "melt-argo-namespace", {
    name: args.argoNamespace,
  });

  new MeltArgoWorkflows(app, "melt-argo", {
    namespaceChart: argoNamespaceChart,
    airbyteChart,
    postgresChart,
  });

  app.synth();
}

main();

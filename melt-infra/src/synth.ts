/**
 * Entrypoints and tooling for generating Airbyte, Postgres, and Argo Workflows Kubernetes manifests
 * for "end-user" usage of `melt-infra`
 */

import { App } from "cdk8s";
import yargs from "yargs";

import { MeltAirbyteChart } from "./airbyte.js";
import { MeltArgoWorkflows } from "./argo-workflows/index.js";
import { MeltNamespaceChart } from "./namespace.js";
import * as postgres from "./postgres.js";
import { MeltPostgresChart } from "./postgres.js";

/**
 * Argument parser for variables needed to synthesize `melt-infra` Kubernetes manifests
 */
function parseSynthArgs(args: string | readonly string[]) {
  return yargs(args)
    .env("MELT_SYNTH")
    .options({
      airbyteNamespace: {
        type: "string",
        demandOption: true,
        describe: "The name of the namespace to store Airbyte resources in",
      },
      airbyteServerUrl: {
        type: "string",
        demandOption: true,
        describe: "The URL at which Airbyte's server should be accessible",
      },

      argoNamespace: {
        type: "string",
        demandOption: true,
        describe: "The name of the namespace to store Argo Workflows resources in",
      },

      postgresNamespace: {
        type: "string",
        demandOption: true,
        describe: "The name of the namespace to store Postgres resources in",
      },
      postgresDatabase: {
        type: "string",
        demandOption: true,
        describe: "The name of the database to create when initializing Postgres",
      },
      postgresAdminPassword: {
        type: "string",
        demandOption: true,
        describe: "The value of the admin user's password in the initialized Postgres database",
      },
      postgresMeltUser: {
        type: "string",
        demandOption: true,
        describe: 'The name of the "regular" user to create when initializing Postgres',
      },
      postgresMeltPassword: {
        type: "string",
        demandOption: true,
        describe:
          'The value of the "regular" user\'s password in the initialized Postgres database',
      },
    })
    .help()
    .parseSync();
}

/**
 * `melt-infra`'s entrypoint. Generate all needed Kubernetes manifests to make use of `melt`
 */
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

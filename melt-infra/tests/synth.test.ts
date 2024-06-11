import { Testing } from "cdk8s";
import { MeltArgoWorkflows } from "../src/argo-workflows/index.js";
import { MeltAirbyteChart } from "../src/airbyte.js";
import { MeltPostgresChart } from "../src/postgres.js";
import * as postgres from "../src/postgres.js";
import { MeltNamespaceChart } from "../src/namespace.js";

describe("Synthesis", () => {
  test("airbyte", () => {
    const app = Testing.app();

    const airbyteNamespaceChart = new MeltNamespaceChart(app, "melt-airbyte-namespace", {
      name: "melt-airbyte-namespace",
    });
    const airbyteChart = new MeltAirbyteChart(app, "melt-airbyte", {
      namespaceChart: airbyteNamespaceChart,
      serverUrl: "http://localhost",
    });

    const airbyteChartResults = Testing.synth(airbyteChart);
    expect(airbyteChartResults).toMatchSnapshot();
  });

  test("postgresNamespace", () => {
    const app = Testing.app();

    const postgresNamespaceChart = new MeltNamespaceChart(app, "melt-postgres-namespace", {
      name: "melt-postgres-namespace",
    });

    const postgresNamespaceChartResults = Testing.synth(postgresNamespaceChart);
    expect(postgresNamespaceChartResults).toMatchSnapshot();
  });

  test("postgres", () => {
    const app = Testing.app();

    const postgresNamespaceChart = new MeltNamespaceChart(app, "melt-postgres-namespace", {
      name: "melt-postgres-namespace",
    });
    const postgresChart = new MeltPostgresChart(app, "melt-postgres", {
      namespaceChart: postgresNamespaceChart,
      database: "database",
      meltUser: "melt",
      secrets: {
        namespace: "kube-system",
        name: "melt-postgres-secret",
        stringData: {
          [postgres.postgresAdminPasswordSecretKey]: "admin-password",
          [postgres.postgresMeltPasswordKey]: "melt-password",
        },
      },
    });

    const postgresChartResults = Testing.synth(postgresChart);
    expect(postgresChartResults).toMatchSnapshot();
  });

  test("argoWorkflowsNamespace", () => {
    const app = Testing.app();

    const argoWorkflowsNamespaceChart = new MeltNamespaceChart(app, "melt-argo-namespace", {
      name: "melt-argo",
    });

    const argoWorkflowsNamespaceChartResults = Testing.synth(argoWorkflowsNamespaceChart);
    expect(argoWorkflowsNamespaceChartResults).toMatchSnapshot();
  });

  test("argoWorkflows", () => {
    const app = Testing.app();

    const argoWorkflowsNamespaceChart = new MeltNamespaceChart(app, "melt-argo-namespace", {
      name: "melt-argo",
    });
    const argoWorkflowsChart = new MeltArgoWorkflows(app, "melt-argo", {
      namespaceChart: argoWorkflowsNamespaceChart,
      airbyteChart: new MeltAirbyteChart(app, "melt-airbyte", {
        namespaceChart: new MeltNamespaceChart(app, "melt-airbyte-namespace", {
          name: "melt-airbyte-namespace",
        }),
        serverUrl: "http://localhost",
      }),
      postgresChart: new MeltPostgresChart(app, "melt-postgres", {
        namespaceChart: new MeltNamespaceChart(app, "melt-postgres-namespace", {
          name: "melt-postgres-namespace",
        }),
        database: "database",
        meltUser: "melt",
        secrets: {
          namespace: "kube-system",
          name: "melt-postgres-secret",
          stringData: {
            [postgres.postgresAdminPasswordSecretKey]: "admin-password",
            [postgres.postgresMeltPasswordKey]: "melt-password",
          },
        },
      }),
    });

    const argoWorkflowsChartResults = Testing.synth(argoWorkflowsChart);
    expect(argoWorkflowsChartResults).toMatchSnapshot();
  });
});

import { ApiObject, Helm } from "cdk8s";
import { Construct } from "constructs";
import { MeltChart, MeltChartProps } from "./chart.js";

interface MeltAirbyteChartProps extends MeltChartProps {
  serverUrl: string;
}

export class MeltAirbyteChart extends MeltChart {
  constructor(scope: Construct, id: string, props: MeltAirbyteChartProps) {
    super(scope, id, props);

    const { namespace } = this;
    new Helm(this, `helm`, {
      namespace,
      chart: "airbyte",
      repo: "https://airbytehq.github.io/helm-charts",
      version: "0.86.3",
      // see: https://github.com/airbytehq/airbyte-platform/blob/e45277b1bd352f52bceb4eaa674d78b9aa09447a/charts/airbyte/values.yaml
      values: {
        global: { airbyteUrl: props.serverUrl },
      },
    });
  }

  get apiServerService(): ApiObject {
    return this.getApiObject(
      (o) =>
        o.kind === "Service" &&
        o.metadata.getLabel("app.kubernetes.io/name") == "airbyte-api-server",
    );
  }

  get apiServerHostname(): string {
    return `${this.apiServerService.name}.${this.namespace}.svc.cluster.local`;
  }
}

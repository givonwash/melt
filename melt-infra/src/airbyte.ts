/**
 * Functionality for generating Kubernetes manifests that "stand up" Airbyte
 */

import { ApiObject, Helm } from "cdk8s";
import { Construct } from "constructs";
import { MeltChart, MeltChartProps } from "./chart.js";
import * as path from "node:path";

// NOTE: `serverUrl` is added to `MeltSecretProps` to ensure that `MeltAirbyteChart` (see below)
//       is guaranteed to have a "synth"-time-provided value to `.global.airbyteUrl` [1]
//
//       [1]: https://github.com/airbytehq/airbyte-platform/blob/e45277b1bd352f52bceb4eaa674d78b9aa09447a/charts/airbyte/values.yaml#L21-L22
interface MeltAirbyteChartProps extends MeltChartProps {
  serverUrl: string;
}

/**
 * `Chart` to generate Kubernetes manifests needed to "stand up" Airbyte's motley of services
 */
export class MeltAirbyteChart extends MeltChart {
  constructor(scope: Construct, id: string, props: MeltAirbyteChartProps) {
    super(scope, id, props);

    const { namespace } = this;
    new Helm(this, `helm`, {
      namespace,
      chart: path.join(import.meta.dirname, "../charts/airbyte-0.86.3.tgz"),
      // see: https://github.com/airbytehq/airbyte-platform/blob/e45277b1bd352f52bceb4eaa674d78b9aa09447a/charts/airbyte/values.yaml
      values: {
        global: { airbyteUrl: props.serverUrl },
      },
    });
  }

  /**
   * The `Service` behind which Airbyte's API server can be interacted with
   */
  get apiServerService(): ApiObject {
    return this.getApiObject(
      (o) =>
        o.kind === "Service" &&
        o.metadata.getLabel("app.kubernetes.io/name") == "airbyte-api-server",
    );
  }

  /**
   * The hostname of the `Service` behind which Airbyte's API server can be interacted with (by
   * other `Pod`s on the same cluster)
   */
  get apiServerHostname(): string {
    return `${this.apiServerService.name}.${this.namespace}.svc.cluster.local`;
  }
}

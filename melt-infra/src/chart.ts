/**
 * Functionality for creating `cdk8s` `Chart`s
 */
import { ApiObject, Chart, ChartProps } from "cdk8s";
import { Construct } from "constructs";
import { MeltNamespaceChart } from "./namespace.js";

/**
 * `ChartProps` where specifying `namespace` is non-optional
 */
export interface MeltChartProps extends ChartProps {
  readonly namespaceChart: MeltNamespaceChart;
}

/**
 * Base `Chart` class upon which (most) `melt` `Chart`s should be extended
 *
 * `MeltChart` requires a `Namespace` to exist ahead of time and provides some QoL tooling
 */
export class MeltChart extends Chart {
  readonly namespace: string;

  constructor(scope: Construct, id: string, props: MeltChartProps) {
    super(scope, id, props);

    const { namespaceChart } = props;
    this.addDependency(namespaceChart);

    this.namespace = namespaceChart.name;
  }

  /**
   * Get an `ApiObject` of interest from the `Chart`s `Construct` tree
   *
   * @param predicate The "predicate" used to find the `ApiObject` of interest
   */
  getApiObject(predicate: (o: ApiObject) => boolean): ApiObject {
    const found = this.node
      .findAll()
      .filter((c) => c instanceof ApiObject && predicate(c))
      .pop() as ApiObject | undefined;

    if (typeof found == "undefined") {
      throw new Error("Unable to identify ApiObject of interest");
    } else {
      return found;
    }
  }
}

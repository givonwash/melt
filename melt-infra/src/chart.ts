import { ApiObject, Chart, ChartProps } from "cdk8s";
import { Construct } from "constructs";
import { MeltNamespaceChart } from "./namespace.js";

/**
 * `ChartProps` where specifying `namespace` is non-optional
 */
export interface MeltChartProps extends ChartProps {
  readonly namespaceChart: MeltNamespaceChart;
}

export class MeltChart extends Chart {
  readonly namespace: string;

  constructor(scope: Construct, id: string, props: MeltChartProps) {
    super(scope, id, props);

    const { namespaceChart } = props;
    this.addDependency(namespaceChart);

    this.namespace = namespaceChart.name;
  }

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

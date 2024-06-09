import { Chart, ChartProps } from "cdk8s";
import { Construct } from "constructs";
import { KubeNamespace } from "../imports/k8s.js";

interface MeltNamespaceChartProps extends ChartProps {
  name: string;
}

export class MeltNamespaceChart extends Chart {
  readonly name: string;

  constructor(scope: Construct, id: string, props: MeltNamespaceChartProps) {
    super(scope, id, props);

    const { name } = props;

    this.name = name;

    new KubeNamespace(this, `namespace`, {
      metadata: { name },
    });
  }
}

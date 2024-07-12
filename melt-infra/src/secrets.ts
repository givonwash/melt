/**
 * Functionality for creating Kubernetes `Secret`s
 */
import { Construct } from "constructs";
import { KubeSecret } from "../imports/k8s.js";

export interface MeltSecretProps {
  name: string;
  namespace: string;
  stringData: { [key: string]: string };
}

export class MeltSecret extends Construct {
  readonly name: string;
  readonly namespace: string;
  readonly stringData: { [key: string]: string };

  constructor(scope: Construct, id: string, props: MeltSecretProps) {
    super(scope, id);

    const { name, namespace, stringData } = props;

    this.name = name;
    this.namespace = namespace;
    this.stringData = stringData;

    new KubeSecret(this, "Default", {
      metadata: { name, namespace },
      stringData: stringData,
    });
  }
}

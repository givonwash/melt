import { Construct } from "constructs";

export interface MeltWorkflowTemplateProps {
  namespace: string;
  serviceAccountName: string;
}

export class MeltWorkflowTemplate extends Construct {
  static readonly templateName: string;
  readonly namespace: string;
  readonly serviceAccountName: string;

  constructor(
    scope: Construct,
    id: string,
    { namespace, serviceAccountName }: MeltWorkflowTemplateProps,
  ) {
    super(scope, id);
    this.namespace = namespace;
    this.serviceAccountName = serviceAccountName;
  }
}

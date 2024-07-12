/**
 * Functionality for generating `WorkflowTemplate`s [1]
 *
 * [1]: https://argo-workflows.readthedocs.io/en/latest/workflow-templates/
 */
import { Construct } from "constructs";

export interface MeltWorkflowTemplateProps {
  namespace: string;
  serviceAccountName: string;
}

/**
 * Base `WorkflowTemplate` other `WorkflowTemplate`s in `melt-infra` should extend from
 *
 * Requires a `Namespace` be provided and a `ServiceAccount` to exist
 */
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

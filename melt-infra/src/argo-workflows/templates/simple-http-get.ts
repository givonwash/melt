import { IntOrString } from "../../../imports/k8s.js";
import { Construct } from "constructs";
import { MeltWorkflowTemplate, MeltWorkflowTemplateProps } from "./index.js";
import { WorkflowTemplate } from "../../../imports/workflowTemplates-argoproj.io.js";

export class MeltSimpleHttpGetRequest extends MeltWorkflowTemplate {
  static readonly templateName = "simple-http-get-request";

  constructor(scope: Construct, id: string, props: MeltWorkflowTemplateProps) {
    super(scope, id, props);

    const { namespace, serviceAccountName } = props;

    new WorkflowTemplate(this, "Default", {
      metadata: { namespace },
      spec: {
        templates: [
          {
            name: MeltSimpleHttpGetRequest.templateName,
            serviceAccountName,
            inputs: {
              parameters: [
                { name: "url" },
                { name: "retryBackoffDuration", value: "60s" },
                { name: "retryBackoffFactor", value: "2" },
                { name: "retryBackoffMaxDuration", value: "10m" },
                { name: "retryLimit", value: "3" },
                { name: "successCondition", value: "response.statusCode == 200" },
              ],
            },
            http: {
              url: "{{inputs.parameters.url}}",
              method: "GET",
              successCondition: "{{inputs.parameters.successCondition}}",
            },
            retryStrategy: {
              backoff: {
                duration: "{{inputs.parameters.retryBackoffDuration}}",
                factor: IntOrString.fromString("{{inputs.parameters.retryBackoffFactor}}"),
                maxDuration: "{{inputs.parameters.retryBackoffMaxDuration}}",
              },
              limit: IntOrString.fromString("{{inputs.parameters.retryLimit}}"),
            },
          },
        ],
      },
    });
  }
}

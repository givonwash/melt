import { Construct } from "constructs";
import { MeltWorkflowTemplate, MeltWorkflowTemplateProps } from "./index.js";
import { WorkflowTemplate } from "../../../imports/workflowTemplates-argoproj.io.js";

export class MeltJsonHttpPostRequest extends MeltWorkflowTemplate {
  static readonly templateName = "json-http-post-request";

  constructor(scope: Construct, id: string, props: MeltWorkflowTemplateProps) {
    super(scope, id, props);
    const { namespace, serviceAccountName } = props;
    const { templateName } = MeltJsonHttpPostRequest;

    new WorkflowTemplate(this, "Default", {
      metadata: { namespace },
      spec: {
        templates: [
          {
            name: templateName,
            serviceAccountName,
            inputs: {
              parameters: [
                { name: "url" },
                { name: "requestBody" },
                { name: "successCondition", value: "response.statusCode == 200" },
              ],
            },
            script: {
              image: "curlimages/curl:8.8.0",
              command: ["sh"],
              source: [
                "curl",
                "--fail",
                "--show-error",
                "--silent",
                "--location",
                "--json",
                '"$BODY"',
                '"$URL"',
              ].join(" "),
              env: [
                { name: "BODY", value: "{{inputs.parameters.requestBody}}" },
                { name: "URL", value: "{{inputs.parameters.url}}" },
              ],
            },
          },
        ],
      },
    });
  }
}

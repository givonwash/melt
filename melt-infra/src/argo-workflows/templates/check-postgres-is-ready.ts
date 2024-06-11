import { IntOrString } from "../../../imports/k8s.js";
import { Construct } from "constructs";
import { MeltWorkflowTemplate, MeltWorkflowTemplateProps } from "./index.js";
import { WorkflowTemplate } from "../../../imports/workflowTemplates-argoproj.io.js";

export class MeltCheckPostgresIsReady extends MeltWorkflowTemplate {
  static readonly templateName = "check-postgres-is-ready";

  constructor(scope: Construct, id: string, props: MeltWorkflowTemplateProps) {
    super(scope, id, props);

    const { namespace, serviceAccountName } = props;

    new WorkflowTemplate(this, "Default", {
      metadata: { namespace },
      spec: {
        templates: [
          {
            name: MeltCheckPostgresIsReady.templateName,
            serviceAccountName,
            inputs: {
              parameters: [
                { name: "database" },
                { name: "hostname" },
                { name: "passwordSecret" },
                { name: "passwordSecretKey" },
                { name: "port" },
                { name: "username" },

                { name: "retryBackoffDuration", value: "60s" },
                { name: "retryBackoffFactor", value: "2" },
                { name: "retryLimit", value: "3" },
              ],
            },
            container: {
              image: "postgres:16.3",
              command: ["pg_isready"],
              args: [
                "--dbname",
                "{{inputs.parameters.database}}",
                "--host",
                "{{inputs.parameters.hostname}}",
                "--port",
                "{{inputs.parameters.port}}",
                "--username",
                "{{inputs.parameters.username}}",
              ],
              env: [
                {
                  name: "PGPASSWORD",
                  valueFrom: {
                    secretKeyRef: {
                      name: "{{inputs.parameters.passwordSecret}}",
                      key: "{{inputs.parameters.passwordSecretKey}}",
                    },
                  },
                },
              ],
            },
            retryStrategy: {
              backoff: {
                duration: "{{inputs.parameters.retryBackoffDuration}}",
                factor: IntOrString.fromString("{{inputs.parameters.retryBackoffFactor}}"),
              },
              limit: IntOrString.fromString("{{inputs.parameters.retryLimit}}"),
            },
          },
        ],
      },
    });
  }
}

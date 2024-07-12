/**
 * Functionality for generating Kubernetes manifests that provide Argo Workflows`TemplateWorkflow`s
 * that execute `dbt build --select +marts` from within the `melt-dbt` DBT project
 */
import { Construct } from "constructs";
import { MeltWorkflowTemplate, MeltWorkflowTemplateProps } from "./index.js";
import { WorkflowTemplate } from "../../../imports/workflowTemplates-argoproj.io.js";

/**
 * `WorkflowTemplate` that builds all "marts" [1] in the `melt-dbt` DBT project
 *
 * [1]: https://docs.getdbt.com/best-practices/how-we-structure/4-marts
 */
export class MeltDbtBuildMarts extends MeltWorkflowTemplate {
  static readonly templateName = "melt-dbt-build-marts";

  constructor(scope: Construct, id: string, props: MeltWorkflowTemplateProps) {
    super(scope, id, props);
    const { namespace, serviceAccountName } = props;
    const { templateName } = MeltDbtBuildMarts;

    new WorkflowTemplate(this, "Default", {
      metadata: { namespace },
      spec: {
        templates: [
          {
            name: templateName,
            serviceAccountName,
            inputs: {
              parameters: [
                { name: "meltDbtImageTag" },
                { name: "database" },
                { name: "hostname" },
                { name: "port" },
                { name: "username" },
                { name: "passwordSecret" },
                { name: "passwordSecretKey" },
                { name: "profileTarget", value: "production" },
                { name: "threadCount", value: "2" },
                { name: "fakerSourceSchema" },
              ],
            },
            container: {
              image: "givonwash/melt-dbt:{{inputs.parameters.meltDbtImageTag}}",
              args: ["build", "--select", "+marts"],
              env: [
                {
                  name: "DBT_DBNAME",
                  value: "{{inputs.parameters.database}}",
                },
                {
                  name: "DBT_HOST",
                  value: "{{inputs.parameters.hostname}}",
                },
                {
                  name: "DBT_PORT",
                  value: "{{inputs.parameters.port}}",
                },
                {
                  name: "DBT_USER",
                  value: "{{inputs.parameters.username}}",
                },
                {
                  name: "DBT_PASSWORD",
                  valueFrom: {
                    secretKeyRef: {
                      name: "{{inputs.parameters.passwordSecret}}",
                      key: "{{inputs.parameters.passwordSecretKey}}",
                    },
                  },
                },
                {
                  name: "DBT_TARGET",
                  value: "{{inputs.parameters.profileTarget}}",
                },
                {
                  name: "DBT_THREAD_COUNT",
                  value: "{{inputs.parameters.threadCount}}",
                },
                {
                  name: "DBT_FAKER_SOURCE_SCHEMA",
                  value: "{{inputs.parameters.fakerSourceSchema}}",
                },
              ],
            },
          },
        ],
      },
    });
  }
}

import { ApiObject, Helm } from "cdk8s";
import { ApiResource, Role, ServiceAccount } from "cdk8s-plus-29";
import { Construct } from "constructs";
import * as path from "node:path";
import { MeltSecret } from "../secrets.js";
import { CronWorkflow } from "../../imports/cronWorkflows-argoproj.io.js";
import { KubeSecret } from "../../imports/k8s.js";
import { Workflow } from "../../imports/workflows-argoproj.io.js";
import { WorkflowTemplate } from "../../imports/workflowTemplates-argoproj.io.js";
import { MeltAirbyteChart } from "../airbyte.js";
import { MeltChart, MeltChartProps } from "../chart.js";
import * as postgres from "../postgres.js";
import * as utils from "../utils.js";
import { MeltPostgresChart } from "../postgres.js";
import { MeltCheckPostgresIsReady } from "./templates/check-postgres-is-ready.js";
import { MeltJsonHttpPostRequest } from "./templates/json-http-post-request.js";
import { MeltSimpleHttpGetRequest } from "./templates/simple-http-get.js";
import {
  MeltCheckHttpGetJsonOrHttpPostJson,
  MeltCheckHttpGetJsonOrHttpPostJsonWithPatchedSecrets,
} from "./templates/check-http-get-json-or-http-post-json.js";

interface MeltArgoChartProps extends MeltChartProps {
  airbyteChart: MeltAirbyteChart;
  postgresChart: MeltPostgresChart;
}

export class MeltArgoWorkflows extends MeltChart {
  constructor(scope: Construct, id: string, props: MeltArgoChartProps) {
    super(scope, id, props);

    const { namespace } = this;
    const { airbyteChart, postgresChart } = props;

    this.addDependency(airbyteChart, postgresChart);

    const workflowExecutorServiceAccount = new ServiceAccount(this, "executor-service-account", {
      metadata: { namespace },
      automountToken: true,
    });

    const workflowExecutorServiceAccountSecret = new KubeSecret(
      this,
      "executor-service-account-secret",
      {
        metadata: {
          namespace,
          name: `${workflowExecutorServiceAccount.name}.service-account-token`,
          annotations: {
            "kubernetes.io/service-account.name": workflowExecutorServiceAccount.name,
          },
        },
        type: "kubernetes.io/service-account-token",
      },
    );

    workflowExecutorServiceAccountSecret.node.addDependency(workflowExecutorServiceAccount);

    const argoWorkflows = new Helm(this, "helm", {
      namespace,
      chart: path.join(import.meta.dirname, "../../charts/argo-workflows-0.41.6.tgz"),
      // see: https://github.com/argoproj/argo-helm/blob/argo-workflows-0.41.6/charts/argo-workflows/values.yaml
      values: {
        images: { pullPolicy: "IfNotPresent" },
        singleNamespace: true,
        workflow: {
          serviceAccount: {
            name: workflowExecutorServiceAccount.name,
          },
        },
      },
    });

    argoWorkflows.node.addDependency(workflowExecutorServiceAccount);

    const postgresChartMeltSecret = postgresChart.node.findChild("secret") as MeltSecret;
    const postgresSecret = new MeltSecret(this, "postgres-secret", {
      namespace,
      name: postgresChartMeltSecret.name,
      stringData: postgresChartMeltSecret.stringData,
    });

    const checkPostgresIsReady = new MeltCheckPostgresIsReady(this, "check-postgres-is-ready", {
      namespace,
      serviceAccountName: workflowExecutorServiceAccount.name,
    });

    const makeSimpleHttpGetRequest = new MeltSimpleHttpGetRequest(
      this,
      "make-simple-http-get-request",
      { namespace, serviceAccountName: workflowExecutorServiceAccount.name },
    );

    const makeSimpleJsonHttpPostRequest = new MeltJsonHttpPostRequest(
      this,
      "make-json-http-post-request",
      { namespace, serviceAccountName: workflowExecutorServiceAccount.name },
    );

    const checkHttpGetJsonOrHttpPostJson = new MeltCheckHttpGetJsonOrHttpPostJson(
      this,
      "check-http-get-json-or-http-post-json",
      {
        namespace,
        serviceAccountName: workflowExecutorServiceAccount.name,
      },
    );

    const checkHttpGetJsonOrHttpPostJsonWithPatchedSecrets =
      new MeltCheckHttpGetJsonOrHttpPostJsonWithPatchedSecrets(
        this,
        "check-http-get-json-or-http-post-json-with-patched-secrets",
        {
          namespace,
          serviceAccountName: workflowExecutorServiceAccount.name,
        },
      );

    const eltWorkflow = new CronWorkflow(this, "elt-workflow", {
      metadata: { namespace },
      spec: {
        concurrencyPolicy: "Forbid",
        timezone: "UTC",
        schedule: "0 */2 * * *",
        workflowSpec: {
          serviceAccountName: workflowExecutorServiceAccount.name,
          entrypoint: "main",
          templates: [
            {
              name: "main",
              inputs: {
                parameters: [
                  {
                    name: "airbyteApiServerBaseUrl",
                    value: `http://${airbyteChart.apiServerHostname}`,
                  },
                  { name: "airbyteWorkspaceName", value: "melt" },

                  { name: "airbyteFakerSourceCount", value: "1000" },
                  { name: "airbyteFakerSourceName", value: "faker" },
                  { name: "airbyteFakerToPostgresConnectionName", value: "faker-to-postgres" },
                  { name: "airbyteFakerToPostgresDestinationSchema", value: "faker" },
                  { name: "airbyteFakerToPostgresJobRetryLimit", value: "10" },
                  { name: "airbytePostgresDestinationName", value: "postgres" },
                  { name: "airbytePostgresDestinationSslMode", value: "prefer" },

                  { name: "postgresDatabase", value: postgresChart.database },
                  { name: "postgresDefaultSchema", value: "public" },
                  { name: "postgresHostname", value: postgresChart.hostname },
                  { name: "postgresPasswordSecret", value: postgresChart.secretName },
                  { name: "postgresPasswordSecretKey", value: postgres.postgresMeltPasswordKey },
                  { name: "postgresPort", value: postgresChart.port.toString() },
                  { name: "postgresUsername", value: postgresChart.meltUser },
                ],
              },
              dag: {
                tasks: [
                  {
                    name: "ensure-postgres-is-ready",
                    templateRef: {
                      name: ApiObject.of(checkPostgresIsReady).name,
                      template: MeltCheckPostgresIsReady.templateName,
                    },
                    arguments: {
                      parameters: [
                        { name: "database", value: "{{inputs.parameters.postgresDatabase}}" },
                        { name: "hostname", value: "{{inputs.parameters.postgresHostname}}" },
                        {
                          name: "passwordSecret",
                          value: "{{inputs.parameters.postgresPasswordSecret}}",
                        },
                        {
                          name: "passwordSecretKey",
                          value: "{{inputs.parameters.postgresPasswordSecretKey}}",
                        },
                        { name: "port", value: "{{inputs.parameters.postgresPort}}" },
                        { name: "username", value: "{{inputs.parameters.postgresUsername}}" },
                      ],
                    },
                  },
                  {
                    name: "ensure-airbyte-is-ready",
                    templateRef: {
                      name: ApiObject.of(makeSimpleHttpGetRequest).name,
                      template: MeltSimpleHttpGetRequest.templateName,
                    },
                    arguments: {
                      parameters: [
                        {
                          name: "url",
                          value: "{{inputs.parameters.airbyteApiServerBaseUrl}}/health",
                        },
                      ],
                    },
                  },
                  {
                    name: "define-airbyte-workspace",
                    templateRef: {
                      name: ApiObject.of(checkHttpGetJsonOrHttpPostJson).name,
                      template: MeltCheckHttpGetJsonOrHttpPostJson.templateName,
                    },
                    dependencies: ["ensure-airbyte-is-ready"],
                    arguments: {
                      parameters: [
                        {
                          name: "urlToGet",
                          value: "{{inputs.parameters.airbyteApiServerBaseUrl}}/v1/workspaces",
                        },
                        {
                          name: "getResponseCheckPath",
                          value: JSON.stringify([
                            "data",
                            {
                              filterByKey: {
                                key: "name",
                                value: "{{inputs.parameters.airbyteWorkspaceName}}",
                              },
                            },
                          ]),
                        },
                        {
                          name: "getResponseReturnValuePath",
                          value: JSON.stringify([
                            "data",
                            {
                              filterByKey: {
                                key: "name",
                                value: "{{inputs.parameters.airbyteWorkspaceName}}",
                              },
                            },
                            "0",
                            "workspaceId",
                          ]),
                        },
                        {
                          name: "getResponseFailedValue",
                          value: JSON.stringify([]),
                        },
                        {
                          name: "urlToPost",
                          value: "{{inputs.parameters.airbyteApiServerBaseUrl}}/v1/workspaces",
                        },
                        {
                          name: "payloadToPost",
                          value: JSON.stringify({
                            name: "{{inputs.parameters.airbyteWorkspaceName}}",
                          }),
                        },
                        {
                          name: "postResponseReturnValuePath",
                          value: JSON.stringify(["workspaceId"]),
                        },
                      ],
                    },
                  },
                  {
                    name: "define-faker-source",
                    templateRef: {
                      name: ApiObject.of(checkHttpGetJsonOrHttpPostJson).name,
                      template: MeltCheckHttpGetJsonOrHttpPostJson.templateName,
                    },
                    dependencies: ["define-airbyte-workspace"],
                    arguments: {
                      parameters: [
                        {
                          name: "urlToGet",
                          value: "{{inputs.parameters.airbyteApiServerBaseUrl}}/v1/sources",
                        },
                        {
                          name: "getResponseCheckPath",
                          value: JSON.stringify([
                            "data",
                            {
                              filterByKey: {
                                key: "name",
                                value: "{{inputs.parameters.airbyteFakerSourceName}}",
                              },
                            },
                          ]),
                        },
                        {
                          name: "getResponseReturnValuePath",
                          value: JSON.stringify([
                            "data",
                            {
                              filterByKey: {
                                key: "name",
                                value: "{{inputs.parameters.airbyteFakerSourceName}}",
                              },
                            },
                            "0",
                            "sourceId",
                          ]),
                        },
                        {
                          name: "getResponseFailedValue",
                          value: JSON.stringify([]),
                        },
                        {
                          name: "urlToPost",
                          value: "{{inputs.parameters.airbyteApiServerBaseUrl}}/v1/sources",
                        },
                        {
                          name: "payloadToPost",
                          // NOTE: `JSON.stringify` not used here as `.configuration.count` must be a
                          //       non-"stringified" integer
                          value: `{
                            "name": "{{inputs.parameters.airbyteFakerSourceName}}",
                            "workspaceId": "{{=tasks['define-airbyte-workspace'].outputs.result}}",
                            "configuration": {
                              "sourceType": "faker",
                              "count": {{inputs.parameters.airbyteFakerSourceCount}}
                            }
                          }`,
                        },
                        {
                          name: "postResponseReturnValuePath",
                          value: JSON.stringify(["sourceId"]),
                        },
                      ],
                    },
                  },
                  {
                    name: "define-postgres-destination",
                    templateRef: {
                      name: ApiObject.of(checkHttpGetJsonOrHttpPostJsonWithPatchedSecrets).name,
                      template: MeltCheckHttpGetJsonOrHttpPostJsonWithPatchedSecrets.templateName,
                    },
                    dependencies: ["ensure-postgres-is-ready", "define-airbyte-workspace"],
                    arguments: {
                      parameters: [
                        {
                          name: "urlToGet",
                          value: "{{inputs.parameters.airbyteApiServerBaseUrl}}/v1/destinations",
                        },
                        {
                          name: "getResponseCheckPath",
                          value: JSON.stringify([
                            "data",
                            {
                              filterByKey: {
                                key: "name",
                                value: "{{inputs.parameters.airbytePostgresDestinationName}}",
                              },
                            },
                          ]),
                        },
                        {
                          name: "getResponseReturnValuePath",
                          value: JSON.stringify([
                            "data",
                            {
                              filterByKey: {
                                key: "name",
                                value: "{{inputs.parameters.airbytePostgresDestinationName}}",
                              },
                            },
                            "0",
                            "destinationId",
                          ]),
                        },
                        {
                          name: "getResponseFailedValue",
                          value: JSON.stringify([]),
                        },
                        {
                          name: "urlToPost",
                          value: "{{inputs.parameters.airbyteApiServerBaseUrl}}/v1/destinations",
                        },
                        {
                          name: "payloadToPost",
                          // NOTE: `JSON.stringify` not used here as `.configuration.port` must be a
                          //       non-"stringified" integer
                          value: `{
                            "name": "{{inputs.parameters.airbytePostgresDestinationName}}",
                            "workspaceId": "{{=tasks['define-airbyte-workspace'].outputs.result}}",
                            "configuration": {
                              "destinationType": "postgres",
                              "ssl_mode": { "mode": "{{inputs.parameters.airbytePostgresDestinationSslMode}}" },
                              "database": "{{inputs.parameters.postgresDatabase}}",
                              "schema": "{{inputs.parameters.postgresDefaultSchema}}",
                              "host": "{{inputs.parameters.postgresHostname}}",
                              "port": {{inputs.parameters.postgresPort}},
                              "username": "{{inputs.parameters.postgresUsername}}",
                              "password": null
                            }
                          }`,
                        },
                        {
                          name: "patchPathForPayloadToPost",
                          value: JSON.stringify(["configuration", "password"]),
                        },
                        {
                          name: "patchValueSecretForPayloadToPost",
                          value: "{{inputs.parameters.postgresPasswordSecret}}",
                        },
                        {
                          name: "patchValueSecretKeyForPayloadToPost",
                          value: "{{inputs.parameters.postgresPasswordSecretKey}}",
                        },
                        {
                          name: "postResponseReturnValuePath",
                          value: JSON.stringify(["destinationId"]),
                        },
                      ],
                    },
                  },
                  {
                    name: "define-faker-to-postgres-connection",
                    templateRef: {
                      name: ApiObject.of(checkHttpGetJsonOrHttpPostJson).name,
                      template: MeltCheckHttpGetJsonOrHttpPostJson.templateName,
                    },
                    dependencies: ["define-faker-source", "define-postgres-destination"],
                    arguments: {
                      parameters: [
                        {
                          name: "urlToGet",
                          value:
                            "{{inputs.parameters.airbyteApiServerBaseUrl}}/v1/connections?workspaceIds={{=tasks['define-airbyte-workspace'].outputs.result}}",
                        },
                        {
                          name: "getResponseCheckPath",
                          value: JSON.stringify([
                            "data",
                            {
                              filterByKey: {
                                key: "name",
                                value: "{{inputs.parameters.airbyteFakerToPostgresConnectionName}}",
                              },
                            },
                          ]),
                        },
                        {
                          name: "getResponseReturnValuePath",
                          value: JSON.stringify([
                            "data",
                            {
                              filterByKey: {
                                key: "name",
                                value: "{{inputs.parameters.airbyteFakerToPostgresConnectionName}}",
                              },
                            },
                            "0",
                            "connectionId",
                          ]),
                        },
                        {
                          name: "getResponseFailedValue",
                          value: JSON.stringify([]),
                        },
                        {
                          name: "urlToPost",
                          value: "{{inputs.parameters.airbyteApiServerBaseUrl}}/v1/connections",
                        },
                        {
                          name: "payloadToPost",
                          value: JSON.stringify({
                            name: "{{inputs.parameters.airbyteFakerToPostgresConnectionName}}",
                            sourceId: "{{=tasks['define-faker-source'].outputs.result}}",
                            destinationId:
                              "{{=tasks['define-postgres-destination'].outputs.result}}",
                            namespaceDefinition: "custom_format",
                            namespaceFormat:
                              "{{inputs.parameters.airbyteFakerToPostgresDestinationSchema}}",
                          }),
                        },
                        {
                          name: "postResponseReturnValuePath",
                          value: JSON.stringify(["connectionId"]),
                        },
                      ],
                    },
                  },
                  {
                    name: "start-load",
                    templateRef: {
                      name: ApiObject.of(makeSimpleJsonHttpPostRequest).name,
                      template: MeltJsonHttpPostRequest.templateName,
                    },
                    dependencies: ["define-faker-to-postgres-connection"],
                    arguments: {
                      parameters: [
                        {
                          name: "url",
                          value: "{{inputs.parameters.airbyteApiServerBaseUrl}}/v1/jobs",
                        },
                        {
                          name: "requestBody",
                          value: JSON.stringify({
                            connectionId:
                              "{{=tasks['define-faker-to-postgres-connection'].outputs.result}}",
                            jobType: "sync",
                          }),
                        },
                      ],
                    },
                  },
                  {
                    name: "wait-for-load",
                    templateRef: {
                      name: ApiObject.of(makeSimpleHttpGetRequest).name,
                      template: MeltSimpleHttpGetRequest.templateName,
                    },
                    dependencies: ["start-load"],
                    arguments: {
                      parameters: [
                        {
                          name: "url",
                          value:
                            "{{inputs.parameters.airbyteApiServerBaseUrl}}/v1/jobs/{{=jsonpath(tasks['start-load'].outputs.result, '$.jobId')}}",
                        },
                        {
                          name: "successCondition",
                          value: 'response.body contains "succeeded"',
                        },
                        {
                          name: "retryLimit",
                          value: "{{inputs.parameters.airbyteFakerToPostgresJobRetryLimit}}",
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    });

    const readerRole = new Role(this, "reader-role", {
      metadata: { namespace },
      rules: [
        {
          verbs: ["create", "delete", "get", "list", "patch", "watch"],
          resources: [
            [CronWorkflow.GVK.apiVersion, "cronworkflows"],
            [Workflow.GVK.apiVersion, "workflows"],
            [WorkflowTemplate.GVK.apiVersion, "workflowtemplates"],
          ].map(([apiVersion, resourceType]) =>
            ApiResource.custom({
              apiGroup: utils.parseApiGroupFromApiVersion(apiVersion),
              resourceType,
            }),
          ),
        },
      ],
    });

    const readerServiceAccount = new ServiceAccount(this, "reader-service-account", {
      metadata: { namespace },
    });

    readerRole.bind(readerServiceAccount);

    const readerServiceAccountSercret = new KubeSecret(this, "reader-service-account-secret", {
      metadata: {
        namespace,
        annotations: {
          "kubernetes.io/service-account.name": readerServiceAccount.name,
        },
      },
      type: "kubernetes.io/service-account-token",
    });

    readerServiceAccountSercret.node.addDependency(readerServiceAccount);

    checkPostgresIsReady.node.addDependency(argoWorkflows, workflowExecutorServiceAccount);
    makeSimpleHttpGetRequest.node.addDependency(argoWorkflows, workflowExecutorServiceAccount);
    makeSimpleJsonHttpPostRequest.node.addDependency(argoWorkflows, workflowExecutorServiceAccount);

    eltWorkflow.addDependency(
      checkPostgresIsReady,
      makeSimpleHttpGetRequest,
      makeSimpleJsonHttpPostRequest,
      workflowExecutorServiceAccount,
    );

    postgresSecret.node.addDependency(eltWorkflow);
  }
}

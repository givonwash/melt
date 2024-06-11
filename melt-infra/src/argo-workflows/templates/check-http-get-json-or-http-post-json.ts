import { Construct } from "constructs";
import * as fs from "node:fs";
import * as path from "node:path";
import { MeltWorkflowTemplate, MeltWorkflowTemplateProps } from "./index.js";
import { WorkflowTemplate } from "../../../imports/workflowTemplates-argoproj.io.js";
import { EnvVar } from "../../../imports/k8s.js";

const baseImage = "python:3.12.3-slim-bookworm";
const baseCommand = ["python"];
const sourceScript = fs.readFileSync(
  path.join(import.meta.dirname, "scripts", "check-http-get-json-or-http-post-json.py"),
  { encoding: "utf8" },
);

const baseParameters = [
  { name: "urlToGet" },
  { name: "getResponseCheckPath" },
  { name: "getResponseFailedValue" },
  { name: "getResponseReturnValuePath" },
  { name: "urlToPost" },
  { name: "payloadToPost" },
  { name: "postResponseReturnValuePath" },
];

const baseEnvironment: EnvVar[] = [
  {
    name: "URL_TO_GET",
    value: "{{inputs.parameters.urlToGet}}",
  },
  {
    name: "GET_RESPONSE_CHECK_PATH",
    value: "{{inputs.parameters.getResponseCheckPath}}",
  },
  {
    name: "GET_RESPONSE_FAILED_VALUE",
    value: "{{inputs.parameters.getResponseFailedValue}}",
  },
  {
    name: "GET_RESPONSE_RETURN_VALUE_PATH",
    value: "{{inputs.parameters.getResponseReturnValuePath}}",
  },
  {
    name: "URL_TO_POST",
    value: "{{inputs.parameters.urlToPost}}",
  },
  {
    name: "PAYLOAD_TO_POST",
    value: "{{inputs.parameters.payloadToPost}}",
  },
  {
    name: "POST_RESPONSE_RETURN_VALUE_PATH",
    value: "{{inputs.parameters.postResponseReturnValuePath}}",
  },
];

export class MeltCheckHttpGetJsonOrHttpPostJson extends MeltWorkflowTemplate {
  static readonly templateName = "check-http-get-json-or-http-post-json";

  constructor(scope: Construct, id: string, props: MeltWorkflowTemplateProps) {
    super(scope, id, props);

    const { namespace, serviceAccountName } = props;

    new WorkflowTemplate(this, "Default", {
      metadata: { namespace },
      spec: {
        templates: [
          {
            name: MeltCheckHttpGetJsonOrHttpPostJson.templateName,
            serviceAccountName,
            inputs: {
              parameters: baseParameters,
            },
            script: {
              image: baseImage,
              command: baseCommand,
              source: sourceScript,
              env: baseEnvironment,
            },
          },
        ],
      },
    });
  }
}

export class MeltCheckHttpGetJsonOrHttpPostJsonWithPatchedSecrets extends MeltWorkflowTemplate {
  static readonly templateName = "check-http-get-json-or-http-post-json-with-patched-secrets";

  constructor(scope: Construct, id: string, props: MeltWorkflowTemplateProps) {
    super(scope, id, props);

    const { namespace, serviceAccountName } = props;

    new WorkflowTemplate(this, "Default", {
      metadata: { namespace },
      spec: {
        templates: [
          {
            name: MeltCheckHttpGetJsonOrHttpPostJsonWithPatchedSecrets.templateName,
            serviceAccountName,
            inputs: {
              parameters: baseParameters.concat([
                { name: "patchPathForPayloadToPost" },
                { name: "patchValueSecretForPayloadToPost" },
                { name: "patchValueSecretKeyForPayloadToPost" },
              ]),
            },
            script: {
              image: baseImage,
              command: baseCommand,
              source: sourceScript,
              env: baseEnvironment.concat([
                {
                  name: "PATCH_PATH_FOR_PAYLOAD_TO_POST",
                  value: "{{inputs.parameters.patchPathForPayloadToPost}}",
                },
                {
                  name: "PATCH_VALUE_FOR_PAYLOAD_TO_POST",
                  valueFrom: {
                    secretKeyRef: {
                      name: "{{inputs.parameters.patchValueSecretForPayloadToPost}}",
                      key: "{{inputs.parameters.patchValueSecretKeyForPayloadToPost}}",
                    },
                  },
                },
              ]),
            },
          },
        ],
      },
    });
  }
}

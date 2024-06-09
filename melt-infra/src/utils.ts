export function parseApiGroupFromApiVersion(apiVersion: string): string {
  return apiVersion.split("/")[0] || "core";
}

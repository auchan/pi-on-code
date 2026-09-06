/**
 * Query string for the VS Code Settings editor that filters to this
 * extension, e.g. `@ext:auchan.pion-code`.
 */
export function extensionSettingsQuery(publisher?: unknown, name?: unknown): string {
  const resolvedPublisher = typeof publisher === "string" && publisher.trim()
    ? publisher.trim()
    : "auchan";
  const resolvedName = typeof name === "string" && name.trim()
    ? name.trim()
    : "pion-code";
  return `@ext:${resolvedPublisher}.${resolvedName}`;
}

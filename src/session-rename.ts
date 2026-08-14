/** Normalize a sidebar rename value; blank names cancel the rename. */
export function normalizeSessionRename(value: string | undefined): string | undefined {
  if (value === undefined) { return undefined; }
  const name = value.replace(/\s+/g, " ").trim();
  return name || undefined;
}

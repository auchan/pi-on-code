/**
 * Resolve the card title for a tool call. Consolidated tools carry a
 * disambiguating `action` argument (e.g. vscode_workspace_tool with
 * open_file / diagnostics); surface it as vscode_<action> so the UI shows
 * which capability actually ran, matching the previous per-tool naming.
 */
export function resolveToolTitle(toolName: string, args?: Record<string, unknown>): string {
  const action = args && typeof args.action === "string" ? args.action : "";
  if (!action) { return toolName; }
  return toolName === "vscode_workspace_tool"
    ? `vscode_${action}`
    : `${toolName} - ${action}`;
}

/** Update an existing tool block's title (used when args arrive late). */
export function updateToolBlockTitle(el: HTMLElement, title: string): void {
  const nameEl = el.querySelector<HTMLElement>(".tool-name");
  if (nameEl) { nameEl.textContent = title; }
}


/** Serialize generic tool arguments for the compact tool header. */
export function formatToolHeaderArguments(args?: Record<string, unknown>): string | undefined {
  if (!args || Object.keys(args).length === 0) { return undefined; }
  try {
    return JSON.stringify(args);
  } catch {
    return undefined;
  }
}

/** Update a generic tool header with its full argument text. */
export function updateToolBlockArguments(el: HTMLElement, args?: Record<string, unknown>): void {
  const detail = formatToolHeaderArguments(args);
  const detailEl = el.querySelector<HTMLElement>(".tool-header-arguments");
  if (detailEl) {
    detailEl.textContent = detail ?? "";
    detailEl.hidden = !detail;
  }
}

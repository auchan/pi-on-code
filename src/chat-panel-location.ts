/**
 * Where a newly opened Pi chat panel is placed inside the VS Code window.
 *
 * - `"panel"` — the chat opens as a tab in the active editor group; the editor
 *   area is never split for it.
 * - `"splitPanel"` — the chat opens in a new editor group split to the right
 *   of the active group (historical default behavior).
 */
export type ChatPanelLocation = "panel" | "splitPanel";

export const DEFAULT_CHAT_PANEL_LOCATION: ChatPanelLocation = "splitPanel";

export function parseChatPanelLocation(raw: unknown): ChatPanelLocation {
  return raw === "panel" || raw === "splitPanel"
    ? raw
    : DEFAULT_CHAT_PANEL_LOCATION;
}

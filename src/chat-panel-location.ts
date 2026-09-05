/**
 * Where a newly created Pi chat panel is placed inside the VS Code window.
 *
 * - `"panel"` — the chat opens as a tab in the active editor group; the editor
 *   area is never split for it.
 * - `"splitPanel"` — the chat opens in a new editor group split to the right
 *   of the active group (historical default behavior).
 * - `"secondarySideBar"` — chats live in the right-most chat editor group:
 *   the first chat splits to the right once and later chats are stacked into
 *   the same far-right group, approximating a right-hand chat rail without
 *   multiplying editor columns.
 */
export type ChatPanelLocation = "panel" | "splitPanel" | "secondarySideBar";

export const DEFAULT_CHAT_PANEL_LOCATION: ChatPanelLocation = "splitPanel";

export function parseChatPanelLocation(raw: unknown): ChatPanelLocation {
  return raw === "panel" || raw === "splitPanel" || raw === "secondarySideBar"
    ? raw
    : DEFAULT_CHAT_PANEL_LOCATION;
}

export type ChatColumnTarget =
  | { kind: "active" }
  | { kind: "beside" }
  | { kind: "column"; column: number };

/** Choose the editor column a new chat panel should open in. */
export function resolveChatColumnTarget(
  location: ChatPanelLocation,
  openChatColumns: ReadonlyArray<number>,
): ChatColumnTarget {
  if (location === "panel") { return { kind: "active" }; }
  if (location === "secondarySideBar") {
    if (openChatColumns.length > 0) {
      return { kind: "column", column: Math.max(...openChatColumns) };
    }
    return { kind: "beside" };
  }
  return { kind: "beside" };
}

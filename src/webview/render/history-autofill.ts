/** Pure decision logic for auto-loading earlier history pages. Keeping this
 *  separate makes the pagination behaviour testable without a DOM. */

export interface HistoryAutoFillInput {
  hasMore: boolean;
  loading: boolean;
  /** True once at least one user message is present in the loaded transcript. */
  hasUserMessage: boolean;
  /** Remaining scrollable space at the current position (px). */
  scrollableRoom: number;
  scrollTop: number;
  /** Pages already auto-loaded in the current burst. */
  autoFillCount: number;
  autoFillCap?: number;
}

export function decideAutoLoadOlder(input: HistoryAutoFillInput): boolean {
  if (!input.hasMore || input.loading) { return false; }
  const cap = input.autoFillCap ?? 20;
  if (input.autoFillCount >= cap) { return false; }

  // A page may contain only collapsed execution content (tool runs, thinking)
  // with no visible user turn. Keep loading until at least one user message
  // has arrived so the conversation always has an anchor to continue from.
  if (!input.hasUserMessage) { return true; }

  // Otherwise top up when the transcript cannot be scrolled (execution-process
  // collapsing can shrink a loaded page below the viewport, making a manual
  // upward scroll impossible) and the user is already at the top edge.
  return input.scrollTop <= 8 && input.scrollableRoom <= 60;
}

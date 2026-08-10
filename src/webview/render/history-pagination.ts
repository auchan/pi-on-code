import type { ScrollOwner } from "./scroll-lock.js";

export interface HistoryViewport {
  scrollTop: number;
  readonly scrollHeight: number;
}

export interface OlderHistoryLoadState {
  scrollTop: number;
  hasMore: boolean;
  loading: boolean;
  /** Informational only: atomic history pages are safe during streaming. */
  streaming: boolean;
  inBatch: boolean;
  /**
   * While a minimap or reveal jump owns the view, older history must not be
   * auto-loaded: loading another page would restore the previous anchor and
   * cancel the jump animation mid-flight.
   */
  owner: ScrollOwner;
}

export function shouldLoadOlderHistory(
  state: OlderHistoryLoadState,
  threshold = 120,
): boolean {
  if (state.owner === "minimap" || state.owner === "reveal") { return false; }
  return state.hasMore && !state.loading && !state.inBatch && state.scrollTop <= threshold;
}

/** Keep the same visible content anchored after older nodes are prepended. */
export function restoreScrollAfterPrepend(
  viewport: HistoryViewport,
  previousScrollHeight: number,
  previousScrollTop: number,
): void {
  viewport.scrollTop = previousScrollTop + Math.max(0, viewport.scrollHeight - previousScrollHeight);
}

export const HISTORY_PAGE_SIZE = 20;

interface HistoryEntryLike {
  type?: unknown;
  display?: unknown;
  message?: { role?: unknown; customType?: unknown; display?: unknown };
}

/** Entries that produce visible conversation content during session replay. */
export function isVisibleHistoryEntry(entry: HistoryEntryLike): boolean {
  if (entry.type === "compaction") { return true; }
  if (entry.type === "custom_message") { return entry.display === true; }
  if (entry.type !== "message") { return false; }
  const role = entry.message?.role;
  if (role === "custom") {
    return entry.message?.display === true || entry.message?.customType === "info";
  }
  return role === "user" || role === "assistant" || role === "bashExecution";
}

/** Find the inclusive start of a page ending immediately before `end`. */
export function findHistoryPageStart(
  entries: HistoryEntryLike[],
  end: number,
  pageSize = HISTORY_PAGE_SIZE,
): number {
  if (pageSize <= 0) { throw new Error("History page size must be positive"); }

  let visibleEntries = 0;
  for (let index = Math.min(end, entries.length) - 1; index >= 0; index--) {
    if (!isVisibleHistoryEntry(entries[index])) { continue; }
    visibleEntries++;
    if (visibleEntries === pageSize) { return index; }
  }
  return 0;
}

/**
 * Find one atomic history range that includes a target entry. This follows the
 * same visible-entry page boundaries as ordinary pagination without exposing
 * each intermediate page to the Webview.
 */
export function findHistoryLoadStart(
  entries: HistoryEntryLike[],
  end: number,
  targetIndex: number,
  pageSize = HISTORY_PAGE_SIZE,
): number {
  let start = Math.min(end, entries.length);
  const target = Math.max(0, Math.min(targetIndex, start));
  while (start > target) {
    const previousStart = start;
    start = findHistoryPageStart(entries, start, pageSize);
    if (start >= previousStart) { break; }
  }
  return start;
}

/**
 * Helpers for editing or forking a conversation at an arbitrary user message.
 * The session file itself is only ever rewritten by composing SDK primitives
 * (`createBranchedSession`) so the extension never hand-edits JSONL entries.
 */

export interface SessionEntryLike {
  id?: string;
  type?: string;
  message?: { role?: string };
}

export interface UserMessageActionTarget {
  entryIndex: number;
  /** Entry id the branch should stop after. Null when the message is first. */
  predecessorId: string | null;
}

export function isUserMessageEntry(entry: SessionEntryLike): boolean {
  return entry.type === "message" && entry.message?.role === "user";
}

/**
 * Locate a persisted user message entry and compute its edit branch point.
 *
 * Editing is expressed as: branch everything *before* the target message, then
 * append the rewritten text as a fresh user message. Entries before the target
 * keep their ids (prefix cache reuse); the target and everything after it are
 * excluded from the new session.
 */
export function resolveUserMessageEditTarget(
  entries: readonly SessionEntryLike[],
  targetId: string,
): UserMessageActionTarget | null {
  const entryIndex = entries.findIndex((entry) => entry.id === targetId);
  if (entryIndex < 0 || !isUserMessageEntry(entries[entryIndex])) { return null; }
  const predecessor = entryIndex > 0 ? entries[entryIndex - 1] : undefined;
  return {
    entryIndex,
    predecessorId: predecessor?.id ?? null,
  };
}

/** Next fork title: append an incrementing (N) to the base title.
 *  Forking a session already titled "… (2)" yields "… (3)", never "… (2) (2)". */
export function forkSessionTitle(originalTitle: string): string {
  const cleaned = originalTitle.replace(/\s+/g, " ").trim();
  const legacy = cleaned.replace(/^<fork:\s*/i, "").replace(/>\s*$/, "").trim();
  const base = legacy.replace(/\s+\(\d+\)\s*$/u, "").trim() || "Untitled session";
  const match = legacy.match(/\((\d+)\)\s*$/u);
  const next = match ? Number(match[1]) + 1 : 2;
  return `${base} (${next})`;
}

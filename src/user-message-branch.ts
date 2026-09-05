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

/** Display label for a fork, e.g. `<fork: Fix lint errors>`. */
export function forkSessionLabel(originalTitle: string): string {
  const title = originalTitle.replace(/\s+/g, " ").trim() || "Untitled session";
  const codePoints = Array.from(title);
  const capped = codePoints.length > 40
    ? `${codePoints.slice(0, 40).join("").replace(/[\s.…]+$/u, "")}…`
    : title;
  return `<fork: ${capped}>`;
}

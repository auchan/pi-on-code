/**
 * Visible label used on editor tabs for a session. Tabs that carry the full
 * session title grow without bound, pushing sibling tabs out of view, so the
 * displayed label is capped deterministically. The cap is applied in exactly
 * the same way for every tab state so activation never changes the length.
 */
export const DEFAULT_TAB_LABEL_MAX = 28;

function sliceCodePoints(value: string, maxLength: number): string {
  const codePoints = Array.from(value);
  return codePoints.slice(0, maxLength).join("");
}

/** Collapse whitespace, cap by code points, and add an ellipsis when cut. */
export function limitTabLabel(
  label: string,
  maxLength: number = DEFAULT_TAB_LABEL_MAX,
): string {
  const compact = label.replace(/\s+/g, " ").trim();
  if (Array.from(compact).length <= maxLength) { return compact; }
  return `${sliceCodePoints(compact, maxLength).replace(/[\s.…]+$/u, "")}…`;
}

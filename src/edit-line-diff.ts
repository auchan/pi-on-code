export type EditLineDiff =
  | { type: "context"; line: string }
  | { type: "removed"; line: string }
  | { type: "added"; line: string };

function splitLines(text: string): string[] {
  if (!text) { return []; }
  const lines = text.split("\n");
  if (lines.at(-1) === "") { lines.pop(); }
  return lines;
}

/**
 * Produce a line-level diff for one edit block. Common lines are preserved as
 * context so replacements do not paint the whole old/new block as changed.
 */
export function diffEditLines(before: string, after: string): EditLineDiff[] {
  const oldLines = splitLines(before);
  const newLines = splitLines(after);
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) {
    prefix++;
  }

  let oldEnd = oldLines.length;
  let newEnd = newLines.length;
  while (oldEnd > prefix && newEnd > prefix && oldLines[oldEnd - 1] === newLines[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }

  const oldChanged = oldLines.slice(prefix, oldEnd);
  const newChanged = newLines.slice(prefix, newEnd);
  const result: EditLineDiff[] = oldLines.slice(0, prefix).map((line) => ({ type: "context" as const, line }));

  // Keep rendering bounded for unusually large full-file replacements.
  if (oldChanged.length * newChanged.length > 4_000_000) {
    result.push(...oldChanged.map((line) => ({ type: "removed" as const, line })));
    result.push(...newChanged.map((line) => ({ type: "added" as const, line })));
  } else {
    const width = newChanged.length + 1;
    const table = new Uint32Array((oldChanged.length + 1) * width);
    for (let oldIndex = oldChanged.length - 1; oldIndex >= 0; oldIndex--) {
      for (let newIndex = newChanged.length - 1; newIndex >= 0; newIndex--) {
        const index = oldIndex * width + newIndex;
        table[index] = oldChanged[oldIndex] === newChanged[newIndex]
          ? table[(oldIndex + 1) * width + newIndex + 1] + 1
          : Math.max(table[(oldIndex + 1) * width + newIndex], table[oldIndex * width + newIndex + 1]);
      }
    }

    let oldIndex = 0;
    let newIndex = 0;
    while (oldIndex < oldChanged.length && newIndex < newChanged.length) {
      if (oldChanged[oldIndex] === newChanged[newIndex]) {
        result.push({ type: "context", line: oldChanged[oldIndex] });
        oldIndex++;
        newIndex++;
      } else if (table[(oldIndex + 1) * width + newIndex] >= table[oldIndex * width + newIndex + 1]) {
        result.push({ type: "removed", line: oldChanged[oldIndex++] });
      } else {
        result.push({ type: "added", line: newChanged[newIndex++] });
      }
    }
    while (oldIndex < oldChanged.length) { result.push({ type: "removed", line: oldChanged[oldIndex++] }); }
    while (newIndex < newChanged.length) { result.push({ type: "added", line: newChanged[newIndex++] }); }
  }

  result.push(...oldLines.slice(oldEnd).map((line) => ({ type: "context" as const, line })));
  return result;
}

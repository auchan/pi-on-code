import * as assert from "node:assert";
import { readFileSync } from "node:fs";

const styles = readFileSync(
  new URL("../../media/style.css", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

suite("User message styling", () => {
  test("renders user messages as distinct full-width cards", () => {
    const rule = styles.match(/\.message\.user \{\n  min-width:[\s\S]*?\n\}/)?.[0];
    assert.ok(rule, "final user message rule not found");
    assert.match(rule, /align-self: stretch/);
    assert.match(rule, /padding: 12px 14px/);
    assert.match(rule, /border: 1px solid var\(--pi-line\)/);
    assert.match(rule, /border-left: 3px solid var\(--pi-lavender\)/);
    assert.match(rule, /border-radius: 6px/);
    assert.match(rule, /background: color-mix\(in srgb, var\(--pi-lavender\) 10%, var\(--pi-surface\)\)/);
  });

  test("keeps a theme-safe background fallback", () => {
    assert.match(
      styles,
      /background: var\(--vscode-input-background, var\(--pi-surface\)\);\n  background: color-mix/,
    );
  });
});

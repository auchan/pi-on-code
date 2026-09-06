import * as assert from "node:assert";
import { readFileSync } from "node:fs";

const styles = readFileSync(
  new URL("../../media/style.css", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

suite("User message styling", () => {
  test("renders user messages as distinct full-width cards", () => {
    // The card chrome sits on the message content; the row stacks it and the
    // right-aligned action row below so actions live outside the bubble.
    const card = styles.match(/\.message\.user \.message-content \{\n  position: relative;[\s\S]*?\n\}/)?.[0];
    assert.ok(card, "user message card rule not found");
    assert.match(card, /padding: 12px 14px/);
    assert.match(card, /border: 1px solid var\(--pi-line\)/);
    assert.match(card, /border-left: 3px solid var\(--pi-lavender\)/);
    assert.match(card, /border-radius: 6px/);
    assert.match(card, /background: color-mix\(in srgb, var\(--pi-lavender\) 10%, var\(--pi-surface\)\)/);
    assert.match(styles, /\.message\.user \{\n  position: relative;\n  display: flex;\n  flex-direction: column;/);
    assert.match(styles, /\.user-actions \{\n  align-self: flex-end;/);
  });

  test("keeps a theme-safe background fallback", () => {
    assert.match(
      styles,
      /background: var\(--vscode-input-background, var\(--pi-surface\)\);\n  background: color-mix/,
    );
  });
});

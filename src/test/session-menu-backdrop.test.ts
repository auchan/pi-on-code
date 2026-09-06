import * as assert from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../src/session-sidebar-provider.ts", import.meta.url),
  "utf8",
);

function menuRule(): string {
  const start = source.indexOf(".session-menu {\n");
  assert.ok(start >= 0, ".session-menu rule not found");
  const end = source.indexOf("\n    }", start);
  assert.ok(end > start, ".session-menu rule has no closing brace");
  return source.slice(start, end + 6);
}

suite("Session action menu backdrop", () => {
  test("gives the menu a non-transparent theme-aware background", () => {
    const menu = menuRule();
    assert.match(
      menu,
      /background: var\(--vscode-editorWidget-background, var\(--pi-bg\)\);/,
      "expected an opaque widget-background fallback",
    );
    assert.match(
      menu,
      /background: color-mix\(in srgb, var\(--pi-bg\) 94%, transparent\);/,
      "expected a near-opaque color-mix backdrop",
    );
    assert.doesNotMatch(menu, /var\(--pi-panel\)/, "must not rely on the possibly-transparent section-header token");
  });

  test("keeps the elevated shadow and border", () => {
    const menu = menuRule();
    assert.match(menu, /border: 1px solid var\(--pi-border\)/);
    assert.match(menu, /box-shadow: 0 6px 18px rgb\(0 0 0 \/ 28%\)/);
  });
});

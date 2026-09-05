import * as assert from "node:assert";
import { readFileSync } from "node:fs";
import { limitTabLabel } from "../tab-label.js";

suite("Session tab label limits", () => {
  test("keeps short labels unchanged", () => {
    assert.strictEqual(limitTabLabel("Fix sidebar refresh"), "Fix sidebar refresh");
    assert.strictEqual(limitTabLabel("Pi"), "Pi");
    assert.strictEqual(limitTabLabel(""), "");
  });

  test("truncates long labels to the configured maximum with an ellipsis", () => {
    const label = "a very long session title that would push sibling tabs out of view";
    const limited = limitTabLabel(label, 28);
    assert.strictEqual(Array.from(limited).length, 29);
    assert.ok(limited.endsWith("…"));
    assert.strictEqual(Array.from(limited.slice(0, -1)).length, 28);
  });

  test("counts code points instead of UTF-16 code units", () => {
    const exactLengthLabel = "🤖".repeat(28);
    assert.strictEqual(limitTabLabel(exactLengthLabel, 28), exactLengthLabel);

    const label = "🤖".repeat(40) + " title";
    const limited = limitTabLabel(label, 28);
    assert.strictEqual(Array.from(limited).length, 29);
    assert.ok(!limited.includes("\uFFFD"), "must not split surrogate pairs");
  });

  test("collapses whitespace before applying the cap", () => {
    const label = "标题  很 长  占用  空间 ".repeat(4) + "标题栏";
    const limited = limitTabLabel(label, 28);
    assert.ok(!limited.includes("  "), "consecutive spaces must be collapsed");
    assert.ok(limited.endsWith("…"));
  });

  test("caps every tab state through the shared title builder", () => {
    const source = readFileSync(
      new URL("../../src/webview-panel.ts", import.meta.url),
      "utf8",
    );
    assert.match(source, /const label = limitTabLabel\(this\._tabSummary \?\? "Pi"\);/);
    assert.match(
      source,
      /this\.panel\.title = \(this\._tabStreaming \? "\\u25CF " : "\\u25CB "\) \+ label;/,
    );
    assert.match(source, /import \{ limitTabLabel \} from "\.\/tab-label\.js";/);
  });
});

import * as assert from "node:assert";
import { readFileSync } from "node:fs";

const styles = readFileSync(
  new URL("../../media/style.css", import.meta.url),
  "utf8",
);

suite("Thinking block height", () => {
  test("halves the finished reader height to 260px", () => {
    const rule = styles.match(/\.thinking-block:not\(\.thinking-collapsed\) \.thinking-content \{[\s\S]*?\n\}/)?.[0];
    assert.ok(rule, "finished thinking reader rule not found");
    assert.match(rule, /max-height: min\(60vh, 260px\)/);
  });

  test("uses the same max height for the live streaming tail", () => {
    const reader = styles.match(/\.thinking-block:not\(\.thinking-collapsed\) \.thinking-content \{[\s\S]*?\n\}/)?.[0];
    const live = styles.match(/\.thinking-block:has\(\.thinking-spinner\) \.thinking-content \{[\s\S]*?\n\}/)?.[0];
    assert.ok(live, "live thinking rule not found");
    assert.match(live, /max-height: min\(60vh, 260px\)/);
    assert.strictEqual(
      live?.match(/max-height: [^;]+;/)?.[0],
      reader?.match(/max-height: [^;]+;/)?.[0],
      "both thinking modes must cap at the same height",
    );
  });

  test("keeps per-mode overflow behaviour intact", () => {
    const reader = styles.match(/\.thinking-block:not\(\.thinking-collapsed\) \.thinking-content \{[\s\S]*?\n\}/)?.[0];
    const live = styles.match(/\.thinking-block:has\(\.thinking-spinner\) \.thinking-content \{[\s\S]*?\n\}/)?.[0];
    assert.match(reader ?? "", /overflow-y: auto/);
    assert.match(live ?? "", /overflow: hidden/);
  });
});

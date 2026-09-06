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

  test("halves the live streaming tail height to 160px", () => {
    const rule = styles.match(/\.thinking-block:has\(\.thinking-spinner\) \.thinking-content \{[\s\S]*?\n\}/)?.[0];
    assert.ok(rule, "live thinking rule not found");
    assert.match(rule, /max-height: 160px/);
  });

  test("keeps scroll behaviour intact for the smaller blocks", () => {
    const reader = styles.match(/\.thinking-block:not\(\.thinking-collapsed\) \.thinking-content \{[\s\S]*?\n\}/)?.[0];
    const live = styles.match(/\.thinking-block:has\(\.thinking-spinner\) \.thinking-content \{[\s\S]*?\n\}/)?.[0];
    assert.match(reader ?? "", /overflow-y: auto/);
    assert.match(live ?? "", /overflow: hidden/);
  });
});

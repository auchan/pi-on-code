import * as assert from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../src/webview/main.ts", import.meta.url),
  "utf8",
);

suite("Webview main scroll wiring", () => {
  test("takes scroll control synchronously on upward wheel input", () => {
    assert.match(source, /function takeUserScrollControl\(\): void \{\n  markUserScrollIntent\(\);\n  cancelFollowScroll\(\);\n  state\.scrollOwner = "user";\n\}/);
    assert.match(source, /state\.chatContainer\.addEventListener\("wheel", \(event\) => \{\n  if \(event\.deltaY === 0\) \{ return; \}\n  if \(event\.deltaY < 0\) \{\n    \/\/ Scrolling up[\s\S]*?takeUserScrollControl\(\);/);
  });

  test("does not grab control for downward wheel at the live edge", () => {
    assert.match(source, /else if \(!isConversationAtBottom\(\)\) \{\n    \/\/ Scrolling down through older content[\s\S]*?takeUserScrollControl\(\);\n  \}/);
    assert.match(source, /function isConversationAtBottom\(threshold = 50\): boolean/);
  });

  test("restores streaming ownership when the live edge is reached", () => {
    assert.match(source, /state\.scrollOwner = nextScrollOwner\(state\.scrollOwner, \{\n    isAtBottom: atBottom,\n    hasUserIntent: hasUserScrollIntent \|\| scrollbarPointerActive,\n  \}\);/);
    assert.match(source, /if \(atBottom\) \{ clearUserScrollIntent\(\); \}/);
  });

  test("reuses the synchronous takeover for scrollbar, touch, and keyboard input", () => {
    const occurrences = source.match(/takeUserScrollControl\(\)/g)?.length ?? 0;
    assert.ok(occurrences >= 5, `expected wheel, scrollbar, touch, and keyboard call sites, found ${occurrences}`);
  });
});

import * as assert from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../src/webview/main.ts", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

suite("Webview main scroll wiring", () => {
  test("takes scroll control synchronously on upward wheel input", () => {
    assert.match(source, /function takeUserScrollControl\(\): void \{\n  markUserScrollIntent\(\);\n  cancelFollowScroll\(\);\n  state\.scrollOwner = "user";\n\}/);
    assert.match(source, /function markUpwardScrollInput\(\): void \{\n  takeUserScrollControl\(\);\n  lastUpInputAt = performance\.now\(\);\n\}/);
    assert.match(source, /if \(event\.deltaY === 0\) \{ return; \}\n  if \(event\.deltaY < 0\) \{\n    \/\/ Scrolling up[\s\S]*?markUpwardScrollInput\(\);/);
  });

  test("latches upward takeover while still inside the bottom tolerance", () => {
    assert.match(source, /const inUpwardGrace =\n    atBottom && performance\.now\(\) - lastUpInputAt < UPWARD_GRACE_MS;/);
    assert.match(source, /isAtBottom: inUpwardGrace \? false : atBottom,\n    hasUserIntent: inUpwardGrace \|\| hasUserScrollIntent \|\| scrollbarPointerActive,/);
  });

  test("downward wheel at the live edge cancels grace and does not grab control", () => {
    assert.match(source, /clearUpwardScrollGrace\(\);\n    if \(!isConversationAtBottom\(\)\)/);
    assert.match(source, /function clearUpwardScrollGrace\(\): void \{\n  lastUpInputAt = 0;\n\}/);
    assert.match(source, /function isConversationAtBottom\(threshold = 50\): boolean/);
  });

  test("restores streaming ownership at the live edge outside the grace window", () => {
    assert.match(source, /state\.scrollOwner = nextScrollOwner\(state\.scrollOwner, \{\n    isAtBottom: inUpwardGrace \? false : atBottom,\n    hasUserIntent: inUpwardGrace \|\| hasUserScrollIntent \|\| scrollbarPointerActive,\n  \}\);/);
    assert.match(source, /if \(atBottom && !inUpwardGrace\) \{ clearUserScrollIntent\(\); \}/);
  });

  test("reuses the takeover for scrollbar, touch, and keyboard input", () => {
    const takeOvers = source.match(/takeUserScrollControl\(\)/g)?.length ?? 0;
    const upwardMarks = source.match(/markUpwardScrollInput\(\)/g)?.length ?? 0;
    assert.ok(takeOvers >= 5, `expected wheel, scrollbar, touch, and keyboard call sites, found ${takeOvers}`);
    assert.ok(upwardMarks >= 4, `expected upward marks for wheel, scrollbar, touch, and keyboard, found ${upwardMarks}`);
  });
});

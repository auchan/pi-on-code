import * as assert from "node:assert";
import {
  findActiveTurnIndex,
  getConversationJumpTop,
  getHoverTickWidth,
  getMinimapLayout,
  getMinimapOverflow,
  truncateTurnPreview,
} from "../webview/components/conversation-minimap.js";

suite("Webview conversation minimap", () => {
  test("normalizes and truncates tooltip previews", () => {
    assert.strictEqual(truncateTurnPreview("  first\n\nsecond  "), "first second");
    assert.strictEqual(truncateTurnPreview("abcdefgh", 6), "abcde…");
  });

  test("selects the turn at the viewport anchor", () => {
    const positions = [40, 280, 640, 980];

    assert.strictEqual(findActiveTurnIndex(positions, 0), 0);
    assert.strictEqual(findActiveTurnIndex(positions, 500), 1);
    assert.strictEqual(findActiveTurnIndex(positions, 640), 2);
    assert.strictEqual(findActiveTurnIndex(positions, 1_200), 3);
    assert.strictEqual(findActiveTurnIndex([], 500), -1);
  });

  test("expands nearby ticks gradually around the hovered turn", () => {
    assert.deepStrictEqual(
      [0, 1, 2, 3, 4].map(getHoverTickWidth),
      [22, 16, 12, 9, 7],
    );
    assert.strictEqual(getHoverTickWidth(-2), 12);
  });

  test("resolves jumps relative to the conversation scroll container", () => {
    assert.strictEqual(getConversationJumpTop(80, 20, 140), 200);
    assert.strictEqual(getConversationJumpTop(10, 20, 0), 0);
  });

  test("uses equal padding within the conversation viewport", () => {
    assert.deepStrictEqual(getMinimapLayout(4, 48, 800), {
      top: 424,
      height: 48,
    });
    assert.deepStrictEqual(getMinimapLayout(100, 48, 800), {
      top: 64,
      height: 768,
    });
    assert.deepStrictEqual(getMinimapLayout(1, 48, 20), {
      top: 48,
      height: 28,
    });
  });

  test("fades only toward hidden minimap turns", () => {
    assert.deepStrictEqual(getMinimapOverflow(0, 800, 300), {
      before: false,
      after: true,
    });
    assert.deepStrictEqual(getMinimapOverflow(200, 800, 300), {
      before: true,
      after: true,
    });
    assert.deepStrictEqual(getMinimapOverflow(500, 800, 300), {
      before: true,
      after: false,
    });
    assert.deepStrictEqual(getMinimapOverflow(0, 200, 300), {
      before: false,
      after: false,
    });
  });
});

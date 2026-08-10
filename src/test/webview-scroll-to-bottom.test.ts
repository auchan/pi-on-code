import * as assert from "node:assert";
import { shouldShowScrollToBottom } from "../webview/components/scroll-to-bottom-button.js";

suite("Webview scroll-to-bottom button", () => {
  test("shows only when the conversation is away from the live edge", () => {
    assert.strictEqual(shouldShowScrollToBottom({
      scrollTop: 400,
      scrollHeight: 1_000,
      clientHeight: 500,
    }), true);
    assert.strictEqual(shouldShowScrollToBottom({
      scrollTop: 460,
      scrollHeight: 1_000,
      clientHeight: 500,
    }), false);
  });

  test("stays hidden when the conversation does not overflow", () => {
    assert.strictEqual(shouldShowScrollToBottom({
      scrollTop: 0,
      scrollHeight: 400,
      clientHeight: 500,
    }), false);
  });
});

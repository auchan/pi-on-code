import * as assert from "node:assert";
import { decideAutoLoadOlder } from "../webview/render/history-autofill.js";

const idle = {
  hasMore: true,
  loading: false,
  hasUserMessage: true,
  scrollableRoom: 0,
  scrollTop: 0,
  autoFillCount: 0,
};

suite("History auto-fill decisions", () => {
  test("loads when no user message has been loaded yet", () => {
    assert.strictEqual(decideAutoLoadOlder({ ...idle, hasUserMessage: false }), true);
  });

  test("tops up a transcript that cannot be scrolled while at the top", () => {
    assert.strictEqual(decideAutoLoadOlder({ ...idle, scrollableRoom: 40 }), true);
    assert.strictEqual(decideAutoLoadOlder({ ...idle, scrollableRoom: 120 }), false);
  });

  test("never auto-loads while a page is already loading or history is empty", () => {
    assert.strictEqual(decideAutoLoadOlder({ ...idle, loading: true }), false);
    assert.strictEqual(decideAutoLoadOlder({ ...idle, hasMore: false }), false);
    assert.strictEqual(decideAutoLoadOlder({ ...idle, hasUserMessage: false, hasMore: false }), false);
  });

  test("skips loading when the user is not at the top edge", () => {
    assert.strictEqual(decideAutoLoadOlder({ ...idle, scrollTop: 60, scrollableRoom: 0 }), false);
  });

  test("bounds a single auto-fill burst", () => {
    assert.strictEqual(decideAutoLoadOlder({ ...idle, autoFillCount: 19 }), true);
    assert.strictEqual(decideAutoLoadOlder({ ...idle, autoFillCount: 20 }), false);
  });
});

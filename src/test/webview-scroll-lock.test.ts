import * as assert from "node:assert";
import {
  nextScrollOwner,
  scheduleFollowScroll,
  type ScrollViewport,
} from "../webview/render/scroll-lock.js";

suite("Webview conversation scroll lock", () => {
  test("keeps streaming ownership for a programmatic non-bottom scroll event", () => {
    assert.strictEqual(nextScrollOwner("stream", {
      isAtBottom: false,
      hasUserIntent: false,
    }), "stream");
  });

  test("grants user ownership when the user intentionally leaves the bottom", () => {
    assert.strictEqual(nextScrollOwner("stream", {
      isAtBottom: false,
      hasUserIntent: true,
    }), "user");
  });

  test("keeps a minimap jump lock until the bottom is reached", () => {
    assert.strictEqual(nextScrollOwner("minimap", {
      isAtBottom: false,
      hasUserIntent: false,
    }), "minimap");
    assert.strictEqual(nextScrollOwner("minimap", {
      isAtBottom: true,
      hasUserIntent: false,
    }), "stream");
  });

  test("keeps a reveal jump lock until the user scrolls", () => {
    assert.strictEqual(nextScrollOwner("reveal", {
      isAtBottom: false,
      hasUserIntent: false,
    }), "reveal");
    assert.strictEqual(nextScrollOwner("reveal", {
      isAtBottom: false,
      hasUserIntent: true,
    }), "user");
  });

  test("does not snap to bottom when the user scrolls up before the frame runs", () => {
    const viewport: ScrollViewport = { scrollTop: 240, scrollHeight: 1200 };
    let following = true;
    let scheduled: (() => void) | undefined;

    scheduleFollowScroll(viewport, () => following, (callback) => {
      scheduled = callback;
    });
    following = false;
    scheduled?.();

    assert.strictEqual(viewport.scrollTop, 240);
  });

  test("follows new output while the user remains at the bottom", () => {
    const viewport: ScrollViewport = { scrollTop: 900, scrollHeight: 1200 };
    let scheduled: (() => void) | undefined;

    scheduleFollowScroll(viewport, () => true, (callback) => {
      scheduled = callback;
    });
    scheduled?.();

    assert.strictEqual(viewport.scrollTop, 1200);
  });

  test("does not schedule scrolling when a jump owner holds the view", () => {
    const viewport: ScrollViewport = { scrollTop: 240, scrollHeight: 1200 };
    let scheduleCount = 0;

    scheduleFollowScroll(viewport, () => false, () => {
      scheduleCount++;
    });

    assert.strictEqual(scheduleCount, 0);
    assert.strictEqual(viewport.scrollTop, 240);
  });
});

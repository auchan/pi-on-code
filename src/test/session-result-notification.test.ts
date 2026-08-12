import * as assert from "node:assert";
import { isSessionResultUnread } from "../session-result-notification.js";

suite("Session result notifications", () => {
  test("does not notify when the completed result is already visible", () => {
    assert.strictEqual(isSessionResultUnread(true, true), false);
  });

  test("notifies when completion happens in a background tab", () => {
    assert.strictEqual(isSessionResultUnread(false, true), true);
  });

  test("notifies when VS Code is not focused", () => {
    assert.strictEqual(isSessionResultUnread(true, false), true);
  });
});

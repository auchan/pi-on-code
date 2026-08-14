import * as assert from "node:assert";
import { normalizeSessionRename } from "../session-rename.js";

suite("Session rename", () => {
  test("normalizes whitespace in session names", () => {
    assert.strictEqual(normalizeSessionRename("  Release\n planning  "), "Release planning");
  });

  test("rejects cancelled and blank names", () => {
    assert.strictEqual(normalizeSessionRename(undefined), undefined);
    assert.strictEqual(normalizeSessionRename("   "), undefined);
  });
});

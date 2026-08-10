import * as assert from "node:assert";
import {
  findHistoryLoadStart,
  findHistoryPageStart,
  isVisibleHistoryEntry,
} from "../history-pagination.js";

suite("Session history pagination", () => {
  test("counts only entries that render conversation content", () => {
    const entries = [
      { type: "message", message: { role: "user" } },
      { type: "model_change" },
      { type: "message", message: { role: "assistant" } },
      { type: "message", message: { role: "toolResult" } },
      { type: "compaction" },
      { type: "message", message: { role: "user" } },
    ];

    assert.strictEqual(findHistoryPageStart(entries, entries.length, 2), 4);
    assert.strictEqual(findHistoryPageStart(entries, 4, 2), 0);
  });

  test("returns zero when fewer than one page remains", () => {
    const entries = [
      { type: "session" },
      { type: "message", message: { role: "user" } },
    ];

    assert.strictEqual(findHistoryPageStart(entries, entries.length, 20), 0);
  });

  test("coalesces every page needed to include a target entry", () => {
    const entries = Array.from({ length: 8 }, () => ({
      type: "message",
      message: { role: "user" },
    }));

    assert.strictEqual(findHistoryLoadStart(entries, 8, 6, 2), 6);
    assert.strictEqual(findHistoryLoadStart(entries, 8, 3, 2), 2);
    assert.strictEqual(findHistoryLoadStart(entries, 8, 0, 2), 0);
    assert.strictEqual(findHistoryLoadStart(entries, 4, 6, 2), 4);
  });

  test("recognizes only entries rendered in the transcript", () => {
    for (const role of ["user", "assistant", "bashExecution"]) {
      assert.strictEqual(isVisibleHistoryEntry({ type: "message", message: { role } }), true);
    }
    assert.strictEqual(
      isVisibleHistoryEntry({ type: "message", message: { role: "custom", display: true } }),
      true,
    );
    assert.strictEqual(
      isVisibleHistoryEntry({ type: "message", message: { role: "custom", customType: "info" } }),
      true,
    );
    assert.strictEqual(
      isVisibleHistoryEntry({ type: "message", message: { role: "custom", customType: "pi-on-code.active-tools" } }),
      false,
    );
    assert.strictEqual(
      isVisibleHistoryEntry({ type: "message", message: { role: "toolResult" } }),
      false,
    );
  });

  test("rejects non-positive page sizes", () => {
    assert.throws(() => findHistoryPageStart([], 0, 0), /must be positive/);
  });
});

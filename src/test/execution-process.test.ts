import * as assert from "node:assert";
import {
  findExecutionProcessRuns,
  type ExecutionProcessItemKind,
} from "../webview/render/execution-process.js";

suite("Execution process grouping", () => {
  test("groups contiguous thinking and tool steps between prose", () => {
    const kinds: ExecutionProcessItemKind[] = [
      "content",
      "process",
      "process",
      "process",
      "content",
      "process",
      "content",
    ];
    assert.deepStrictEqual(findExecutionProcessRuns(kinds), [
      { start: 1, length: 3 },
      { start: 5, length: 1 },
    ]);
  });

  test("groups process steps before the first and after the last prose block", () => {
    const kinds: ExecutionProcessItemKind[] = ["process", "content", "process", "process"];
    assert.deepStrictEqual(findExecutionProcessRuns(kinds), [
      { start: 0, length: 1 },
      { start: 2, length: 2 },
    ]);
  });

  test("leaves prose-only conversations ungrouped", () => {
    assert.deepStrictEqual(findExecutionProcessRuns(["content", "content"]), []);
  });
});

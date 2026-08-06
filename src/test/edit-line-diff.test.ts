import * as assert from "node:assert";
import { diffEditLines } from "../edit-line-diff.js";

suite("Edit line diffs", () => {
  test("keeps unchanged lines as context around a replacement", () => {
    assert.deepStrictEqual(
      diffEditLines("before\nreplace me\nafter\n", "before\nreplacement\nafter\n"),
      [
        { type: "context", line: "before" },
        { type: "removed", line: "replace me" },
        { type: "added", line: "replacement" },
        { type: "context", line: "after" },
      ],
    );
  });

  test("shows only inserted and removed lines as changes", () => {
    assert.deepStrictEqual(
      diffEditLines("one\ntwo\nfour", "one\nthree\nfour\nfive"),
      [
        { type: "context", line: "one" },
        { type: "removed", line: "two" },
        { type: "added", line: "three" },
        { type: "context", line: "four" },
        { type: "added", line: "five" },
      ],
    );
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  collectIssueReporters,
  extractPullRequestNumbers,
  formatIssueReporterSection,
} from "./release-notes-lib.mjs";

test("extracts unique pull request candidates from generated notes", () => {
  assert.deepEqual(
    extractPullRequestNumbers(
      "- Fix #47 in https://github.com/auchan/pi-on-code/pull/49\n" +
      "- Improve tools in #50\n- Duplicate #49",
    ),
    [47, 49, 50],
  );
});

test("collects and deduplicates issue reporters from closing references", () => {
  assert.deepEqual(
    collectIssueReporters([
      {
        closingIssuesReferences: {
          nodes: [
            { number: 48, author: { login: "auchan" } },
            { number: 47, author: { login: "wzwei1990" } },
          ],
        },
      },
      {
        closingIssuesReferences: {
          nodes: [{ number: 47, author: { login: "wzwei1990" } }],
        },
      },
      null,
    ]),
    [
      { issueNumber: 47, login: "wzwei1990" },
      { issueNumber: 48, login: "auchan" },
    ],
  );
});

test("formats an issue reporter acknowledgement section", () => {
  assert.equal(
    formatIssueReporterSection([
      { issueNumber: 47, login: "wzwei1990" },
      { issueNumber: 48, login: "auchan" },
    ]),
    "## Issue reporters\n\n" +
      "- Thanks @wzwei1990 for reporting #47.\n" +
      "- Thanks @auchan for reporting #48.",
  );
  assert.equal(formatIssueReporterSection([]), "");
});

import * as assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  forkSessionTitle,
  isUserMessageEntry,
  resolveUserMessageEditTarget,
  type SessionEntryLike,
} from "../user-message-branch.js";

const userEntry = (id: string, role = "user"): SessionEntryLike => ({
  id,
  type: "message",
  message: { role },
});

suite("User message branch helpers", () => {
  test("recognizes only persisted user message entries", () => {
    assert.ok(isUserMessageEntry(userEntry("u1")));
    assert.ok(!isUserMessageEntry({ id: "a1", type: "message", message: { role: "assistant" } }));
    assert.ok(!isUserMessageEntry({ id: "c1", type: "custom_message" }));
    assert.ok(!isUserMessageEntry({ id: "x" }));
  });

  test("branches at the preceding entry when the target is not first", () => {
    const entries = [
      userEntry("u1"),
      { id: "a1", type: "message", message: { role: "assistant" } },
      userEntry("u2"),
      { id: "t1", type: "message", message: { role: "assistant" } },
    ];
    assert.deepStrictEqual(resolveUserMessageEditTarget(entries, "u2"), {
      entryIndex: 2,
      predecessorId: "a1",
    });
  });

  test("has no predecessor for the first user message", () => {
    const entries = [userEntry("u1"), userEntry("u2")];
    assert.deepStrictEqual(resolveUserMessageEditTarget(entries, "u1"), {
      entryIndex: 0,
      predecessorId: null,
    });
  });

  test("rejects missing or non-user targets", () => {
    const entries = [userEntry("u1"), { id: "a1", type: "message", message: { role: "assistant" } }];
    assert.strictEqual(resolveUserMessageEditTarget(entries, "missing"), null);
    assert.strictEqual(resolveUserMessageEditTarget(entries, "a1"), null);
  });

  test("numbers fork titles from the base title", () => {
    assert.strictEqual(forkSessionTitle("Fix lint errors"), "Fix lint errors (2)");
    assert.strictEqual(forkSessionTitle("Fix lint errors (2)"), "Fix lint errors (3)");
    assert.strictEqual(forkSessionTitle("Fix lint errors (12)"), "Fix lint errors (13)");
    assert.strictEqual(forkSessionTitle("  "), "Untitled session (2)");
    assert.strictEqual(forkSessionTitle("<fork: Fix lint errors>"), "Fix lint errors (2)");
  });

  test("wires transcript actions through panel callbacks and commands", () => {
    const handlers = readFileSync(
      new URL("../../src/webview/handlers/index.ts", import.meta.url),
      "utf8",
    );
    assert.match(handlers, /user-message-edit/);
    assert.match(handlers, /user-message-fork/);
    assert.match(handlers, /className = "user-edit-btn"/);
    assert.match(handlers, /className = "assistant-fork-btn"/);
    assert.doesNotMatch(handlers, /className = "user-fork-btn"/);
    assert.match(handlers, /className = "assistant-turn-actions"/);
    assert.match(handlers, /className = "user-edit-input"/);
    assert.match(handlers, /className = "user-edit-actions"/);
    assert.match(handlers, /function setUserEditActionsEnabled\(enabled: boolean\)/);
    assert.match(handlers, /setUserEditActionsEnabled\(false\)/);
    assert.match(handlers, /setUserEditActionsEnabled\(true\)/);

    const panel = readFileSync(
      new URL("../../src/webview-panel.ts", import.meta.url),
      "utf8",
    );
    assert.match(panel, /case "user-message-edit"/);
    assert.match(panel, /case "user-message-fork"/);

    const extension = readFileSync(
      new URL("../../src/extension.ts", import.meta.url),
      "utf8",
    );
    assert.match(extension, /"pi-on-code\.editHistoryMessage"/);
    assert.match(extension, /"pi-on-code\.forkHistoryMessage"/);
    assert.match(extension, /Selected entry is not a persisted user message\./);
    assert.match(extension, /createBranchedSession\(predecessorId\)/);
    assert.match(extension, /sendPrompt\(text\)/);
    assert.match(extension, /forkSessionTitle\(title\)/);
    assert.match(extension, /\.message\?\.id === entryId/);
    assert.match(extension, /canEditSession\(sw\.isStreaming\)/);
    assert.match(extension, /waitForReplyStart\(/);
    assert.match(extension, /resolveEditOutcome\(observation\)/);
    assert.match(extension, /deleteSessionFileIfPresent\(forkedPath\)/);
    assert.match(extension, /Stop the current run before editing a historical message\./);
  });
});

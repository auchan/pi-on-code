import * as assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  forkSessionLabel,
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

  test("formats fork labels from the original title", () => {
    assert.strictEqual(forkSessionLabel("Fix lint errors"), "<fork: Fix lint errors>");
    assert.strictEqual(forkSessionLabel("  "), "<fork: Untitled session>");
    assert.strictEqual(forkSessionLabel(""), "<fork: Untitled session>");
  });

  test("caps fork labels by code points", () => {
    const long = "title ".repeat(30);
    const label = forkSessionLabel(long);
    assert.ok(label.startsWith("<fork: "));
    assert.ok(label.endsWith(">"));
    assert.ok(Array.from(label.slice(7, -1)).length <= 41, "label body stays near the cap");
  });

  test("wires transcript actions through panel callbacks and commands", () => {
    const handlers = readFileSync(
      new URL("../../src/webview/handlers/index.ts", import.meta.url),
      "utf8",
    );
    assert.match(handlers, /user-message-edit/);
    assert.match(handlers, /user-message-fork/);
    assert.match(handlers, /className = "user-edit-btn"/);
    assert.match(handlers, /className = "user-fork-btn"/);
    assert.match(handlers, /\.user-edit-overlay/);
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
    assert.match(extension, /resolveUserMessageEditTarget\(entries, entryId\)/);
    assert.match(extension, /createBranchedSession\(target\.predecessorId\)/);
    assert.match(extension, /sendPrompt\(text\)/);
    assert.match(extension, /forkSessionLabel\(title\)/);
    assert.match(extension, /canEditSession\(sw\.isStreaming\)/);
    assert.match(extension, /waitForReplyStart\(/);
    assert.match(extension, /resolveEditOutcome\(observation\)/);
    assert.match(extension, /deleteSessionFileIfPresent\(forkedPath\)/);
    assert.match(extension, /Stop the current run before editing a historical message\./);
  });
});

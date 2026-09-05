import * as assert from "node:assert";
import {
  canEditSession,
  resolveEditOutcome,
  waitForReplyStart,
} from "../edit-flow.js";

suite("Message rewrite flow decisions", () => {
  test("never allows editing or superseding a running session", () => {
    assert.ok(canEditSession(false));
    assert.ok(!canEditSession(true));
  });

  test("commits once the replacement reply actually starts", async () => {
    let streaming = false;
    const start = waitForReplyStart(
      () => streaming,
      () => false,
      { timeoutMs: 1000, delayMs: 5 },
    );
    await new Promise((resolve) => setTimeout(resolve, 15));
    streaming = true;
    const observation = await start;
    assert.deepStrictEqual(observation, { started: true, promptDone: false });
    assert.strictEqual(resolveEditOutcome(observation), "keep");
  });

  test("rolls back when the prompt settles without starting a run", async () => {
    let done = false;
    const waiting = waitForReplyStart(
      () => false,
      () => done,
      { timeoutMs: 1000, delayMs: 5 },
    );
    done = true;
    const observation = await waiting;
    assert.deepStrictEqual(observation, { started: false, promptDone: true });
    assert.strictEqual(resolveEditOutcome(observation), "rollback");
  });

  test("rolls back a stalled prompt that never starts or settles", async () => {
    const observation = await waitForReplyStart(
      () => false,
      () => false,
      { timeoutMs: 20, delayMs: 5 },
    );
    assert.deepStrictEqual(observation, { started: false, promptDone: false });
    assert.strictEqual(resolveEditOutcome(observation), "rollback");
  });

  test("keeps the replacement even when a started run later fails", () => {
    assert.strictEqual(resolveEditOutcome({ started: true, promptDone: true }), "keep");
  });
});

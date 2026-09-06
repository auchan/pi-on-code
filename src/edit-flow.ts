/**
 * Decision helpers for the destructive message-rewrite flow. Keeping these
 * pure makes the rollback / delete-ordering semantics testable without an SDK.
 */

export interface ReplyStartObservation {
  /** True once the replacement agent run actually started streaming. */
  started: boolean;
  /** True once the sendPrompt promise settled (success or error). */
  promptDone: boolean;
}

export interface WaitForReplyStartOptions {
  timeoutMs?: number;
  delayMs?: number;
}

/**
 * Watch a freshly issued prompt until either the agent run starts, the prompt
 * settles without starting, or the timeout elapses. Delays are real timers so
 * tests may pass small values.
 */
export async function waitForReplyStart(
  isStreaming: () => boolean,
  isPromptDone: () => boolean,
  options: WaitForReplyStartOptions = {},
): Promise<ReplyStartObservation> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const delayMs = options.delayMs ?? 40;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const started = isStreaming();
    const promptDone = isPromptDone();
    if (started || promptDone) { return { started, promptDone }; }
    if (Date.now() >= deadline) { return { started: false, promptDone: false }; }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

export type EditOutcome = "keep" | "rollback";

/**
 * Commit the rewrite once the reply has started (content is being produced):
 * later aborts or API errors keep the replacement session. Roll back (and
 * delete the forked file) only when the prompt never produced a run — either
 * it failed or it stalled without starting.
 */
export function resolveEditOutcome(observation: ReplyStartObservation): EditOutcome {
  if (observation.started) { return "keep"; }
  if (observation.promptDone) { return "rollback"; }
  return "rollback";
}

/** A running session must never be branched from or superseded. */
export function canEditSession(isStreaming: boolean): boolean {
  return !isStreaming;
}

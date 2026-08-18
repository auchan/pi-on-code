import * as assert from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../src/session-sidebar-provider.ts", import.meta.url),
  "utf8",
);

suite("Session sidebar archive UI", () => {
  test("keeps the embedded Webview script syntactically valid", () => {
    const script = source.match(/<script nonce="\$\{nonce\}">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script, "embedded sidebar script not found");
    assert.doesNotThrow(() => new Function(script));
  });

  test("opens archived sessions from a title action instead of an inline group", () => {
    assert.match(source, /id="session-archive-open"[^>]*hidden/);
    assert.match(source, /id="session-archive-view"[^>]*hidden/);
    assert.doesNotMatch(source, /session-archive-group/);
    assert.doesNotMatch(source, /session-archive-count/);
  });

  test("animates archived rows toward the archive action", () => {
    assert.match(source, /function animateSessionIntoArchive\(/);
    assert.match(source, /clone\.animate\(/);
    assert.match(source, /animateSessionIntoArchive\(row, session\)/);
  });
});

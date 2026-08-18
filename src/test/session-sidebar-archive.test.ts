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

  test("groups archived sessions by directory in multi-root workspaces", () => {
    assert.match(source, /function renderArchivedSessions\(sessions, directories\)/);
    assert.match(source, /if \(directories\.length <= 1\)/);
    assert.match(source, /function sessionDirectoryName\(directory\)/);
    assert.match(source, /heading\.append\(createDirectoryIcon\(\), document\.createTextNode\(group\.name\)\)/);
  });

  test("shows an exact timestamp beneath archived session titles", () => {
    assert.match(source, /function formatSessionTimestamp\(timestamp\)/);
    assert.match(source, /archived \? formatSessionTimestamp\(session\.activity\)/);
    assert.match(source, /\.session-row\.archived \.meta/);
  });

  test("animates archived rows toward the archive action", () => {
    assert.match(source, /function animateSessionIntoArchive\(/);
    assert.match(source, /clone\.animate\(/);
    assert.match(source, /animateSessionIntoArchive\(row, session\)/);
  });

  test("pulses the archive icon after receiving a session", () => {
    assert.match(source, /@keyframes session-archive-receive/);
    assert.match(source, /function pulseArchiveIcon\(\)/);
    assert.match(source, /clone\.remove\(\);\s*pulseArchiveIcon\(\);/);
  });
});

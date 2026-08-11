import * as assert from "node:assert";
import { resolveToolTitle } from "../webview/render/tool-title.js";

suite("Webview tool card title", () => {
  test("resolves consolidated tool titles as vscode_<action>", () => {
    assert.strictEqual(
      resolveToolTitle("vscode_workspace_tool", { action: "open_file", filePath: "a.ts" }),
      "vscode_open_file",
    );
    assert.strictEqual(
      resolveToolTitle("vscode_workspace_tool", { action: "diagnostics" }),
      "vscode_diagnostics",
    );
    assert.strictEqual(
      resolveToolTitle("vscode_workspace_tool", { action: "help" }),
      "vscode_help",
    );
  });

  test("falls back to the plain tool name when action is missing", () => {
    assert.strictEqual(resolveToolTitle("vscode_workspace_tool", {}), "vscode_workspace_tool");
    assert.strictEqual(resolveToolTitle("vscode_workspace_tool"), "vscode_workspace_tool");
    assert.strictEqual(resolveToolTitle("read", { path: "a.ts" }), "read");
  });

  test("uses toolName - action for other consolidated-style tools", () => {
    assert.strictEqual(
      resolveToolTitle("my_tool", { action: "sync" }),
      "my_tool - sync",
    );
  });
});

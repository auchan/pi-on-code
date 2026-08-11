import * as assert from "node:assert";
import { resolveToolTitle } from "../webview/render/tool-title.js";

suite("Webview tool card title", () => {
  test("appends the action to the consolidated tool name", () => {
    assert.strictEqual(
      resolveToolTitle("vscode_workspace_tool", { action: "open_file", filePath: "a.ts" }),
      "vscode_workspace_tool - open_file",
    );
    assert.strictEqual(
      resolveToolTitle("vscode_workspace_tool", { action: "diagnostics" }),
      "vscode_workspace_tool - diagnostics",
    );
    assert.strictEqual(
      resolveToolTitle("vscode_workspace_tool", { action: "help" }),
      "vscode_workspace_tool - help",
    );
  });

  test("falls back to the plain tool name when action is missing", () => {
    assert.strictEqual(resolveToolTitle("vscode_workspace_tool", {}), "vscode_workspace_tool");
    assert.strictEqual(resolveToolTitle("vscode_workspace_tool"), "vscode_workspace_tool");
    assert.strictEqual(resolveToolTitle("read", { path: "a.ts" }), "read");
  });

  test("uses the same dash format for other consolidated-style tools", () => {
    assert.strictEqual(
      resolveToolTitle("my_tool", { action: "sync" }),
      "my_tool - sync",
    );
  });
});

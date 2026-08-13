import * as assert from "node:assert";
import {
  formatToolCallForCopy,
  formatToolHeaderArguments,
  resolveToolTitle,
} from "../webview/render/tool-title.js";

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

  test("serializes generic tool arguments for header display", () => {
    assert.strictEqual(
      formatToolHeaderArguments({ query: "recent errors", limit: 10 }),
      '{"query":"recent errors","limit":10}',
    );
    assert.strictEqual(formatToolHeaderArguments({}), undefined);
    assert.strictEqual(formatToolHeaderArguments(), undefined);
  });

  test("serializes complete tool calls for copying", () => {
    assert.strictEqual(
      formatToolCallForCopy("mcp", { tool: "chrome_click", args: { uid: "1_2" } }),
      'mcp {\n  "tool": "chrome_click",\n  "args": {\n    "uid": "1_2"\n  }\n}',
    );
    assert.strictEqual(formatToolCallForCopy("read", {}), "read {}");
    assert.strictEqual(formatToolCallForCopy("read"), undefined);
  });

  test("copies only the command for bash calls", () => {
    assert.strictEqual(
      formatToolCallForCopy("bash", { command: "bun run build", timeout: 600 }),
      "bun run build",
    );
  });
});

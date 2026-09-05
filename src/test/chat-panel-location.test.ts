import * as assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  DEFAULT_CHAT_PANEL_LOCATION,
  parseChatPanelLocation,
  resolveChatColumnTarget,
} from "../chat-panel-location.js";

suite("Chat panel location", () => {
  test("defaults to splitPanel for missing or invalid values", () => {
    assert.strictEqual(DEFAULT_CHAT_PANEL_LOCATION, "splitPanel");
    assert.strictEqual(parseChatPanelLocation(undefined), "splitPanel");
    assert.strictEqual(parseChatPanelLocation("sidebar-left"), "splitPanel");
    assert.strictEqual(parseChatPanelLocation(42), "splitPanel");
  });

  test("accepts the three documented locations", () => {
    assert.strictEqual(parseChatPanelLocation("panel"), "panel");
    assert.strictEqual(parseChatPanelLocation("splitPanel"), "splitPanel");
    assert.strictEqual(parseChatPanelLocation("secondarySideBar"), "secondarySideBar");
  });

  test("panel mode opens in the active editor group without splitting", () => {
    assert.deepStrictEqual(
      resolveChatColumnTarget("panel", [1, 2]),
      { kind: "active" },
    );
  });

  test("splitPanel mode always splits to the right of the active group", () => {
    assert.deepStrictEqual(
      resolveChatColumnTarget("splitPanel", [1, 2, 3]),
      { kind: "beside" },
    );
  });

  test("secondarySideBar stacks new chats into the right-most chat column", () => {
    assert.deepStrictEqual(
      resolveChatColumnTarget("secondarySideBar", [1, 3]),
      { kind: "column", column: 3 },
    );
  });

  test("secondarySideBar splits once when no chat column exists yet", () => {
    assert.deepStrictEqual(
      resolveChatColumnTarget("secondarySideBar", []),
      { kind: "beside" },
    );
  });

  test("publishes a matching configuration property", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as {
      contributes: {
        configuration: {
          properties: Record<string, {
            default: unknown;
            enum?: unknown[];
            enumDescriptions?: unknown[];
          }>;
        };
      };
    };
    const property = manifest.contributes.configuration.properties["pi-on-code.chatPanelLocation"];
    assert.ok(property, "pi-on-code.chatPanelLocation property is missing");
    assert.strictEqual(property.default, "splitPanel");
    assert.deepStrictEqual(property.enum, ["panel", "splitPanel", "secondarySideBar"]);
    assert.strictEqual(property.enumDescriptions?.length, 3);
  });

  test("new-session creation consults the setting and panel column", () => {
    const extension = readFileSync(
      new URL("../../src/extension.ts", import.meta.url),
      "utf8",
    );
    assert.match(extension, /parseChatPanelLocation\(/);
    assert.match(extension, /getConfiguration\("pi-on-code"\)\.get\("chatPanelLocation"\)/);
    assert.match(extension, /resolveChatColumnTarget\(location, openChatColumns\)/);
    assert.match(extension, /sw\.webviewPanel\.show\(viewColumn\)/);
    const panel = readFileSync(
      new URL("../../src/webview-panel.ts", import.meta.url),
      "utf8",
    );
    assert.match(panel, /async show\(column\?: vscode\.ViewColumn\)/);
    assert.match(panel, /column \?\? vscode\.ViewColumn\.Two/);
  });
});

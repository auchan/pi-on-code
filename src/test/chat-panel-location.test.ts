import * as assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  DEFAULT_CHAT_PANEL_LOCATION,
  parseChatPanelLocation,
} from "../chat-panel-location.js";

suite("Chat panel location", () => {
  test("defaults to splitPanel for missing or invalid values", () => {
    assert.strictEqual(DEFAULT_CHAT_PANEL_LOCATION, "splitPanel");
    assert.strictEqual(parseChatPanelLocation(undefined), "splitPanel");
    assert.strictEqual(parseChatPanelLocation("sidebar-left"), "splitPanel");
    assert.strictEqual(parseChatPanelLocation(42), "splitPanel");
  });

  test("accepts the two documented locations", () => {
    assert.strictEqual(parseChatPanelLocation("panel"), "panel");
    assert.strictEqual(parseChatPanelLocation("splitPanel"), "splitPanel");
  });

  test("publishes new (panel) and resume/fork (splitPanel) properties", () => {
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
    const newProp = manifest.contributes.configuration.properties["pi-on-code.newChatPanelLocation"];
    const resumeProp = manifest.contributes.configuration.properties["pi-on-code.chatPanelLocation"];
    assert.ok(newProp, "pi-on-code.newChatPanelLocation property is missing");
    assert.strictEqual(newProp.default, "panel");
    assert.deepStrictEqual(newProp.enum, ["panel", "splitPanel"]);
    assert.ok(resumeProp, "pi-on-code.chatPanelLocation property is missing");
    assert.strictEqual(resumeProp.default, "splitPanel");
    assert.deepStrictEqual(resumeProp.enum, ["panel", "splitPanel"]);
  });

  test("routes new chats through newChatPanelLocation and resumes/forks through chatPanelLocation", () => {
    const extension = readFileSync(
      new URL("../../src/extension.ts", import.meta.url),
      "utf8",
    );
    assert.match(extension, /function chatShowColumn\(key: string\)/);
    assert.match(extension, /sw\.webviewPanel\.show\(chatShowColumn\("newChatPanelLocation"\)\)/);
    assert.match(extension, /newSw\.webviewPanel\.show\(chatShowColumn\("chatPanelLocation"\)\)/);
    assert.match(extension, /await sw\.webviewPanel\.show\(chatShowColumn\("chatPanelLocation"\)\)/);
  });
});

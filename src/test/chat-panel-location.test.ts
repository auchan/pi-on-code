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
    assert.deepStrictEqual(property.enum, ["panel", "splitPanel"]);
    assert.strictEqual(property.enumDescriptions?.length, 2);
  });

  test("routes new, resumed, and forked chats through the shared column helper", () => {
    const extension = readFileSync(
      new URL("../../src/extension.ts", import.meta.url),
      "utf8",
    );
    assert.match(extension, /function chatShowColumn\(\)/);
    assert.match(extension, /parseChatPanelLocation\(/);
    assert.match(extension, /chatPanelLocation/);
    assert.match(extension, /sw\.webviewPanel\.show\(chatShowColumn\(\)\)/);
    assert.match(extension, /newSw\.webviewPanel\.show\(chatShowColumn\(\)\)/);
    // Resume path also follows the setting.
    assert.match(extension, /await sw\.webviewPanel\.show\(chatShowColumn\(\)\)/);
  });
});

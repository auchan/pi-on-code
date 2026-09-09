import * as assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  DEFAULT_CHAT_PANEL_LOCATION,
  parseChatPanelLocation,
} from "../chat-panel-location.js";

suite("Chat panel location", () => {
  test("defaults to panel for missing or invalid values", () => {
    assert.strictEqual(DEFAULT_CHAT_PANEL_LOCATION, "panel");
    assert.strictEqual(parseChatPanelLocation(undefined), "panel");
    assert.strictEqual(parseChatPanelLocation("sidebar-left"), "panel");
    assert.strictEqual(parseChatPanelLocation(42), "panel");
  });

  test("accepts the two editor placements", () => {
    assert.strictEqual(parseChatPanelLocation("panel"), "panel");
    assert.strictEqual(parseChatPanelLocation("splitPanel"), "splitPanel");
  });

  test("publishes only the single newChatPanelLocation property", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as {
      contributes: {
        configuration: {
          properties: Record<string, { default?: unknown; enum?: unknown[] }>;
        };
      };
    };
    const property = manifest.contributes.configuration.properties["pi-on-code.newChatPanelLocation"];
    assert.ok(property, "pi-on-code.newChatPanelLocation property is missing");
    assert.strictEqual(property.default, "panel");
    assert.deepStrictEqual(property.enum, ["panel", "splitPanel"]);
    assert.ok(
      !("pi-on-code.chatPanelLocation" in manifest.contributes.configuration.properties),
      "the duplicate chatPanelLocation property must be gone",
    );
  });

  test("new chats honor newChatPanelLocation; resume/fork use the default column", () => {
    const extension = readFileSync(
      new URL("../../src/extension.ts", import.meta.url),
      "utf8",
    );
    assert.match(extension, /chatShowColumn\("newChatPanelLocation"\)/);
    assert.doesNotMatch(extension, /chatShowColumn\("chatPanelLocation"\)/);
    assert.doesNotMatch(extension, /"chatPanelLocation"/);
    // Resume and fork fall back to the plain historical default show().
    assert.match(extension, /void newSw\.webviewPanel\.show\(\);/);
    assert.match(extension, /await sw\.webviewPanel\.show\(\);/);
  });
});

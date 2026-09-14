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

  test("publishes exactly one chatPanelLocation property defaulting to panel", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as {
      contributes: {
        configuration: {
          properties: Record<string, { default?: unknown; enum?: unknown[] }>;
        };
      };
    };
    const properties = manifest.contributes.configuration.properties;
    const property = properties["pi-on-code.chatPanelLocation"];
    assert.ok(property, "pi-on-code.chatPanelLocation property is missing");
    assert.strictEqual(property.default, "panel");
    assert.deepStrictEqual(property.enum, ["panel", "splitPanel"]);
    assert.ok(
      !("pi-on-code.newChatPanelLocation" in properties),
      "the duplicate newChatPanelLocation property must be gone",
    );
  });

  test("new, resumed, and forked chats all follow chatPanelLocation", () => {
    const extension = readFileSync(
      new URL("../../src/extension.ts", import.meta.url),
      "utf8",
    );
    assert.match(extension, /void sw\.webviewPanel\.show\(chatShowColumn\("chatPanelLocation"\)\);/);
    assert.match(extension, /void newSw\.webviewPanel\.show\(chatShowColumn\("chatPanelLocation"\)\);/);
    assert.match(extension, /await sw\.webviewPanel\.show\(chatShowColumn\("chatPanelLocation"\)\);/);
    assert.doesNotMatch(extension, /newChatPanelLocation/);
    const occurrences = extension.match(/chatShowColumn\("chatPanelLocation"\)/g)?.length ?? 0;
    assert.strictEqual(occurrences, 3, "new, resume, and fork must share the single setting");
  });
});

import * as assert from "node:assert";
import { readFileSync } from "node:fs";
import { extensionSettingsQuery } from "../vscode-settings.js";

suite("VS Code settings entry", () => {
  test("builds an @ext filter from publisher and name", () => {
    assert.strictEqual(extensionSettingsQuery("auchan", "pion-code"), "@ext:auchan.pion-code");
  });

  test("falls back to the known extension identity", () => {
    assert.strictEqual(extensionSettingsQuery(undefined, undefined), "@ext:auchan.pion-code");
    assert.strictEqual(extensionSettingsQuery("  ", "  "), "@ext:auchan.pion-code");
  });

  test("gear opens the quick settings panel with a full VS Code settings link", () => {
    const handlers = readFileSync(
      new URL("../../src/webview/handlers/index.ts", import.meta.url),
      "utf8",
    );
    assert.match(handlers, /pi-sb-settings/);
    assert.match(handlers, /toggleSettingsPanel\(\);/);
    assert.match(handlers, /settings-open-vscode/);
    assert.match(handlers, /postMessage\(\{ type: "openVscodeSettings" \}\)/);

    const panel = readFileSync(
      new URL("../../src/webview-panel.ts", import.meta.url),
      "utf8",
    );
    assert.match(panel, /case "openVscodeSettings"/);
    assert.match(panel, /extensionSettingsQuery\(pkg\.publisher, pkg\.name\)/);
    assert.match(panel, /"workbench\.action\.openSettings"/);
    assert.match(panel, /Open Pi settings/);
  });
});

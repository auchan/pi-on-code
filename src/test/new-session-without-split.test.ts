import * as assert from "node:assert";
import { readFileSync } from "node:fs";

const extension = readFileSync(
  new URL("../../src/extension.ts", import.meta.url),
  "utf8",
);
const panel = readFileSync(
  new URL("../../src/webview-panel.ts", import.meta.url),
  "utf8",
);

suite("New session without split", () => {
  test("publishes a boolean configuration defaulting to false", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as {
      contributes: {
        configuration: {
          properties: Record<string, { type: string; default: unknown }>;
        };
      };
    };
    const property = manifest.contributes.configuration.properties["pi-on-code.newSessionWithoutSplit"];
    assert.ok(property, "pi-on-code.newSessionWithoutSplit property is missing");
    assert.strictEqual(property.type, "boolean");
    assert.strictEqual(property.default, false);
  });

  test("new sessions open in the active group when enabled", () => {
    assert.match(
      extension,
      /getConfiguration\("pi-on-code"\)\s*\n?\s*\.get<boolean>\("newSessionWithoutSplit", false\)/,
    );
    assert.match(
      extension,
      /sw\.webviewPanel\.show\(withoutSplit \? vscode\.ViewColumn\.Active : undefined\)/,
    );
  });

  test("keeps the historical split default when disabled", () => {
    assert.match(panel, /async show\(column\?: vscode\.ViewColumn\)/);
    assert.match(panel, /column \?\? vscode\.ViewColumn\.Two/);
    assert.match(extension, /show\(withoutSplit \? vscode\.ViewColumn\.Active : undefined\)/);
  });
});

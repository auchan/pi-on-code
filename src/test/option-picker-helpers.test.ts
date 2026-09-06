import * as assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  buildBudgetOptions,
  buildEffortOptions,
  buildThinkingOptions,
  fuzzyFilterOptions,
  orderItemsByRecent,
  resolvePickerPlacement,
  STATUS_PICKER_META,
  type PickerOptionItem,
} from "../webview/render/option-picker-helpers.js";

const items: PickerOptionItem[] = [
  { key: "claude", label: "Claude Sonnet 4.5", description: "anthropic · $3/m" },
  { key: "gpt", label: "GPT 4o", description: "openai" },
  { key: "deepseek", label: "DeepSeek V3", description: "deepseek" },
];

suite("Option picker helpers", () => {
  test("fuzzy filters across label and description with tokens", () => {
    assert.deepStrictEqual(
      fuzzyFilterOptions(items, "DEEP").map((item) => item.key),
      ["deepseek"],
    );
    assert.deepStrictEqual(
      fuzzyFilterOptions(items, "claude anthr").map((item) => item.key),
      ["claude"],
    );
    assert.strictEqual(fuzzyFilterOptions(items, "").length, 3);
    assert.strictEqual(fuzzyFilterOptions(items, "zzz").length, 0);
  });

  test("orders recently selected keys first", () => {
    assert.deepStrictEqual(
      orderItemsByRecent(items, ["deepseek", "claude"]).map((item) => item.key),
      ["deepseek", "claude", "gpt"],
    );
    // Missing recent keys are ignored.
    assert.deepStrictEqual(
      orderItemsByRecent(items, ["gpt", "nope"]).map((item) => item.key),
      ["gpt", "claude", "deepseek"],
    );
  });

  test("clamps four-corner placement inside the viewport", () => {
    const anchor = { top: 800, left: 600, right: 1000, bottom: 830, width: 400, height: 30 };
    const size = { width: 320, height: 400 };
    const viewport = { width: 1000, height: 900, margin: 8 };

    const bottomRight = resolvePickerPlacement(anchor, "bottomRight", size, viewport);
    assert.strictEqual(bottomRight.left, 672); // right edge aligned then clamped inside
    assert.strictEqual(bottomRight.top, 492); // pushed up so the whole menu stays on screen

    const topLeft = resolvePickerPlacement(anchor, "topLeft", size, viewport);
    assert.strictEqual(topLeft.left, 600);
    assert.strictEqual(topLeft.top, 392);

    // A huge anchor near the bottom-right corner keeps both axes on screen.
    const corner = resolvePickerPlacement(
      { top: 890, left: 900, right: 990, bottom: 899, width: 90, height: 9 },
      "topRight",
      size,
      viewport,
    );
    assert.ok(corner.left >= 8 && corner.left + size.width <= 1000 - 8);
    assert.ok(corner.top >= 8 && corner.top + size.height <= 900 - 8);
  });

  test("caps the panel so measured height matches the placement height", () => {
    const styles = readFileSync(
      new URL("../../media/style.css", import.meta.url),
      "utf8",
    ).replace(/\r\n/g, "\n");
    const panelBlock = styles.match(/\.option-picker \{\n[\s\S]*?\n\}/)?.[0] ?? "";
    assert.match(panelBlock, /max-height: min\(60vh, 400px\)/);
    assert.match(
      styles,
      /\.option-picker-list \{\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow-y: auto;/,
    );
    // Placement is computed against the capped height even when content is long.
    const tall = resolvePickerPlacement(
      { top: 860, left: 500, right: 820, bottom: 899, width: 320, height: 39 },
      "bottomLeft",
      { width: 320, height: 400 },
      { width: 1000, height: 900, margin: 8 },
    );
    assert.ok(tall.top >= 8 && tall.top + 400 <= 900 - 8);
  });

  test("builds thinking options with current and default markers", () => {
    const options = buildThinkingOptions("low", "off");
    const low = options.find((option) => option.key === "low");
    const off = options.find((option) => option.key === "off");
    assert.strictEqual(low?.selected, true);
    assert.strictEqual(low?.icon, "●");
    assert.ok(off?.label.includes("★"), "default level is starred");
  });

  test("builds effort and budget options with the current value marked", () => {
    const effort = buildEffortOptions("high");
    assert.strictEqual(effort.find((option) => option.key === "high")?.icon, "●");
    assert.strictEqual(effort.find((option) => option.key === "high")?.selected, true);

    const budget = buildBudgetOptions(200000);
    assert.strictEqual(budget.find((option) => option.key === "200000")?.selected, true);
    assert.strictEqual(budget.find((option) => option.key === "0")?.label, "Model default");
  });

  test("exposes metadata for every status picker kind", () => {
    assert.deepStrictEqual(Object.keys(STATUS_PICKER_META).sort(), ["budget", "effort", "model", "thinking"]);
  });

  test("wires the picker end-to-end across webview, host, and protocol", () => {
    const protocol = readFileSync(new URL("../../src/shared/protocol.ts", import.meta.url), "utf8");
    assert.match(protocol, /z\.literal\("picker-options"\)/);
    assert.match(protocol, /z\.literal\("requestPickerOptions"\)/);
    assert.match(protocol, /z\.literal\("applyPickerOption"\)/);

    const handlers = readFileSync(new URL("../../src/webview/handlers/index.ts", import.meta.url), "utf8");
    assert.match(handlers, /requestStatusPicker\("model", sbModel\)/);
    assert.match(handlers, /requestStatusPicker\("thinking", sbThinking\)/);
    assert.match(handlers, /requestStatusPicker\("effort", sbEffort\)/);
    assert.match(handlers, /requestStatusPicker\("budget", sbUsage\)/);
    assert.match(handlers, /case "picker-options":/);

    const panel = readFileSync(new URL("../../src/webview-panel.ts", import.meta.url), "utf8");
    assert.match(panel, /case "requestPickerOptions"/);
    assert.match(panel, /case "applyPickerOption"/);
    assert.match(panel, /buildStatusPickerOptions\(message\.kind\)/);
    assert.match(panel, /applyStatusPickerOption\(message\.kind, message\.key\)/);

    const service = readFileSync(new URL("../../src/pi-service.ts", import.meta.url), "utf8");
    assert.match(service, /async buildStatusPickerOptions/);
    assert.match(service, /async applyStatusPickerOption/);
  });
});

import * as assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  DEFAULT_MODEL_LIST_REFRESH_MINUTES,
  getSharedModelListRefreshedAt,
  markModelListRefreshed,
  modelListRefreshMaxAgeMs,
  resetModelListRefreshClock,
  shouldRefreshModelList,
} from "../model-refresh.js";

suite("Model list auto refresh", () => {
  test("uses 30 minutes as the default staleness window", () => {
    assert.strictEqual(DEFAULT_MODEL_LIST_REFRESH_MINUTES, 30);
    assert.strictEqual(modelListRefreshMaxAgeMs(undefined), 30 * 60_000);
    assert.strictEqual(modelListRefreshMaxAgeMs(15), 15 * 60_000);
  });

  test("disables auto refresh for zero, negative, or invalid values", () => {
    assert.strictEqual(modelListRefreshMaxAgeMs(0), 0);
    assert.strictEqual(modelListRefreshMaxAgeMs(-5), 0);
    assert.strictEqual(modelListRefreshMaxAgeMs("30"), 30 * 60_000); // non-number falls back to default
    assert.strictEqual(shouldRefreshModelList(0, 10_000_000, 0), false);
  });

  test("refreshes a never-populated list and stale lists only", () => {
    const maxAge = 30 * 60_000;
    assert.strictEqual(shouldRefreshModelList(null, 0, maxAge), true);
    assert.strictEqual(shouldRefreshModelList(1_000, 1_000 + maxAge - 1, maxAge), false);
    assert.strictEqual(shouldRefreshModelList(1_000, 1_000 + maxAge, maxAge), true);
    assert.strictEqual(shouldRefreshModelList(1_000, 1_000 + maxAge * 3, maxAge), true);
  });

  test("shares the refresh clock across sessions", () => {
    resetModelListRefreshClock();
    const maxAge = 30 * 60_000;
    assert.strictEqual(getSharedModelListRefreshedAt(), null);
    assert.strictEqual(shouldRefreshModelList(getSharedModelListRefreshedAt(), 5_000, maxAge), true);

    markModelListRefreshed(1_000);
    assert.strictEqual(getSharedModelListRefreshedAt(), 1_000);
    // A sibling session created afterwards sees the fresh shared timestamp.
    assert.strictEqual(shouldRefreshModelList(getSharedModelListRefreshedAt(), 1_000 + maxAge - 1, maxAge), false);
    assert.strictEqual(shouldRefreshModelList(getSharedModelListRefreshedAt(), 1_000 + maxAge, maxAge), true);

    resetModelListRefreshClock();
    assert.strictEqual(getSharedModelListRefreshedAt(), null);
  });

  test("covers every model-list surface and rebuilds the cycle order", () => {
    const service = readFileSync(
      new URL("../../src/pi-service.ts", import.meta.url),
      "utf8",
    );
    const pickModelIndex = service.indexOf("async pickModel(): Promise<boolean> {");
    const pickModelGuard = service.indexOf("await this.ensureModelListFresh();", pickModelIndex);
    assert.ok(pickModelIndex >= 0, "pickModel must exist");
    assert.ok(pickModelGuard > pickModelIndex, "pickModel must refresh a stale list first");

    const builderIndex = service.indexOf("async buildStatusPickerOptions(");
    const builderGuard = service.indexOf("await this.ensureModelListFresh();", builderIndex);
    const readIndex = service.indexOf("const available = await this.getAvailableModels();", builderIndex);
    assert.ok(builderGuard > builderIndex && builderGuard < readIndex, "the picker builder refreshes before reading models");

    assert.match(service, /await this\.rebuildCycleModels\(\);/);
    assert.match(service, /this\.cycleModels = available\.map\(\(m\) => \(\{ provider: m\.provider, id: m\.id \}\)\);/);
    assert.match(service, /shouldRefreshModelList\(getSharedModelListRefreshedAt\(\), Date\.now\(\), maxAgeMs\)/);
  });

  test("wires the setting through the model picker path", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as {
      contributes: {
        configuration: {
          properties: Record<string, { type?: string; default?: unknown; minimum?: number }>;
        };
      };
    };
    const property = manifest.contributes.configuration.properties["pi-on-code.modelListRefreshMinutes"];
    assert.ok(property, "pi-on-code.modelListRefreshMinutes property is missing");
    assert.strictEqual(property.type, "number");
    assert.strictEqual(property.default, 30);
    assert.strictEqual(property.minimum, 0);

    const service = readFileSync(
      new URL("../../src/pi-service.ts", import.meta.url),
      "utf8",
    );
    assert.match(service, /get<number>\("modelListRefreshMinutes", DEFAULT_MODEL_LIST_REFRESH_MINUTES\)/);
    assert.match(service, /await this\.modelRegistry\.refresh\(\);/);
    assert.match(service, /await this\.ensureModelListFresh\(\);/);
  });
});

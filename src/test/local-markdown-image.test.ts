import * as assert from "node:assert";
import { getLocalMarkdownImagePath } from "../local-markdown-image.js";

suite("Local Markdown images", () => {
  test("accepts file URLs for supported image types", () => {
    assert.strictEqual(
      getLocalMarkdownImagePath("file:///workspace/generated/cat%20image.png"),
      "/workspace/generated/cat image.png",
    );
    assert.strictEqual(
      getLocalMarkdownImagePath("file:///workspace/generated/diagram.SVG"),
      "/workspace/generated/diagram.SVG",
    );
  });

  test("rejects non-file URLs and non-image files", () => {
    assert.strictEqual(getLocalMarkdownImagePath("https://example.com/image.png"), undefined);
    assert.strictEqual(getLocalMarkdownImagePath("file:///workspace/.env"), undefined);
    assert.strictEqual(getLocalMarkdownImagePath("not a URL"), undefined);
  });
});

import * as assert from "node:assert";
import * as path from "node:path";
import {
  getLocalMarkdownImagePath,
  resolveMarkdownImagePath,
} from "../local-markdown-image.js";

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

  test("resolves workspace-relative paths including backslashes", () => {
    const root = path.resolve("/workspace");
    assert.strictEqual(
      resolveMarkdownImagePath("media\\architecture.png", [root]),
      path.join(root, "media", "architecture.png"),
    );
    assert.strictEqual(
      resolveMarkdownImagePath("media/architecture.png", [root]),
      path.join(root, "media", "architecture.png"),
    );
    assert.strictEqual(
      resolveMarkdownImagePath("docs/../media/a.png", [root]),
      path.join(root, "media", "a.png"),
    );
  });

  test("accepts absolute paths and passes security to the sandbox", () => {
    const root = path.resolve("/workspace");
    assert.strictEqual(
      resolveMarkdownImagePath("C:\\Users\\me\\pic.png", [root]),
      "C:/Users/me/pic.png",
    );
    assert.strictEqual(
      resolveMarkdownImagePath("/etc/screenshots/a.png", [root]),
      "/etc/screenshots/a.png",
    );
  });

  test("keeps external protocols unresolved", () => {
    const root = path.resolve("/workspace");
    assert.strictEqual(resolveMarkdownImagePath("https://example.com/a.png", [root]), undefined);
    assert.strictEqual(resolveMarkdownImagePath("data:image/png;base64,AAA", [root]), undefined);
    assert.strictEqual(resolveMarkdownImagePath("media/notes.txt", [root]), undefined);
  });
});

import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  getLocalMarkdownImagePath,
  getMarkdownImageMediaType,
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

  test("removes invisible direction characters from copied file URLs", () => {
    const pathWithDirectionMark = getLocalMarkdownImagePath(
      "file:///\u202AE:/workroom/image-gen/final/impostor-color.png",
    );
    const encodedDirectionMark = getLocalMarkdownImagePath(
      "file:///%E2%80%AAE:/workroom/image-gen/final/impostor-color.png",
    );
    const expected = process.platform === "win32"
      ? "E:/workroom/image-gen/final/impostor-color.png"
      : "/E:/workroom/image-gen/final/impostor-color.png";
    assert.strictEqual(pathWithDirectionMark, expected);
    assert.strictEqual(encodedDirectionMark, expected);
  });

  test("maps supported image extensions to media types", () => {
    assert.strictEqual(getMarkdownImageMediaType("picture.png"), "image/png");
    assert.strictEqual(getMarkdownImageMediaType("picture.SVG"), "image/svg+xml");
    assert.strictEqual(getMarkdownImageMediaType("notes.txt"), undefined);
  });

  test("resolves relative paths against base dirs by existence", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-img-"));
    try {
      const nested = path.join(dir, "assets");
      fs.mkdirSync(nested, { recursive: true });
      fs.writeFileSync(path.join(nested, "a.png"), "x");
      fs.writeFileSync(path.join(dir, "b.png"), "x");

      // First base has no file, second base does.
      assert.strictEqual(
        resolveMarkdownImagePath("assets/a.png", [dir + "-missing", dir]),
        path.join(nested, "a.png"),
      );
      // Backslash separators.
      assert.strictEqual(
        resolveMarkdownImagePath("assets\\a.png", [dir]),
        path.join(nested, "a.png"),
      );
      // Nonexistent relative file stays unresolved.
      assert.strictEqual(resolveMarkdownImagePath("assets/nope.png", [dir]), undefined);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("accepts absolute paths including outside-workspace files", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-img-"));
    try {
      const file = path.join(dir, "pic.png");
      fs.writeFileSync(file, "x");
      // Absolute path passes through regardless of bases (normalized slashes).
      assert.strictEqual(resolveMarkdownImagePath(file, ["/nope"]), file.replace(/\\/g, "/"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("keeps external protocols unresolved", () => {
    assert.strictEqual(resolveMarkdownImagePath("https://example.com/a.png", ["/w"]), undefined);
    assert.strictEqual(resolveMarkdownImagePath("data:image/png;base64,AAA", ["/w"]), undefined);
    assert.strictEqual(resolveMarkdownImagePath("media/notes.txt", ["/w"]), undefined);
  });
});

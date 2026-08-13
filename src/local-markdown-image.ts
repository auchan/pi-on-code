import * as path from "node:path";

const IMAGE_EXTENSIONS = new Set([
  ".avif", ".bmp", ".gif", ".ico", ".jpeg", ".jpg", ".png", ".svg", ".webp",
]);

/** Return a local file path only for Markdown image URLs using file:. */
export function getLocalMarkdownImagePath(href: string): string | undefined {
  try {
    const url = new URL(href);
    if (url.protocol !== "file:") { return undefined; }
    const filePath = decodeURIComponent(url.pathname);
    if (!IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) { return undefined; }
    return process.platform === "win32" && /^\/[a-z]:/i.test(filePath)
      ? filePath.slice(1)
      : filePath;
  } catch {
    return undefined;
  }
}

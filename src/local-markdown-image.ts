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

/**
 * Resolve a Markdown image src to an absolute workspace file path.
 *
 * Supports `file:` URLs and workspace-relative paths (including Windows
 * backslash separators such as `media\architecture.png`). Other protocols
 * (https:, data:, ...) are left untouched.
 */
export function resolveMarkdownImagePath(
  href: string,
  workspaceRoots: readonly string[],
): string | undefined {
  const fromFileUrl = getLocalMarkdownImagePath(href);
  if (fromFileUrl) { return fromFileUrl; }

  // Skip non-local protocols and bare drive-less absolute-ish references.
  if (!workspaceRoots.length) { return undefined; }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^[a-z]:[\\/]/i.test(href)) { return undefined; }

  const normalized = href.replace(/\\/g, "/");
  if (normalized.startsWith("/")) { return undefined; }
  const ext = path.extname(normalized).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) { return undefined; }

  const root = workspaceRoots[0];
  const candidate = path.resolve(root, normalized);
  const rootPrefix = path.resolve(root) + path.sep;
  if (candidate.startsWith(rootPrefix)) { return candidate; }
  return undefined;
}

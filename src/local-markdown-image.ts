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
 * Resolve a Markdown image src to an absolute file path.
 *
 * Supports `file:` URLs, absolute paths, and workspace-relative paths
 * (including Windows backslash separators such as `media\architecture.png`).
 * Other protocols (https:, data:, ...) are left to the browser. Security is
 * delegated to the host sandbox (VS Code webview / Docker), not enforced here.
 */
export function resolveMarkdownImagePath(
  href: string,
  workspaceRoots: readonly string[],
): string | undefined {
  const fromFileUrl = getLocalMarkdownImagePath(href);
  if (fromFileUrl) { return fromFileUrl; }

  // Other protocols (https:, data:, ...) are handled by the browser/CSP.
  // Windows drive letters (C:\...) are paths, not protocols.
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^[a-z]:[\\/]/i.test(href)) { return undefined; }

  const normalized = href.replace(/\\/g, "/");
  if (!IMAGE_EXTENSIONS.has(path.extname(normalized).toLowerCase())) { return undefined; }

  // Absolute paths pass through; the sandbox decides whether they are reachable.
  if (path.isAbsolute(normalized)) { return normalized; }

  // Relative paths resolve against the first workspace root for convenience.
  if (!workspaceRoots.length) { return undefined; }
  return path.resolve(workspaceRoots[0], normalized);
}

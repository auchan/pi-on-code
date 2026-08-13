import * as fs from "node:fs";
import * as path from "node:path";

const IMAGE_MEDIA_TYPES = new Map([
  [".avif", "image/avif"],
  [".bmp", "image/bmp"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

const INVISIBLE_PATH_CHARACTERS = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

function cleanImageHref(href: string): string {
  return href.trim().replace(INVISIBLE_PATH_CHARACTERS, "");
}

/** Return a local file path only for Markdown image URLs using file:. */
export function getLocalMarkdownImagePath(href: string): string | undefined {
  try {
    const url = new URL(cleanImageHref(href));
    if (url.protocol !== "file:") { return undefined; }
    const filePath = cleanImageHref(decodeURIComponent(url.pathname));
    if (!getMarkdownImageMediaType(filePath)) { return undefined; }
    return process.platform === "win32" && /^\/[a-z]:/i.test(filePath)
      ? filePath.slice(1)
      : filePath;
  } catch {
    return undefined;
  }
}

export function getMarkdownImageMediaType(filePath: string): string | undefined {
  return IMAGE_MEDIA_TYPES.get(path.extname(filePath).toLowerCase());
}

/**
 * Resolve a Markdown image src to an absolute file path.
 *
 * Priority: `file:` URL → relative path against each base in `baseDirs`
 * (first existing match wins) → absolute path pass-through. Other protocols
 * (https:, data:, ...) are left to the browser. Files outside the workspace
 * are supported; access control is delegated to the host sandbox
 * (VS Code webview / Docker), not enforced here.
 */
export function resolveMarkdownImagePath(
  href: string,
  baseDirs: readonly (string | undefined)[],
): string | undefined {
  const cleaned = cleanImageHref(href);
  const fromFileUrl = getLocalMarkdownImagePath(cleaned);
  if (fromFileUrl) { return fromFileUrl; }

  // Windows drive letters (C:\...) are paths, not protocols.
  if (/^[a-z][a-z0-9+.-]*:/i.test(cleaned) && !/^[a-z]:[\\/]/i.test(cleaned)) { return undefined; }

  const normalized = cleaned.replace(/\\/g, "/");
  if (!getMarkdownImageMediaType(normalized)) { return undefined; }

  // Absolute paths pass through; the sandbox decides whether they are reachable.
  if (path.isAbsolute(normalized) || path.win32.isAbsolute(cleaned)) { return normalized; }

  // Relative paths resolve against each base in priority order, picking the
  // first candidate that actually exists.
  for (const base of baseDirs) {
    if (!base) { continue; }
    const candidate = path.resolve(base, normalized);
    if (fs.existsSync(candidate)) { return candidate; }
  }
  return undefined;
}

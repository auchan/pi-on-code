export interface ScrollViewport {
  scrollTop: number;
  readonly scrollHeight: number;
}

/**
 * Who currently owns the conversation scroll position.
 *
 * - `"stream"` — streaming output owns the view; new content follows to the
 *   bottom automatically.
 * - `"user"` — the user is reading older content via wheel, touch, scrollbar,
 *   or keyboard; streaming must not yank the view back to the bottom.
 * - `"minimap"` — a minimap jump is in progress (or was just performed); the
 *   smooth scroll must not be interrupted by streamed DOM updates.
 * - `"reveal"` — a history reveal jump is in progress; same protection as the
 *   minimap owner.
 * - `"bottom"` — an explicit jump to the latest message is animating; streamed
 *   output must not interrupt it before it reaches the bottom.
 */
export type ScrollOwner = "stream" | "user" | "minimap" | "reveal" | "bottom";

export interface ScrollOwnerUpdate {
  isAtBottom: boolean;
  hasUserIntent: boolean;
}

/**
 * Resolve the next scroll owner after a scroll event.
 *
 * Reaching the bottom cancels any lock so streaming can follow again. Explicit
 * user input takes over as the `user` owner immediately. A minimap, reveal, or
 * bottom jump keeps its ownership until the user scrolls or reaches the bottom,
 * so streamed DOM updates cannot hijack the view mid-animation.
 */
export function nextScrollOwner(
  current: ScrollOwner,
  update: ScrollOwnerUpdate,
): ScrollOwner {
  if (update.isAtBottom) { return "stream"; }
  if (update.hasUserIntent) { return "user"; }
  return current;
}

type ScheduleFrame = (callback: () => void) => void;

export function scheduleFollowScroll(
  viewport: ScrollViewport,
  shouldFollow: () => boolean,
  scheduleFrame: ScheduleFrame = (callback) => { requestAnimationFrame(callback); },
): void {
  if (!shouldFollow()) { return; }
  scheduleFrame(() => {
    if (shouldFollow()) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  });
}

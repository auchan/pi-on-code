/**
 * Auto-refresh decision for the model list. Kept pure so the staleness rule is
 * unit-testable without the SDK registry.
 */

export const DEFAULT_MODEL_LIST_REFRESH_MINUTES = 30;

/** Convert a configured minute value into a max-age in ms (0 = disabled). */
export function modelListRefreshMaxAgeMs(minutes: unknown): number {
  const value = typeof minutes === "number" && Number.isFinite(minutes)
    ? minutes
    : DEFAULT_MODEL_LIST_REFRESH_MINUTES;
  if (value <= 0) { return 0; }
  return value * 60_000;
}

/**
 * True when the cached model list is stale enough to refresh before it is
 * shown. A max age of 0 disables auto refresh; a never-refreshed list is
 * always considered stale.
 */
/**
 * Process-wide timestamp of the last successful refresh. The registry is
 * shared runtime data, so the staleness window must span session windows
 * rather than reset for every new PiService instance.
 */
let sharedModelListRefreshedAt: number | null = null;

export function getSharedModelListRefreshedAt(): number | null {
  return sharedModelListRefreshedAt;
}

export function markModelListRefreshed(now: number): void {
  sharedModelListRefreshedAt = now;
}

/** Test hook: forget the shared refresh timestamp. */
export function resetModelListRefreshClock(): void {
  sharedModelListRefreshedAt = null;
}

export function shouldRefreshModelList(
  lastRefreshedAt: number | null,
  now: number,
  maxAgeMs: number,
): boolean {
  if (maxAgeMs <= 0) { return false; }
  if (lastRefreshedAt === null) { return true; }
  return now - lastRefreshedAt >= maxAgeMs;
}

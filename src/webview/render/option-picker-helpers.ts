/**
 * Pure helpers for the reusable status-bar option picker: fuzzy filtering,
 * viewport-clamped four-corner anchoring, and static option builders. Kept
 * free of DOM so the behavior is directly unit-testable.
 */

export interface PickerOptionItem {
  /** Stable value handed back to the host when selected. */
  key: string;
  label: string;
  description?: string;
  /** Optional single-glyph prefix such as "●", "★", "☰". */
  icon?: string;
  selected?: boolean;
}

export interface PickerAnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export type PickerAlign = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

export interface PickerPlacement {
  left: number;
  top: number;
}

export interface PickerSize {
  width: number;
  height: number;
}

export interface PickerViewport {
  width: number;
  height: number;
  margin?: number;
}

export interface StatusPickerKindMeta {
  title: string;
  placeholder: string;
}

export const STATUS_PICKER_META: Record<string, StatusPickerKindMeta> = {
  model: { title: "Model", placeholder: "Search models (★ = default)" },
  thinking: { title: "Thinking level", placeholder: "Search thinking levels (★ = default)" },
  effort: { title: "Effort", placeholder: "Search effort levels" },
  budget: { title: "Context budget", placeholder: "Search context budgets" },
};

/** Case-insensitive token filter over label + description. */
export function fuzzyFilterOptions(
  items: readonly PickerOptionItem[],
  query: string,
): PickerOptionItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) { return [...items]; }
  return items.filter((item) => {
    const haystack = `${item.label} ${item.description ?? ""}`.toLowerCase();
    return trimmed.split(/\s+/).every((token) => haystack.includes(token));
  });
}

/**
 * Compute the picker's top-left corner for the requested alignment against an
 * anchor rect, clamped inside the viewport with the given margin.
 */
export function resolvePickerPlacement(
  anchor: PickerAnchorRect,
  align: PickerAlign,
  size: PickerSize,
  viewport: PickerViewport,
): PickerPlacement {
  const margin = viewport.margin ?? 8;
  const maxLeft = Math.max(margin, viewport.width - size.width - margin);
  const maxTop = Math.max(margin, viewport.height - size.height - margin);

  let x = anchor.left;
  let y = anchor.bottom + 8;
  if (align === "topLeft") { y = anchor.top - size.height - 8; }
  if (align === "topRight") {
    x = anchor.right - size.width;
    y = anchor.top - size.height - 8;
  }
  if (align === "bottomRight") { x = anchor.right - size.width; }

  return {
    left: Math.min(maxLeft, Math.max(margin, x)),
    top: Math.min(maxTop, Math.max(margin, y)),
  };
}

/** Keep keys from `recent` first (in that order), then the rest unchanged. */
export function orderItemsByRecent(
  items: readonly PickerOptionItem[],
  recent: readonly string[],
): PickerOptionItem[] {
  const recentSet = new Set(recent);
  const recentItems = recent
    .map((key) => items.find((item) => item.key === key))
    .filter((item): item is PickerOptionItem => Boolean(item));
  return [...recentItems, ...items.filter((item) => !recentSet.has(item.key))];
}

const THINKING_LEVELS: ReadonlyArray<{ key: string; description: string }> = [
  { key: "off", description: "No thinking" },
  { key: "minimal", description: "Minimal thinking" },
  { key: "low", description: "Brief thinking" },
  { key: "medium", description: "Balanced thinking" },
  { key: "high", description: "Extended thinking" },
  { key: "xhigh", description: "Maximum thinking" },
];

export function buildThinkingOptions(
  current: string,
  defaultLevel: string | undefined,
): PickerOptionItem[] {
  return THINKING_LEVELS.map((level) => ({
    key: level.key,
    label: level.key === defaultLevel ? `${level.key} ★` : level.key,
    description: level.description,
    icon: level.key === current ? "●" : undefined,
    selected: level.key === current,
  }));
}

const EFFORT_LEVELS: ReadonlyArray<{ key: string; description: string }> = [
  { key: "auto", description: "Let the model decide" },
  { key: "none", description: "No effort" },
  { key: "low", description: "Low effort" },
  { key: "medium", description: "Medium effort" },
  { key: "high", description: "High effort" },
];

export function buildEffortOptions(current: string): PickerOptionItem[] {
  return EFFORT_LEVELS.map((level) => ({
    key: level.key,
    label: level.key,
    description: level.description,
    icon: level.key === current ? "●" : undefined,
    selected: level.key === current,
  }));
}

const BUDGET_PRESETS: ReadonlyArray<{ key: string; label: string; description: string }> = [
  { key: "0", label: "Model default", description: "Use the model's built-in context window" },
  { key: "100000", label: "100K tokens", description: "Compact at ~0.1M" },
  { key: "200000", label: "200K tokens", description: "Compact at ~0.2M" },
  { key: "500000", label: "500K tokens", description: "Compact at ~0.5M" },
  { key: "1000000", label: "1M tokens", description: "Compact at ~1M" },
];

export function buildBudgetOptions(currentTokens: number): PickerOptionItem[] {
  return BUDGET_PRESETS.map((preset) => ({
    key: preset.key,
    label: preset.label,
    description: preset.description,
    icon: String(currentTokens) === preset.key ? "●" : undefined,
    selected: String(currentTokens) === preset.key,
  }));
}

/** Compact budget label used by meta/titles, e.g. "200K". */
export function formatBudgetLabel(tokens: number): string {
  if (tokens === 0) { return "model default"; }
  if (tokens < 1000) { return String(tokens); }
  if (tokens < 1000000) { return `${(tokens / 1000).toFixed(0)}K`; }
  return `${(tokens / 1000000).toFixed(1)}M`;
}

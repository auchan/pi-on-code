import {
  fuzzyFilterOptions,
  orderItemsByRecent,
  resolvePickerPlacement,
  type PickerAlign,
  type PickerAnchorRect,
  type PickerOptionItem,
  type PickerPlacement,
  type PickerSize,
} from "../render/option-picker-helpers.js";

export interface StatusPickerConfig {
  title?: string;
  placeholder?: string;
  items: readonly PickerOptionItem[];
  anchor: PickerAnchorRect;
  align: PickerAlign;
  /** Optional recency memory: recent keys surface first and are updated on pick. */
  memory?: StatusPickerMemory;
}

export interface StatusPickerMemory {
  list: () => readonly string[];
  record: (key: string) => void;
}

export interface StatusPickerResult {
  /** Selected option key, or null when dismissed. */
  key: string | null;
}

const MAX_WIDTH = 320;
const MAX_HEIGHT = 400;
const VIEWPORT_MARGIN = 8;

interface PickerDom {
  host: HTMLElement;
  panel: HTMLElement;
  input: HTMLInputElement;
  list: HTMLElement;
  empty: HTMLElement;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

let openDom: PickerDom | null = null;
let resolveCurrent: ((result: StatusPickerResult) => void) | null = null;
let activeMemory: StatusPickerMemory | null = null;
let currentItems: PickerOptionItem[] = [];
let activeItems: PickerOptionItem[] = [];
let selectedIndex = 0;

function measure(): PickerSize {
  const panel = openDom?.panel;
  if (!panel) { return { width: MAX_WIDTH, height: MAX_HEIGHT }; }
  return {
    width: Math.min(panel.offsetWidth || MAX_WIDTH, MAX_WIDTH),
    height: Math.min(panel.offsetHeight || MAX_HEIGHT, MAX_HEIGHT),
  };
}

function place(config: StatusPickerConfig): void {
  const dom = openDom;
  const panel = dom?.panel;
  if (!dom || !panel) { return; }
  const size = measure();
  const viewport = { width: window.innerWidth, height: window.innerHeight, margin: VIEWPORT_MARGIN };
  const position = resolvePickerPlacement(config.anchor, config.align, size, viewport);
  panel.style.left = `${position.left}px`;
  panel.style.top = `${position.top}px`;
}

function renderList(query: string): void {
  const dom = openDom;
  if (!dom) { return; }
  const matches = fuzzyFilterOptions(currentItems, query);
  activeItems = matches;
  dom.list.replaceChildren();
  selectedIndex = 0;
  if (matches.length === 0) {
    dom.empty.hidden = false;
    return;
  }
  dom.empty.hidden = true;
  matches.forEach((item, index) => {
    const row = element("button", "option-picker-row");
    row.type = "button";
    row.dataset.index = String(index);
    if (item.icon) {
      const glyph = element("span", "option-picker-icon");
      glyph.textContent = item.icon;
      row.appendChild(glyph);
    }
    const text = element("span", "option-picker-text");
    const label = element("span", "option-picker-label");
    label.textContent = item.label;
    text.appendChild(label);
    if (item.description) {
      const description = element("span", "option-picker-desc");
      description.textContent = item.description;
      text.appendChild(description);
    }
    row.appendChild(text);
    row.addEventListener("click", () => finish(item.key));
    row.addEventListener("pointermove", () => { selectRow(index); });
    dom.list.appendChild(row);
  });
  const selected = dom.list.querySelector<HTMLElement>(".option-picker-row.selected");
  selected?.scrollIntoView({ block: "nearest" });
}

function selectRow(index: number): void {
  const dom = openDom;
  if (!dom) { return; }
  const rows = dom.list.querySelectorAll<HTMLElement>(".option-picker-row");
  if (rows.length === 0) { return; }
  selectedIndex = Math.min(Math.max(0, index), rows.length - 1);
  rows.forEach((row, i) => row.classList.toggle("selected", i === selectedIndex));
}

function moveSelection(delta: number): void {
  const dom = openDom;
  if (!dom) { return; }
  const rows = dom.list.querySelectorAll<HTMLElement>(".option-picker-row");
  if (rows.length === 0) { return; }
  const next = (selectedIndex + delta + rows.length) % rows.length;
  selectRow(next);
  rows[next]?.scrollIntoView({ block: "nearest" });
}

function finish(key: string | null): void {
  const dom = openDom;
  openDom = null;
  if (!dom) { return; }
  dom.host.remove();
  if (key !== null) { activeMemory?.record(key); }
  const resolve = resolveCurrent;
  resolveCurrent = null;
  activeMemory = null;
  resolve?.({ key });
}

/** Open the reusable, searchable status-bar option picker. */
export function openStatusPicker(config: StatusPickerConfig): Promise<StatusPickerResult> {
  finish(null); // close any previous picker first

  const host = element("div", "option-picker-root");
  const backdrop = element("div", "option-picker-backdrop");
  const panel = element("div", "option-picker");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", config.title ?? "Options");

  const header = element("div", "option-picker-header");
  if (config.title) {
    const title = element("span", "option-picker-title");
    title.textContent = config.title;
    header.appendChild(title);
  }
  const input = element("input", "option-picker-input");
  input.type = "search";
  input.placeholder = config.placeholder ?? "Search…";
  input.setAttribute("aria-label", config.placeholder ?? "Search options");
  const list = element("div", "option-picker-list");
  const empty = element("div", "option-picker-empty");
  empty.textContent = "No matches";
  empty.hidden = true;

  panel.append(header, input, list, empty);
  host.append(backdrop, panel);
  document.body.appendChild(host);
  openDom = { host, panel, input, list, empty };
  activeMemory = config.memory ?? null;
  currentItems = activeMemory
    ? orderItemsByRecent([...config.items], activeMemory.list())
    : [...config.items];
  selectedIndex = 0;

  input.addEventListener("input", () => renderList(input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); moveSelection(1); }
    if (event.key === "ArrowUp") { event.preventDefault(); moveSelection(-1); }
    if (event.key === "Enter") {
      event.preventDefault();
      const key = activeItems[selectedIndex]?.key ?? null;
      if (key !== null) { finish(key); }
    }
    if (event.key === "Escape") { event.preventDefault(); finish(null); }
  });
  backdrop.addEventListener("click", () => finish(null));

  renderList("");
  place(config);
  panel.style.width = `${MAX_WIDTH}px`;
  panel.style.maxWidth = `${Math.max(0, window.innerWidth - VIEWPORT_MARGIN * 2)}px`;
  // Reposition once the list has real height (fonts/layout ready).
  requestAnimationFrame(() => place(config));
  input.focus();

  return new Promise<StatusPickerResult>((resolve) => {
    resolveCurrent = resolve;
  });
}

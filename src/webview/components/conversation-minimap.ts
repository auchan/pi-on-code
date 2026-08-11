import type { Component } from "./types.js";

const PREVIEW_CHARACTER_LIMIT = 700;
const ACTIVE_TURN_TOLERANCE_PX = 8;
const TICK_PITCH_PX = 10;
const TRACK_PADDING_PX = 16;
const MINIMAP_VERTICAL_PADDING_PX = 32;
const MINIMAP_MIN_HEIGHT_PX = 28;
const ACTIVE_TICK_EDGE_INSET_PX = 14;

export const CONVERSATION_TURNS_EVENT = "pi-conversation-turns-update";

export interface ConversationTurnPreview {
  entryId: string;
  messageId?: string;
  user: string;
  agent: string;
}

export function normalizeConversationTurns(values: readonly unknown[]): ConversationTurnPreview[] {
  return values.flatMap((value): ConversationTurnPreview[] => {
    if (!value || typeof value !== "object") { return []; }
    const turn = value as Record<string, unknown>;
    if (
      typeof turn.entryId !== "string"
      || typeof turn.user !== "string"
      || typeof turn.agent !== "string"
    ) {
      return [];
    }
    return [{
      entryId: turn.entryId,
      ...(typeof turn.messageId === "string" ? { messageId: turn.messageId } : {}),
      user: turn.user,
      agent: turn.agent,
    }];
  });
}

export function truncateTurnPreview(
  text: string,
  maxLength = PREVIEW_CHARACTER_LIMIT,
): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) { return normalized; }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function findActiveTurnIndex(
  positions: readonly number[],
  viewportAnchor: number,
  tolerance = ACTIVE_TURN_TOLERANCE_PX,
): number {
  if (positions.length === 0) { return -1; }
  for (let index = positions.length - 1; index >= 0; index--) {
    if (positions[index]! <= viewportAnchor + tolerance) { return index; }
  }
  return 0;
}

export interface MinimapLayout {
  top: number;
  height: number;
}

export function getMinimapLayout(
  turnCount: number,
  viewportTop: number,
  viewportHeight: number,
): MinimapLayout {
  const contentHeight = Math.max(
    MINIMAP_MIN_HEIGHT_PX,
    Math.max(0, turnCount) * TICK_PITCH_PX + TRACK_PADDING_PX,
  );
  const availableHeight = Math.max(
    MINIMAP_MIN_HEIGHT_PX,
    viewportHeight - MINIMAP_VERTICAL_PADDING_PX * 2,
  );
  const height = Math.min(contentHeight, availableHeight);
  return {
    top: viewportTop + Math.max(0, (viewportHeight - height) / 2),
    height,
  };
}

export function getMinimapOverflow(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  tolerance = 1,
): { before: boolean; after: boolean } {
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
  return {
    before: scrollTop > tolerance,
    after: scrollTop < maxScrollTop - tolerance,
  };
}

/** Resolve a target's scroll offset inside the conversation container. */
export function getConversationJumpTop(
  targetTop: number,
  containerTop: number,
  currentScrollTop: number,
): number {
  return Math.max(0, targetTop - containerTop + currentScrollTop);
}

export function getHoverTickWidth(distance: number): number {
  return [22, 16, 12, 9][Math.abs(distance)] ?? 7;
}

/**
 * Find a loaded user message for a minimap turn. Fresh messages can initially
 * have a message id in the DOM while the rail has the persisted entry id.
 * Align both lists at their newest item until those identifiers converge.
 */
export function resolveLoadedUserIndex(
  turns: readonly ConversationTurnPreview[],
  targetEntryId: string,
  loadedEntryIds: readonly (string | null)[],
): number {
  const turnIndex = turns.findIndex((turn) => turn.entryId === targetEntryId);
  if (turnIndex < 0) { return -1; }
  const turn = turns[turnIndex]!;
  const exactIndex = loadedEntryIds.findIndex(
    (entryId) => entryId === turn.entryId || entryId === turn.messageId,
  );
  if (exactIndex >= 0) { return exactIndex; }
  const fallbackIndex = turnIndex + loadedEntryIds.length - turns.length;
  return fallbackIndex >= 0 && fallbackIndex < loadedEntryIds.length ? fallbackIndex : -1;
}

export function resolveActiveTurnIndex(
  turns: readonly ConversationTurnPreview[],
  loadedIndex: number,
  entryId: string | null,
  domMessageCount: number,
): number {
  if (entryId) {
    const matched = turns.findIndex(
      (turn) => turn.entryId === entryId || turn.messageId === entryId,
    );
    if (matched >= 0) { return matched; }
  }
  if (domMessageCount === 0 && turns.length > 0) { return turns.length - 1; }
  if (loadedIndex >= 0 && domMessageCount > 0 && turns.length > 0) {
    const fallbackIndex = loadedIndex + turns.length - domMessageCount;
    return fallbackIndex >= 0 && fallbackIndex < turns.length ? fallbackIndex : -1;
  }
  return -1;
}

interface ConversationMinimapOptions {
  onNavigate?: () => void;
  onLoadTurn?: (entryId: string) => void;
}

export class ConversationMinimap implements Component<Record<string, never>> {
  readonly el: HTMLElement;

  private readonly ticks: HTMLElement;
  private readonly tooltip: HTMLElement;
  private readonly userPreview: HTMLElement;
  private readonly agentPreview: HTMLElement;
  private readonly observer: MutationObserver;
  private readonly resizeObserver: ResizeObserver;
  private turns: ConversationTurnPreview[] = [];
  private tickButtons: HTMLButtonElement[] = [];
  private activeIndex = -1;
  private previewTurn: ConversationTurnPreview | null = null;
  private updateFrame: number | null = null;

  constructor(
    private readonly scrollContainer: HTMLElement,
    private readonly options: ConversationMinimapOptions = {},
  ) {
    this.el = document.createElement("nav");
    this.el.className = "conversation-minimap";
    this.el.setAttribute("aria-label", "Conversation minimap");

    this.ticks = document.createElement("div");
    this.ticks.className = "conversation-minimap-ticks";

    this.tooltip = document.createElement("div");
    this.tooltip.className = "conversation-minimap-tooltip";
    this.tooltip.id = `conversation-minimap-tooltip-${Math.random().toString(36).slice(2, 8)}`;
    this.tooltip.setAttribute("role", "tooltip");
    this.tooltip.hidden = true;

    this.userPreview = document.createElement("div");
    this.userPreview.className = "conversation-minimap-tooltip-user";
    this.agentPreview = document.createElement("div");
    this.agentPreview.className = "conversation-minimap-tooltip-agent";

    this.tooltip.append(this.userPreview, this.agentPreview);
    this.el.append(this.ticks, this.tooltip);

    this.el.addEventListener("mouseleave", this.hideTooltip);
    this.ticks.addEventListener("scroll", this.handleTicksScroll, { passive: true });
    this.scrollContainer.addEventListener("scroll", this.scheduleUpdate, { passive: true });
    window.addEventListener("resize", this.scheduleUpdate, { passive: true });
    window.addEventListener(CONVERSATION_TURNS_EVENT, this.handleTurnsUpdate);

    this.observer = new MutationObserver(this.scheduleUpdate);
    this.observer.observe(this.scrollContainer, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    this.resizeObserver = new ResizeObserver(this.scheduleUpdate);
    this.resizeObserver.observe(this.scrollContainer);
    this.scheduleUpdate();
  }

  mount(container: HTMLElement): void {
    container.appendChild(this.el);
    this.scheduleUpdate();
  }

  update(): void {
    this.scheduleUpdate();
  }

  destroy(): void {
    this.observer.disconnect();
    this.resizeObserver.disconnect();
    this.ticks.removeEventListener("scroll", this.handleTicksScroll);
    this.scrollContainer.removeEventListener("scroll", this.scheduleUpdate);
    window.removeEventListener("resize", this.scheduleUpdate);
    window.removeEventListener(CONVERSATION_TURNS_EVENT, this.handleTurnsUpdate);
    if (this.updateFrame !== null) { cancelAnimationFrame(this.updateFrame); }
    this.el.remove();
  }

  private readonly handleTurnsUpdate = (event: Event): void => {
    if (!(event instanceof CustomEvent) || !Array.isArray(event.detail)) { return; }
    const nextTurns = normalizeConversationTurns(event.detail);
    const sameTurns = nextTurns.length === this.turns.length
      && nextTurns.every((turn, index) =>
        turn.entryId === this.turns[index]?.entryId
        && turn.messageId === this.turns[index]?.messageId,
      );
    const previewEntryId = this.previewTurn?.entryId;
    this.turns = nextTurns;
    if (sameTurns) {
      this.previewTurn = nextTurns.find((turn) => turn.entryId === previewEntryId) ?? null;
      if (this.previewTurn) { this.updateTooltipContent(this.previewTurn); }
      return;
    }
    this.rebuildTicks();
  };

  private readonly scheduleUpdate = (): void => {
    if (this.updateFrame !== null) { return; }
    this.updateFrame = requestAnimationFrame(() => {
      this.updateFrame = null;
      this.updateMinimapLayout();
      this.updateActiveTurn();
      if (this.previewTurn) { this.updateTooltipContent(this.previewTurn); }
    });
  };

  private rebuildTicks(): void {
    this.previewTurn = null;
    this.tooltip.hidden = true;
    this.tickButtons = this.turns.map((turn, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "conversation-minimap-tick";
      button.setAttribute("aria-label", `Jump to user message ${index + 1}`);
      button.addEventListener("mouseenter", () => {
        this.showTooltip(this.turns[index] ?? turn, button, index);
      });
      button.addEventListener("click", () => this.navigateTo(this.turns[index] ?? turn));
      return button;
    });
    this.ticks.replaceChildren(...this.tickButtons);
    this.ticks.scrollTop = 0;
    this.el.hidden = this.turns.length === 0;
    this.activeIndex = -1;
    this.updateMinimapLayout();
    this.updateActiveTurn();
    this.updateOverflowFades();
  }

  private updateMinimapLayout(): void {
    const viewport = this.scrollContainer.getBoundingClientRect();
    const layout = getMinimapLayout(this.turns.length, viewport.top, viewport.height);
    this.el.style.top = `${layout.top}px`;
    this.el.style.height = `${layout.height}px`;
    this.updateOverflowFades();
  }

  private readonly handleTicksScroll = (): void => {
    this.updateOverflowFades();
    if (!this.previewTurn) { return; }
    const previewIndex = this.turns.findIndex(
      (turn) => turn.entryId === this.previewTurn?.entryId,
    );
    const button = this.tickButtons[previewIndex];
    if (button) { this.positionTooltip(button); }
  };

  private updateOverflowFades(): void {
    const overflow = getMinimapOverflow(
      this.ticks.scrollTop,
      this.ticks.scrollHeight,
      this.ticks.clientHeight,
    );
    this.ticks.classList.toggle("can-scroll-before", overflow.before);
    this.ticks.classList.toggle("can-scroll-after", overflow.after);
  }

  private ensureTickVisible(index: number): void {
    const button = this.tickButtons[index];
    if (!button) { return; }
    const visibleTop = this.ticks.scrollTop + ACTIVE_TICK_EDGE_INSET_PX;
    const visibleBottom = this.ticks.scrollTop
      + this.ticks.clientHeight
      - ACTIVE_TICK_EDGE_INSET_PX;
    const tickTop = button.offsetTop;
    const tickBottom = tickTop + button.offsetHeight;
    if (tickTop < visibleTop) {
      this.ticks.scrollTop = Math.max(0, tickTop - ACTIVE_TICK_EDGE_INSET_PX);
    } else if (tickBottom > visibleBottom) {
      this.ticks.scrollTop = tickBottom
        - this.ticks.clientHeight
        + ACTIVE_TICK_EDGE_INSET_PX;
    }
  }

  private findLoadedUser(entryId: string): HTMLElement | undefined {
    const messages = Array.from(
      this.scrollContainer.querySelectorAll<HTMLElement>(".message.user[data-entry-id]"),
    );
    const index = resolveLoadedUserIndex(
      this.turns,
      entryId,
      messages.map((message) => message.getAttribute("data-entry-id")),
    );
    return index >= 0 ? messages[index] : undefined;
  }

  private updateActiveTurn(): void {
    const messages = Array.from(
      this.scrollContainer.querySelectorAll<HTMLElement>(".message.user[data-entry-id]"),
    );
    const containerTop = this.scrollContainer.getBoundingClientRect().top;
    const positions = messages.map((message) =>
      message.getBoundingClientRect().top - containerTop + this.scrollContainer.scrollTop,
    );
    const anchor = this.scrollContainer.scrollTop
      + Math.min(120, this.scrollContainer.clientHeight * 0.25);
    const loadedIndex = findActiveTurnIndex(positions, anchor);
    const entryId = loadedIndex >= 0 ? messages[loadedIndex]?.getAttribute("data-entry-id") : null;
    const nextIndex = resolveActiveTurnIndex(
      this.turns,
      loadedIndex,
      entryId ?? null,
      messages.length,
    );
    if (nextIndex === this.activeIndex) { return; }
    if (this.activeIndex >= 0) {
      this.tickButtons[this.activeIndex]?.classList.remove("active");
      this.tickButtons[this.activeIndex]?.removeAttribute("aria-current");
    }
    this.activeIndex = nextIndex;
    if (nextIndex >= 0) {
      this.tickButtons[nextIndex]?.classList.add("active");
      this.tickButtons[nextIndex]?.setAttribute("aria-current", "true");
      this.ensureTickVisible(nextIndex);
    }
  }

  private navigateTo(turn: ConversationTurnPreview): void {
    this.options.onNavigate?.();
    const message = this.findLoadedUser(turn.entryId);
    if (!message) {
      this.options.onLoadTurn?.(turn.entryId);
      return;
    }
    const containerTop = this.scrollContainer.getBoundingClientRect().top;
    const targetTop = getConversationJumpTop(
      message.getBoundingClientRect().top,
      containerTop,
      this.scrollContainer.scrollTop,
    );
    // The jump takes over as the scroll owner before the animation starts, so
    // streamed DOM updates cannot cancel the smooth scroll mid-flight. The
    // owner is released when the user scrolls or returns to the bottom.
    this.scrollContainer.scrollTo({ top: targetTop, behavior: "smooth" });
  }

  private showTooltip(
    turn: ConversationTurnPreview,
    button: HTMLButtonElement,
    hoveredIndex: number,
  ): void {
    this.previewTurn = turn;
    for (let index = 0; index < this.tickButtons.length; index++) {
      const tick = this.tickButtons[index]!;
      tick.removeAttribute("aria-describedby");
      tick.style.setProperty("--conversation-minimap-tick-width", `${getHoverTickWidth(index - hoveredIndex)}px`);
    }
    this.updateTooltipContent(turn);
    this.tooltip.hidden = false;
    this.positionTooltip(button);
    button.setAttribute("aria-describedby", this.tooltip.id);
  }

  private positionTooltip(button: HTMLButtonElement): void {
    const minimapTop = this.el.getBoundingClientRect().top;
    const buttonBounds = button.getBoundingClientRect();
    const desiredCenter = buttonBounds.top + buttonBounds.height / 2;
    const halfHeight = this.tooltip.offsetHeight / 2;
    const clampedCenter = Math.max(
      halfHeight + 8,
      Math.min(window.innerHeight - halfHeight - 8, desiredCenter),
    );
    this.tooltip.style.top = `${clampedCenter - minimapTop}px`;
  }

  private readonly hideTooltip = (): void => {
    this.previewTurn = null;
    this.tooltip.hidden = true;
    for (const button of this.tickButtons) {
      button.removeAttribute("aria-describedby");
      button.style.removeProperty("--conversation-minimap-tick-width");
    }
  };

  private updateTooltipContent(turn: ConversationTurnPreview): void {
    const loadedUser = this.findLoadedUser(turn.entryId);
    const userText = loadedUser ? this.readMessageText(loadedUser) : turn.user;
    const loadedAgentParts: string[] = [];
    let sibling = loadedUser?.nextElementSibling ?? null;
    while (sibling && !sibling.matches(".message.user")) {
      if (sibling instanceof HTMLElement && sibling.matches(".message.assistant")) {
        const text = this.readMessageText(sibling, true);
        if (text) { loadedAgentParts.push(text); }
      }
      sibling = sibling.nextElementSibling;
    }

    this.userPreview.textContent = userText || "User message";
    const agentText = loadedAgentParts.length > 0
      ? truncateTurnPreview(loadedAgentParts.join(" "))
      : turn.agent;
    this.agentPreview.textContent = agentText || "Waiting for response…";
  }

  private readMessageText(message: HTMLElement, excludeThinking = false): string {
    const content = message.querySelector<HTMLElement>(":scope > .message-content");
    if (!content) { return ""; }
    const previewContent = excludeThinking
      ? content.cloneNode(true) as HTMLElement
      : content;
    if (excludeThinking) {
      previewContent.querySelectorAll(".thinking-block").forEach((element) => element.remove());
    }
    const text = Array.from(previewContent.childNodes)
      .map((node) => node.textContent ?? "")
      .join(" ");
    return truncateTurnPreview(text);
  }
}

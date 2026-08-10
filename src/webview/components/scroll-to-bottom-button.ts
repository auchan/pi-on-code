import type { Component } from "./types.js";

const BOTTOM_THRESHOLD_PX = 50;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export interface ScrollViewportMetrics {
  scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
}

export function shouldShowScrollToBottom(
  viewport: ScrollViewportMetrics,
  threshold = BOTTOM_THRESHOLD_PX,
): boolean {
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight >= threshold;
}

interface ScrollToBottomButtonOptions {
  onNavigate?: () => void;
  bottomAnchor?: HTMLElement;
}

export class ScrollToBottomButton implements Component<Record<string, never>> {
  readonly el: HTMLButtonElement;

  private readonly anchorObserver: ResizeObserver | null;
  private updateFrame: number | null = null;

  constructor(
    private readonly scrollContainer: HTMLElement,
    private readonly options: ScrollToBottomButtonOptions = {},
  ) {
    this.el = document.createElement("button");
    this.el.type = "button";
    this.el.className = "scroll-to-bottom-button";
    this.el.title = "Scroll to latest message";
    this.el.setAttribute("aria-label", "Scroll to latest message");
    this.el.hidden = true;

    const icon = document.createElementNS(SVG_NAMESPACE, "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    const stem = document.createElementNS(SVG_NAMESPACE, "path");
    stem.setAttribute("d", "M12 5v12");
    const arrow = document.createElementNS(SVG_NAMESPACE, "path");
    arrow.setAttribute("d", "m7 12 5 5 5-5");
    icon.append(stem, arrow);
    this.el.append(icon);

    this.el.addEventListener("click", this.handleClick);
    this.scrollContainer.addEventListener("scroll", this.scheduleUpdate, { passive: true });
    window.addEventListener("resize", this.handleWindowResize, { passive: true });
    this.anchorObserver = this.options.bottomAnchor
      ? new ResizeObserver(this.updateBottomOffset)
      : null;
    if (this.options.bottomAnchor) { this.anchorObserver?.observe(this.options.bottomAnchor); }
    this.updateBottomOffset();
    this.scheduleUpdate();
  }

  mount(container: HTMLElement): void {
    container.appendChild(this.el);
    this.updateBottomOffset();
    this.scheduleUpdate();
  }

  update(): void {
    this.scheduleUpdate();
  }

  destroy(): void {
    this.el.removeEventListener("click", this.handleClick);
    this.scrollContainer.removeEventListener("scroll", this.scheduleUpdate);
    window.removeEventListener("resize", this.handleWindowResize);
    this.anchorObserver?.disconnect();
    if (this.updateFrame !== null) { cancelAnimationFrame(this.updateFrame); }
    this.el.remove();
  }

  private readonly handleClick = (): void => {
    this.options.onNavigate?.();
    this.scrollContainer.scrollTo({
      top: this.scrollContainer.scrollHeight,
      behavior: "smooth",
    });
  };

  private readonly handleWindowResize = (): void => {
    this.updateBottomOffset();
    this.scheduleUpdate();
  };

  private readonly updateBottomOffset = (): void => {
    const anchor = this.options.bottomAnchor;
    if (!anchor) { return; }
    const offset = Math.max(12, window.innerHeight - anchor.getBoundingClientRect().top + 12);
    this.el.style.bottom = `${Math.round(offset)}px`;
  };

  private readonly scheduleUpdate = (): void => {
    if (this.updateFrame !== null) { return; }
    this.updateFrame = requestAnimationFrame(() => {
      this.updateFrame = null;
      this.el.hidden = !shouldShowScrollToBottom(this.scrollContainer);
    });
  };
}

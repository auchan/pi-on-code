// ── ThinkingBlock component ────────────────────────────────────
//
// Collapsible thinking content block.  Owns the collapse/expand
// toggle state, fixing the "expanded content, collapsed arrow" bug.
//
// Used in assistant message stream to show model thinking.
//
// Props:
//   content  — the current thinking text (empty = initial state)
//   done     — true when thinking has completed (hides spinner)

import type { Component } from "./types.js";
import { html } from "../render/html.js";

export interface ThinkingBlockProps {
  content: string;
  done?: boolean;
}

export class ThinkingBlock implements Component<ThinkingBlockProps> {
  readonly el: HTMLElement;

  private contentEl: HTMLElement;
  private expandBtn: HTMLElement;
  private spinnerEl: HTMLElement;
  private lineCountEl: HTMLElement;

  private _collapsed = false;
  private _streaming = true;
  private hasContent = false;

  constructor(props: ThinkingBlockProps) {
    this.el = document.createElement("div");
    this.el.className = "thinking-block";
    this.el.innerHTML = html`
      <div class="thinking-header">
        <span class="thinking-label">Thinking</span>
        <span class="thinking-spinner"></span>
        <span class="thinking-line-count"></span>
      </div>
      <div class="thinking-content"></div>
      <button class="thinking-expand-btn">Show less</button>`;

    this.contentEl = this.el.querySelector(".thinking-content")!;
    this.expandBtn = this.el.querySelector(".thinking-expand-btn")!;
    this.spinnerEl = this.el.querySelector(".thinking-spinner")!;
    this.lineCountEl = this.el.querySelector(".thinking-line-count")!;

    // Wire toggle
    this.expandBtn.addEventListener("click", () => this.toggle());
    const header = this.el.querySelector(".thinking-header")!;
    header.addEventListener("click", () => this.toggle());

    // Set initial content via textContent (safe, no HTML parse)
    this.setContent(props.content);
    this.updateDisplay(props.done);
  }

  mount(container: HTMLElement): void {
    container.appendChild(this.el);
  }

  update(props: ThinkingBlockProps): void {
    this.setContent(props.content);
    this.updateDisplay(props.done);
  }

  destroy(): void {
    this.el.remove();
  }

  // ── internal ──────────────────────────────────────────

  private setContent(content: string): void {
    this.contentEl.textContent = content;
    this.hasContent = !!content;
    const lines = content ? content.split("\n").length : 0;
    this.lineCountEl.textContent = lines > 0 ? `(${lines} lines)` : "";
  }

  private updateDisplay(done?: boolean): void {
    const finished = done === true;
    this._streaming = !finished;
    if (finished) {
      this.spinnerEl.remove();
    }
    // While streaming the live tail is shown directly, so the toggle is hidden;
    // after finishing it becomes the fold/unfold control (content stays visible
    // by default and is never auto-collapsed).
    this.expandBtn.style.display = this.hasContent && finished ? "" : "none";
    this.expandBtn.textContent = this._collapsed ? "Show more" : "Show less";
  }

  private toggle(): void {
    // Never fold while the model is still thinking: the content must stay
    // visible throughout the streaming turn. Collapsing is only a manual,
    // post-completion action (or happens once the turn is grouped at end).
    if (this._streaming) { return; }
    this.setCollapsed(!this._collapsed);
    if (this._collapsed) {
      this.contentEl.scrollTop = 0;
      this.el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  private setCollapsed(collapsed: boolean): void {
    this._collapsed = collapsed;
    this.el.classList.toggle("thinking-collapsed", collapsed);
    this.expandBtn.textContent = collapsed ? "Show more" : "Show less";
  }

  /** Auto-scroll the content area to the bottom (for streaming). */
  scrollToBottom(): void {
    this.contentEl.scrollTop = this.contentEl.scrollHeight;
  }

  /** Show the full content immediately (used when the thinking block ends up
   *  inside a collapsed execution-process group, so there is only one fold). */
  expand(): void {
    this.setCollapsed(false);
  }

  /** Whether the thinking block is currently collapsed. */
  get collapsed(): boolean {
    return this._collapsed;
  }
}

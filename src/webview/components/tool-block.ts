// ── ToolBlock component ───────────────────────────────────────
//
// Shared chrome for write/edit/read tool blocks: header with
// tool name, file path (clickable), and status badge.  Provides
// content and result containers where child components plug in.
//
// Replaces per-tool create() DOM builders in tools/index.ts.
//
// Props:
//   toolName   — "write", "edit", "read", etc.
//   toolCallId — unique ID for the tool call
//   entryId    — optional session entry ID
//   filePath   — optional file path (shown in header, clickable)
//   status     — "pending" | "running" | "done" | "error"
//   pathExtra  — extra text after path (e.g. " (3 edits)")

import type { Component } from "./types.js";
import { html } from "../render/html.js";

export interface ToolBlockProps {
  toolName: string;
  toolCallId: string;
  entryId?: string;
  filePath?: string;
  status?: "pending" | "running" | "done" | "error";
  pathExtra?: string;
  /** Non-file detail displayed alongside a generic tool name. */
  headerArguments?: string;
  /** Whether to show an ellipsis when no file path is supplied. */
  showPathPlaceholder?: boolean;
}

export class ToolBlock implements Component<ToolBlockProps> {
  readonly el: HTMLElement;

  private headerEl: HTMLElement;
  private nameEl: HTMLElement;
  private pathEl: HTMLElement | null = null;
  private statusEl: HTMLElement;
  private contentEl: HTMLElement;
  private resultEl: HTMLElement;

  private _filePath: string | null = null;

  constructor(props: ToolBlockProps) {
    this.el = document.createElement("div");
    this.el.className = "tool-block";
    this.el.id = props.entryId
      ? "entry-" + props.entryId
      : "tool-" + props.toolCallId;
    // Always store toolCallId for reveal-entry lookup
    this.el.setAttribute("data-tool-call-id", props.toolCallId);
    if (props.entryId) { this.el.setAttribute("data-entry-id", props.entryId); }
    this.el.setAttribute("data-status", props.status || "pending");

    const fp = props.filePath || "";
    this._filePath = fp;
    const pathDisplay = fp || (props.showPathPlaceholder === false ? "" : "...");

    this.el.innerHTML = html`
      <div class="tool-header">
        <span class="tool-name">${props.toolName}</span>
        <span class="tool-path" data-path="${fp}" title="Click to open file"${pathDisplay ? "" : " hidden"}>${pathDisplay}${props.pathExtra || ""}</span>
        <span class="tool-header-arguments"${props.headerArguments ? "" : " hidden"}>${props.headerArguments || ""}</span>
        <span class="tool-header-actions">
          <span class="tool-status ${props.status || "pending"}">${props.status || "pending"}</span>
        </span>
      </div>
      <div class="tool-content"></div>
      <div class="tool-result"></div>`;

    this.headerEl = this.el.querySelector(".tool-header")!;
    this.nameEl = this.el.querySelector(".tool-name")!;
    this.pathEl = this.el.querySelector(".tool-path");
    this.statusEl = this.el.querySelector(".tool-status")!;
    this.contentEl = this.el.querySelector(".tool-content")!;
    this.resultEl = this.el.querySelector(".tool-result")!;
  }

  mount(container: HTMLElement): void {
    container.appendChild(this.el);
  }

  update(props: ToolBlockProps): void {
    if (props.status) {
      this.el.setAttribute("data-status", props.status);
      this.statusEl.textContent = props.status;
      this.statusEl.className = "tool-status " + props.status;
    }
    if (props.filePath !== undefined) {
      this._filePath = props.filePath;
      if (this.pathEl) {
        this.pathEl.textContent = props.filePath || "...";
        this.pathEl.setAttribute("data-path", props.filePath || "");
      }
    }
    if (props.pathExtra !== undefined && this.pathEl) {
      const fp = this._filePath || "...";
      this.pathEl.textContent = fp + props.pathExtra;
    }
    if (props.entryId) {
      this.el.id = "entry-" + props.entryId;
      this.el.setAttribute("data-entry-id", props.entryId);
    }
  }

  destroy(): void {
    this.el.remove();
  }

  // ── Public accessors ─────────────────────────────────

  /** The tool-content container (where child components mount). */
  getContentEl(): HTMLElement {
    return this.contentEl;
  }

  /** The tool-result container (for errors / output). */
  getResultEl(): HTMLElement {
    return this.resultEl;
  }

  /** The tool-header element. */
  getHeaderEl(): HTMLElement {
    return this.headerEl;
  }

  /** The file path element (if visible). */
  getPathEl(): HTMLElement | null {
    return this.pathEl;
  }

  /** The status display element. */
  getStatusEl(): HTMLElement {
    return this.statusEl;
  }
}

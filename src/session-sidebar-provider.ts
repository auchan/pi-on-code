import { createHash } from "node:crypto";
import * as vscode from "vscode";

export interface PiSidebarSession {
  id: string;
  title: string;
  meta: string;
  active: boolean;
  streaming: boolean;
  unreadResult: boolean;
  kind: "open" | "past";
  path?: string;
  referenceId?: string;
  directory?: string;
  key: string;
  activity: number;
  pinned: boolean;
}

export interface PiSidebarPackage {
  source: string;
  name: string;
  description: string;
  version?: string;
  publisher?: string;
  license?: string;
  downloads?: number;
  scope?: "user" | "project";
  installed: boolean;
  updateAvailable: boolean;
  repository?: string;
  homepage?: string;
  imageUrl?: string;
  videoUrl?: string;
  videoPending?: boolean;
}

export interface PiSidebarPackages {
  ready: boolean;
  loading: boolean;
  error?: string;
  query: string;
  installed: PiSidebarPackage[];
  marketplace: PiSidebarPackage[];
}

export interface PiSidebarDirectory {
  name: string;
  path: string;
}

export interface PiSidebarState {
  sessions: PiSidebarSession[];
  directories: PiSidebarDirectory[];
  collapsedDirectories: Record<string, boolean>;
  packages: PiSidebarPackages;
}

export interface PiSidebarDeleteTarget {
  kind: "open" | "past";
  id?: string;
  path?: string;
}

interface PiSidebarActions {
  getState: () => PiSidebarState;
  createSession: (cwd?: string) => void;
  refreshSessions: () => void | Promise<void>;
  setDirectoryCollapsed: (path: string, collapsed: boolean) => void | Promise<void>;
  setSessionPinned: (key: string, pinned: boolean) => void | Promise<void>;
  reorderSessions: (keys: string[], directory: string | undefined, pinned: boolean) => void | Promise<void>;
  focusSession: (sessionId: string) => void;
  resumeSession: (path: string) => void;
  deleteSession: (target: PiSidebarDeleteTarget) => void | Promise<void>;
  renameSession: (target: PiSidebarDeleteTarget, name: string) => void | Promise<void>;
  copySessionId: (sessionId: string) => void | Promise<void>;
  forkSession: (target: PiSidebarDeleteTarget) => void | Promise<void>;
  searchPackages: (query: string) => void | Promise<void>;
  refreshPackages: () => void | Promise<void>;
  installPackage: (source: string) => void | Promise<void>;
  uninstallPackage: (source: string, scope: "user" | "project") => void | Promise<void>;
  updatePackage: (source: string) => void | Promise<void>;
  openUrl: (url: string) => void;
}

export class PiSessionSidebarProvider implements vscode.WebviewViewProvider {
  private static readonly maxCachedVideoBytes = 25 * 1024 * 1024;
  private view: vscode.WebviewView | undefined;
  private readonly cachedVideos = new Map<string, vscode.Uri>();
  private readonly pendingVideos = new Set<string>();
  private readonly failedVideos = new Map<string, number>();

  constructor(
    private readonly actions: PiSidebarActions,
    private readonly brandIconDark: vscode.Uri,
    private readonly brandIconLight: vscode.Uri,
    private readonly previewCacheRoot: vscode.Uri,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.brandIconDark, ".."),
        this.previewCacheRoot,
      ],
    };
    view.webview.html = this.getHtml(view.webview);

    view.webview.onDidReceiveMessage((message: unknown) => {
      if (!message || typeof message !== "object") { return; }
      const payload = message as Record<string, unknown>;
      switch (payload.type) {
        case "ready":
          this.refresh();
          break;
        case "new":
          this.actions.createSession(typeof payload.cwd === "string" ? payload.cwd : undefined);
          break;
        case "session-refresh":
          void this.actions.refreshSessions();
          break;
        case "directory-collapse":
          if (typeof payload.path === "string" && typeof payload.collapsed === "boolean") {
            void this.actions.setDirectoryCollapsed(payload.path, payload.collapsed);
          }
          break;
        case "session-pin":
          if (typeof payload.key === "string" && typeof payload.pinned === "boolean") {
            void this.actions.setSessionPinned(payload.key, payload.pinned);
          }
          break;
        case "session-reorder":
          if (
            Array.isArray(payload.keys) && payload.keys.every((key) => typeof key === "string") &&
            (payload.directory === undefined || typeof payload.directory === "string") &&
            typeof payload.pinned === "boolean"
          ) {
            void this.actions.reorderSessions(payload.keys, payload.directory, payload.pinned);
          }
          break;
        case "open":
          if (payload.kind === "open" && typeof payload.id === "string") {
            this.actions.focusSession(payload.id);
          } else if (payload.kind === "past" && typeof payload.path === "string") {
            this.actions.resumeSession(payload.path);
          }
          break;
        case "session-rename":
          if (typeof payload.title === "string") {
            if (payload.kind === "open" && typeof payload.id === "string") {
              void this.actions.renameSession({ kind: "open", id: payload.id }, payload.title);
            } else if (payload.kind === "past" && typeof payload.path === "string") {
              void this.actions.renameSession({ kind: "past", path: payload.path }, payload.title);
            }
          }
          break;
        case "session-delete":
          if (payload.kind === "open" && typeof payload.id === "string") {
            void this.actions.deleteSession({ kind: "open", id: payload.id });
          } else if (payload.kind === "past" && typeof payload.path === "string") {
            void this.actions.deleteSession({ kind: "past", path: payload.path });
          }
          break;
        case "session-copy-id":
          if (typeof payload.sessionId === "string") {
            void this.actions.copySessionId(payload.sessionId);
          }
          break;
        case "session-fork":
          if (payload.kind === "open" && typeof payload.id === "string") {
            void this.actions.forkSession({ kind: "open", id: payload.id });
          } else if (payload.kind === "past" && typeof payload.path === "string") {
            void this.actions.forkSession({ kind: "past", path: payload.path });
          }
          break;
        case "package-search":
          if (typeof payload.query === "string") { void this.actions.searchPackages(payload.query); }
          break;
        case "package-refresh":
          void this.actions.refreshPackages();
          break;
        case "package-install":
          if (typeof payload.source === "string") { void this.actions.installPackage(payload.source); }
          break;
        case "package-uninstall":
          if (
            typeof payload.source === "string" &&
            (payload.scope === "user" || payload.scope === "project")
          ) {
            void this.actions.uninstallPackage(payload.source, payload.scope);
          }
          break;
        case "package-update":
          if (typeof payload.source === "string") { void this.actions.updatePackage(payload.source); }
          break;
        case "open-url":
          if (typeof payload.url === "string") { this.actions.openUrl(payload.url); }
          break;
      }
    });
  }

  refresh(): void {
    if (!this.view) { return; }
    const state = this.actions.getState();
    void this.view.webview.postMessage({
      type: "state",
      state: this.toWebviewState(state, this.view.webview),
    });
    this.preparePreviewVideos(state);
  }

  private toWebviewState(state: PiSidebarState, webview: vscode.Webview): PiSidebarState {
    const mapPackage = (pkg: PiSidebarPackage): PiSidebarPackage => {
      if (!pkg.videoUrl) { return pkg; }
      const cached = this.cachedVideos.get(pkg.videoUrl);
      return {
        ...pkg,
        videoUrl: cached ? webview.asWebviewUri(cached).toString() : undefined,
        videoPending: !cached && !this.failedVideos.has(pkg.videoUrl),
      };
    };
    return {
      ...state,
      packages: {
        ...state.packages,
        installed: state.packages.installed.map(mapPackage),
        marketplace: state.packages.marketplace.map(mapPackage),
      },
    };
  }

  private preparePreviewVideos(state: PiSidebarState): void {
    const packages = [...state.packages.installed, ...state.packages.marketplace];
    for (const pkg of packages) {
      const videoUrl = pkg.videoUrl;
      if (!videoUrl || this.cachedVideos.has(videoUrl) || this.pendingVideos.has(videoUrl)) { continue; }
      const failedAt = this.failedVideos.get(videoUrl);
      if (failedAt && Date.now() - failedAt < 5 * 60_000) { continue; }
      this.failedVideos.delete(videoUrl);
      void this.cachePreviewVideo(videoUrl);
    }
  }

  private async cachePreviewVideo(videoUrl: string): Promise<void> {
    this.pendingVideos.add(videoUrl);
    try {
      await vscode.workspace.fs.createDirectory(this.previewCacheRoot);
      const hash = createHash("sha256").update(videoUrl).digest("hex");
      const target = vscode.Uri.joinPath(this.previewCacheRoot, `${hash}.mp4`);
      try {
        const stat = await vscode.workspace.fs.stat(target);
        if (stat.type === vscode.FileType.File && stat.size > 0) {
          this.cachedVideos.set(videoUrl, target);
          return;
        }
      } catch {
        // Cache miss; download below.
      }

      const response = await fetch(videoUrl, {
        headers: { Accept: "video/mp4,application/octet-stream;q=0.9,*/*;q=0.1" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) { throw new Error(`Video download returned ${response.status}`); }
      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > PiSessionSidebarProvider.maxCachedVideoBytes) {
        throw new Error("Video preview exceeds cache size limit");
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > PiSessionSidebarProvider.maxCachedVideoBytes) {
        throw new Error("Video preview is empty or too large");
      }
      await vscode.workspace.fs.writeFile(target, bytes);
      this.cachedVideos.set(videoUrl, target);
    } catch {
      this.failedVideos.set(videoUrl, Date.now());
    } finally {
      this.pendingVideos.delete(videoUrl);
      this.refresh();
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const brandIconDarkUri = webview.asWebviewUri(this.brandIconDark);
    const brandIconLightUri = webview.asWebviewUri(this.brandIconLight);
    return /* html */ `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:; media-src ${webview.cspSource} https:;">
  <style nonce="${nonce}">
    :root {
      color-scheme: light dark;
      --pi-bg: var(--vscode-sideBar-background, #0b0c0e);
      --pi-panel: var(--vscode-sideBarSectionHeader-background, var(--pi-bg));
      --pi-brand-bg: var(--vscode-sideBarTitle-background, var(--pi-bg));
      --pi-input-bg: var(--vscode-input-background, var(--pi-panel));
      --pi-hover: var(--vscode-list-hoverBackground, var(--pi-panel));
      --pi-active: var(--vscode-list-activeSelectionBackground, var(--pi-panel));
      --pi-active-text: var(--vscode-list-activeSelectionForeground, var(--vscode-sideBar-foreground));
      --pi-border: var(--vscode-sideBar-border, var(--vscode-panel-border));
      --pi-text: var(--vscode-sideBar-foreground, var(--vscode-foreground));
      --pi-strong: var(--vscode-foreground, var(--pi-text));
      --pi-muted: var(--vscode-descriptionForeground, var(--pi-text));
      --pi-faint: var(--vscode-disabledForeground, var(--pi-muted));
      --pi-lavender: var(--vscode-textLink-foreground, #b9a6ff);
      --pi-green: var(--vscode-testing-iconPassed, #83c092);
      --pi-red: var(--vscode-errorForeground, #e67e80);
      --pi-green-glow: rgb(131 192 146 / 34%);
    }

    body.vscode-dark,
    body.vscode-high-contrast {
      color-scheme: dark;
      --pi-lavender: #b9a6ff;
    }

    body.vscode-light,
    body.vscode-high-contrast-light {
      color-scheme: light;
      --pi-lavender: #6846c7;
      --pi-green: var(--vscode-testing-iconPassed, #26733d);
      --pi-red: var(--vscode-errorForeground, #c42b1c);
      --pi-green-glow: rgb(38 115 61 / 24%);
    }

    body.vscode-high-contrast,
    body.vscode-high-contrast-light {
      --pi-border: var(--vscode-contrastBorder, var(--vscode-panel-border));
      --pi-lavender: var(--vscode-focusBorder);
    }

    * { box-sizing: border-box; }

    html,
    body {
      width: 100%;
      height: 100%;
      min-height: 100%;
      margin: 0;
      padding: 0;
      overflow-x: hidden;
      overflow-y: auto;
      background: var(--pi-bg);
      color: var(--pi-text);
      font-family: var(--vscode-editor-font-family, "SFMono-Regular", Consolas, monospace);
      font-size: 12px;
    }

    button,
    input { color: inherit; font: inherit; }

    button:focus-visible,
    input:focus-visible {
      outline: 1px solid var(--pi-lavender);
      outline-offset: -1px;
    }

    .sidebar {
      min-height: 100vh;
      padding-bottom: 18px;
      background: var(--pi-bg);
      border-right: 1px solid var(--pi-border);
    }

    .brand {
      height: 40px;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 0 14px;
      border-bottom: 1px solid var(--pi-border);
      background: var(--pi-brand-bg);
    }

    .pi-mark {
      width: 22px;
      height: 22px;
      display: block;
      flex: 0 0 22px;
      object-fit: contain;
    }
    .pi-mark-light { display: none; }
    body.vscode-light .pi-mark-dark,
    body.vscode-high-contrast-light .pi-mark-dark { display: none; }
    body.vscode-light .pi-mark-light,
    body.vscode-high-contrast-light .pi-mark-light { display: block; }

    .wordmark {
      min-width: 0;
      color: var(--pi-strong);
      font-weight: 700;
      letter-spacing: .01em;
      white-space: nowrap;
    }

    .new-session,
    .icon-button {
      border: 0;
      background: transparent;
      color: var(--pi-text);
      cursor: pointer;
    }

    .new-session {
      margin-left: auto;
      padding: 4px 0 4px 10px;
      white-space: nowrap;
    }

    .new-session:hover,
    .icon-button:hover { color: var(--pi-strong); }

    .section-title {
      height: 42px;
      display: flex;
      align-items: center;
      padding: 5px 15px 0;
      color: var(--pi-faint);
      font-size: 9px;
      letter-spacing: .18em;
      text-transform: uppercase;
    }

    .session-list { padding: 0 7px 12px; }
    .session-directory { padding: 0 7px 10px; }
    .session-directory-heading {
      width: 100%;
      border: 0;
      background: transparent;
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 3px 7px 4px;
      color: var(--pi-strong);
      font-size: 12px;
      font-weight: 600;
    }
    .session-directory-icon {
      width: 16px;
      height: 16px;
      flex: 0 0 16px;
      color: var(--pi-muted);
      fill: none;
      stroke: currentColor;
      stroke-width: 1.25;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .session-directory-heading:hover .session-directory-icon { color: var(--pi-strong); }
    .session-folder-open { display: none; }
    .session-directory-heading[aria-expanded="true"] .session-folder-closed { display: none; }
    .session-directory-heading[aria-expanded="true"] .session-folder-open { display: inline; }
    .session-directory-new {
      margin-left: auto;
      padding: 1px 4px;
      border: 0;
      background: transparent;
      color: var(--pi-muted);
      cursor: pointer;
      font: inherit;
      opacity: 0;
      pointer-events: none;
    }
    .session-directory-heading:hover .session-directory-new,
    .session-directory-heading:focus-within .session-directory-new {
      opacity: 1;
      pointer-events: auto;
    }
    .session-directory-new:hover { color: var(--pi-strong); }

    .session-row {
      position: relative;
      width: 100%;
      height: 35px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 24px;
      align-items: center;
      padding-right: 5px;
      border-left: 1px solid transparent;
      background: transparent;
      color: var(--pi-text);
    }

    .session-row.dragging { opacity: .45; }
    .session-group-heading {
      padding: 3px 7px 4px;
      color: var(--pi-strong);
      font-size: 12px;
      font-weight: 600;
    }
    .session-pinned-group { padding-bottom: 10px; }
    .session-pin {
      position: absolute;
      z-index: 2;
      left: 3px;
      top: 50%;
      display: grid;
      place-items: center;
      width: 20px;
      height: 24px;
      padding: 0;
      border: 0;
      transform: translateY(-50%);
      background: transparent;
      color: var(--pi-muted);
      opacity: 0;
      pointer-events: none;
      cursor: pointer;
    }
    .session-pin svg { display: block; width: 14px; height: 14px; fill: currentColor; }
    .session-row:hover .session-pin,
    .session-row:focus-within .session-pin,
    .session-pin.pinned { opacity: 1; pointer-events: auto; }
    .session-pin:hover,
    .session-pin.pinned { color: var(--pi-lavender); }

    .session-row:hover { background: var(--pi-hover); color: var(--pi-strong); }
    .session-row.active {
      border-left-color: var(--pi-lavender);
      background: var(--pi-active);
      color: var(--pi-active-text);
      font-weight: 700;
    }

    .session-open {
      min-width: 0;
      height: 100%;
      display: grid;
      grid-template-columns: 13px minmax(0, 1fr) auto;
      align-items: center;
      padding: 0 2px 0 24px;
      border: 0;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }

    .session-inline-rename {
      position: absolute;
      z-index: 5;
      inset-inline: 20px 32px;
      top: 5px;
      min-width: 0;
      height: 24px;
      padding: 1px 4px;
      border: 1px solid var(--pi-lavender);
      border-radius: 2px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font: inherit;
      font-weight: 400;
    }

    .session-actions { position: relative; }
    .session-menu-toggle {
      width: 22px;
      height: 22px;
      padding: 0;
      border: 0;
      border-radius: 2px;
      background: transparent;
      color: var(--pi-muted);
      font-size: 15px;
      line-height: 1;
      opacity: 0;
      pointer-events: none;
      cursor: pointer;
    }
    .session-row:hover .session-menu-toggle,
    .session-row:focus-within .session-menu-toggle {
      opacity: 1;
      pointer-events: auto;
    }
    .session-menu-toggle:hover { background: var(--pi-hover); color: var(--pi-strong); }
    .session-menu {
      position: absolute;
      z-index: 20;
      top: 24px;
      right: 0;
      min-width: 150px;
      padding: 4px;
      border: 1px solid var(--pi-border);
      border-radius: 4px;
      background: var(--pi-panel);
      box-shadow: 0 6px 18px rgb(0 0 0 / 28%);
    }
    .session-menu.context-positioned {
      position: fixed;
      right: auto;
      width: max-content;
      max-width: calc(100vw - 8px);
    }
    .session-menu[hidden] { display: none; }
    .session-menu-item {
      width: 100%;
      padding: 6px 8px;
      border: 0;
      border-radius: 2px;
      background: transparent;
      color: var(--pi-text);
      font: inherit;
      text-align: left;
      white-space: nowrap;
      cursor: pointer;
    }
    .session-menu-item:hover,
    .session-menu-item:focus { background: var(--pi-hover); color: var(--pi-strong); outline: none; }
    .session-menu-delete { color: var(--pi-red); }

    .chevron { color: var(--pi-lavender); font-weight: 700; opacity: 0; }
    .session-row.active .chevron { opacity: 1; }

    .title {
      min-width: 0;
      padding-right: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .meta { color: var(--pi-muted); font-size: 10px; font-weight: 400; white-space: nowrap; }
    .streaming-dot,
    .unread-result-dot {
      width: 5px;
      height: 5px;
      margin-right: 6px;
      display: inline-block;
      vertical-align: 1px;
    }
    .streaming-dot {
      background: var(--pi-green);
      box-shadow: 0 0 0 0 transparent;
      animation: session-breathe 1.8s ease-in-out infinite;
    }
    .unread-result-dot {
      background: var(--pi-lavender);
      transform: rotate(45deg);
    }

    @keyframes session-breathe {
      0%, 100% {
        opacity: .45;
        box-shadow: 0 0 0 0 transparent;
      }
      50% {
        opacity: 1;
        box-shadow: 0 0 5px 2px var(--pi-green-glow);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .streaming-dot {
        opacity: 1;
        animation: none;
      }
    }

    .empty { padding: 7px 25px; color: var(--pi-muted); line-height: 1.7; }

    .packages-section { border-top: 1px solid var(--pi-border); }
    .packages-heading {
      height: 42px;
      display: flex;
      align-items: center;
      padding: 0 8px 0 6px;
    }
    .packages-toggle {
      min-width: 0;
      flex: 1;
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 8px;
      border: 0;
      background: transparent;
      color: var(--pi-faint);
      font-size: 9px;
      letter-spacing: .18em;
      text-align: left;
      text-transform: uppercase;
      cursor: pointer;
    }
    .packages-caret { color: var(--pi-lavender); transform: rotate(0deg); transition: transform 120ms ease; }
    .packages-section.expanded .packages-caret { transform: rotate(90deg); }
    .packages-count { margin-left: auto; color: var(--pi-faint); letter-spacing: 0; }
    .packages-body { display: none; padding: 0 7px 12px; }
    .packages-section.expanded .packages-body { display: block; }

    .package-search {
      display: flex;
      margin: 0 5px 10px;
      border: 1px solid var(--pi-border);
      background: var(--pi-input-bg);
    }
    .package-search input {
      min-width: 0;
      flex: 1;
      padding: 7px 8px;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--pi-text);
    }
    .package-search button,
    .package-action {
      padding: 5px 8px;
      border: 1px solid var(--pi-border);
      border-radius: 0;
      background: transparent;
      color: var(--pi-muted);
      cursor: pointer;
    }
    .package-search button { border-width: 0 0 0 1px; }
    .package-search button:hover,
    .package-action:hover { border-color: var(--pi-lavender); color: var(--pi-lavender); }

    .package-subtitle {
      padding: 8px 7px 5px;
      color: var(--pi-faint);
      font-size: 9px;
      letter-spacing: .14em;
      text-transform: uppercase;
    }
    .package-card {
      margin-bottom: 7px;
      padding: 9px;
      border: 1px solid var(--pi-border);
      border-left: 1px solid transparent;
      background: var(--pi-panel);
    }
    .package-card.installed { border-left-color: var(--pi-green); }
    .package-card-header { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
    .package-name {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      color: var(--pi-strong);
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .package-version { color: var(--pi-faint); font-size: 10px; }
    .package-description {
      display: -webkit-box;
      margin-top: 5px;
      overflow: hidden;
      color: var(--pi-muted);
      font-size: 11px;
      line-height: 1.45;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }
    .package-preview {
      width: 100%;
      height: 112px;
      display: block;
      margin-top: 8px;
      overflow: hidden;
      padding: 0;
      border: 1px solid var(--pi-border);
      background: var(--pi-panel);
      cursor: zoom-in;
    }
    .package-preview img,
    .package-preview video { width: 100%; height: 100%; display: block; object-fit: cover; }
    .package-preview.pending {
      display: grid;
      place-items: center;
      color: var(--pi-muted);
      cursor: progress;
      font-size: 10px;
      letter-spacing: .04em;
    }
    .package-preview.pending span::before {
      content: "▶";
      margin-right: 6px;
      color: var(--pi-lavender);
    }
    .package-info { margin-top: 7px; color: var(--pi-faint); font-size: 10px; }
    .package-actions { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
    .package-action.primary { border-color: var(--pi-lavender); color: var(--pi-lavender); }
    .package-action.danger:hover { border-color: var(--pi-red); color: var(--pi-red); }
    .package-action:disabled { opacity: .45; cursor: default; }
    .package-error { padding: 8px; color: var(--pi-red); line-height: 1.5; }
    .package-gallery-link {
      width: 100%;
      margin-top: 5px;
      padding: 8px;
      border: 0;
      background: transparent;
      color: var(--pi-muted);
      text-align: left;
      cursor: pointer;
    }
    .package-gallery-link:hover { color: var(--pi-lavender); }

    .preview-overlay {
      position: fixed;
      z-index: 1000;
      inset: 0;
      display: grid;
      padding: 18px;
      place-items: center;
      background: rgb(0 0 0 / 88%);
    }
    .preview-overlay img,
    .preview-overlay video { max-width: 96vw; max-height: 88vh; object-fit: contain; }
    .preview-close {
      position: fixed;
      top: 10px;
      right: 12px;
      width: 30px;
      height: 30px;
      border: 1px solid var(--pi-border);
      background: var(--pi-panel);
      color: var(--pi-text);
      cursor: pointer;
    }
  </style>
</head>
<body>
  <main class="sidebar">
    <header class="brand">
      <img class="pi-mark pi-mark-dark" src="${brandIconDarkUri}" alt="" aria-hidden="true">
      <img class="pi-mark pi-mark-light" src="${brandIconLightUri}" alt="" aria-hidden="true">
      <span class="wordmark">pi / code</span>
      <button class="new-session" id="session-action" type="button" title="New Pi session" aria-label="New Pi session">+ new</button>
    </header>
    <section aria-labelledby="sessions-heading">
      <div class="section-title" id="sessions-heading">sessions</div>
      <div class="session-list" id="session-list"></div>
    </section>
    <section class="packages-section" id="packages-section" aria-labelledby="packages-heading">
      <div class="packages-heading">
        <button class="packages-toggle" id="packages-toggle" type="button" aria-expanded="false">
          <span class="packages-caret">›</span>
          <span id="packages-heading">packages</span>
          <span class="packages-count" id="packages-count"></span>
        </button>
        <button class="icon-button" id="packages-refresh" type="button" title="Refresh packages">↻</button>
      </div>
      <div class="packages-body" id="packages-body">
        <form class="package-search" id="package-search">
          <input id="package-query" type="search" placeholder="Search Pi packages..." aria-label="Search Pi packages">
          <button type="submit">search</button>
        </form>
        <div id="package-list"></div>
        <button class="package-gallery-link" id="package-gallery-link" type="button">browse pi.dev/packages ↗</button>
      </div>
    </section>
  </main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const savedUiState = vscode.getState() || {};
    const uiState = {
      packagesExpanded: savedUiState.packagesExpanded === true,
      directoryExpanded: savedUiState.directoryExpanded || {},
    };
    const sessionList = document.getElementById("session-list");
    const packagesSection = document.getElementById("packages-section");
    const packagesToggle = document.getElementById("packages-toggle");
    const packagesCount = document.getElementById("packages-count");
    const packageList = document.getElementById("package-list");
    const packageQuery = document.getElementById("package-query");
    const sessionAction = document.getElementById("session-action");
    let currentState = null;
    let draggedSession = null;
    let marketplaceRequested = false;

    function syncPackagesExpanded() {
      packagesSection.classList.toggle("expanded", uiState.packagesExpanded);
      packagesToggle.setAttribute("aria-expanded", String(uiState.packagesExpanded));
      vscode.setState(uiState);
    }

    sessionAction.addEventListener("click", () => {
      const multiRoot = Array.isArray(currentState?.directories) && currentState.directories.length > 1;
      vscode.postMessage(multiRoot ? { type: "session-refresh" } : { type: "new" });
    });
    packagesToggle.addEventListener("click", () => {
      uiState.packagesExpanded = !uiState.packagesExpanded;
      syncPackagesExpanded();
      if (uiState.packagesExpanded) {
        marketplaceRequested = true;
        vscode.postMessage({ type: "package-refresh" });
      }
    });
    document.getElementById("packages-refresh").addEventListener("click", () => {
      vscode.postMessage({ type: "package-refresh" });
    });
    document.getElementById("package-search").addEventListener("submit", (event) => {
      event.preventDefault();
      marketplaceRequested = true;
      vscode.postMessage({ type: "package-search", query: packageQuery.value.trim() });
    });
    document.getElementById("package-gallery-link").addEventListener("click", () => {
      vscode.postMessage({ type: "open-url", url: "https://pi.dev/packages" });
    });

    document.addEventListener("click", () => {
      document.querySelectorAll(".session-menu").forEach((menu) => { menu.hidden = true; });
      document.querySelectorAll(".session-menu-toggle").forEach((toggle) => toggle.setAttribute("aria-expanded", "false"));
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      document.querySelectorAll(".session-menu").forEach((menu) => { menu.hidden = true; });
      document.querySelectorAll(".session-menu-toggle").forEach((toggle) => toggle.setAttribute("aria-expanded", "false"));
    });

    function createDirectoryIcon() {
      const namespace = "http://www.w3.org/2000/svg";
      const icon = document.createElementNS(namespace, "svg");
      icon.classList.add("session-directory-icon");
      icon.setAttribute("viewBox", "0 0 16 16");
      icon.setAttribute("aria-hidden", "true");
      icon.setAttribute("focusable", "false");

      const closed = document.createElementNS(namespace, "path");
      closed.classList.add("session-folder-closed");
      closed.setAttribute("d", "M2 5V4.25C2 3.56 2.56 3 3.25 3h2.6L7.1 4.5h5.65c.69 0 1.25.56 1.25 1.25v6c0 .69-.56 1.25-1.25 1.25h-9.5C2.56 13 2 12.44 2 11.75V5Z");

      const open = document.createElementNS(namespace, "g");
      open.classList.add("session-folder-open");
      const openBack = document.createElementNS(namespace, "path");
      openBack.setAttribute("d", "M2 7V4.25C2 3.56 2.56 3 3.25 3h2.6L7.1 4.5h5.65c.69 0 1.25.56 1.25 1.25V7");
      const openFront = document.createElementNS(namespace, "path");
      openFront.setAttribute("d", "M2.75 6.5h11.1c.5 0 .86.48.72.96l-1.3 4.58c-.15.54-.64.91-1.2.91H3.25C2.56 12.95 2 12.39 2 11.7V7.25c0-.41.34-.75.75-.75Z");
      open.append(openBack, openFront);
      icon.append(closed, open);
      return icon;
    }

    function renderSessionRows(groupSessions, list, directory, pinned) {
      for (const session of groupSessions) {
        const row = document.createElement("div");
        row.className = "session-row" + (session.active ? " active" : "");
        row.dataset.sessionKey = session.key;
        row.draggable = true;
        row.addEventListener("dragstart", (event) => {
          draggedSession = { key: session.key, directory, pinned };
          row.classList.add("dragging");
          if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        });
        row.addEventListener("dragover", (event) => {
          if (!draggedSession || draggedSession.pinned !== pinned || (!pinned && draggedSession.directory !== directory)) return;
          event.preventDefault();
          const draggedRow = list.querySelector('.session-row[data-session-key="' + CSS.escape(draggedSession.key) + '"]');
          if (!draggedRow || draggedRow === row) return;
          const bounds = row.getBoundingClientRect();
          list.insertBefore(draggedRow, event.clientY < bounds.top + bounds.height / 2 ? row : row.nextSibling);
        });
        row.addEventListener("drop", (event) => {
          if (!draggedSession || draggedSession.pinned !== pinned || (!pinned && draggedSession.directory !== directory)) return;
          event.preventDefault();
          const keys = Array.from(list.querySelectorAll(".session-row")).map((candidate) => candidate.dataset.sessionKey).filter(Boolean);
          vscode.postMessage({ type: "session-reorder", keys, directory, pinned });
        });
        row.addEventListener("dragend", () => {
          row.classList.remove("dragging");
          draggedSession = null;
        });
        const open = document.createElement("button");
        open.type = "button";
        open.className = "session-open";
        open.title = session.title;
        open.setAttribute("aria-current", session.active ? "true" : "false");

        const chevron = document.createElement("span");
        chevron.className = "chevron";
        chevron.textContent = "›";
        const title = document.createElement("span");
        title.className = "title";
        if (session.streaming || session.unreadResult) {
          const dot = document.createElement("span");
          dot.className = session.streaming ? "streaming-dot" : "unread-result-dot";
          dot.title = session.streaming ? "Session is working" : "Result ready to review";
          dot.setAttribute("aria-label", dot.title);
          title.appendChild(dot);
        }
        title.appendChild(document.createTextNode(session.title));
        const meta = document.createElement("span");
        meta.className = "meta";
        meta.textContent = session.meta || "";
        open.append(chevron, title, meta);
        open.addEventListener("click", () => {
          vscode.postMessage({ type: "open", kind: session.kind, id: session.id, path: session.path });
        });

        const pin = document.createElement("button");
        pin.type = "button";
        pin.className = "session-pin" + (session.pinned ? " pinned" : "");
        pin.title = session.pinned ? "Unpin session" : "Pin session";
        pin.setAttribute("aria-label", pin.title + ": " + session.title);
        pin.setAttribute("aria-pressed", String(session.pinned));
        pin.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.2 1.75h5.6l-.9 4.1 2.35 2.35v1.05H8.7V14l-.7.75-.7-.75V9.25H3.75V8.2L6.1 5.85l-.9-4.1Z"/></svg>';
        pin.addEventListener("click", (event) => {
          event.stopPropagation();
          vscode.postMessage({ type: "session-pin", key: session.key, pinned: !session.pinned });
        });

        const actions = document.createElement("div");
        actions.className = "session-actions";
        const menuToggle = document.createElement("button");
        menuToggle.type = "button";
        menuToggle.className = "session-menu-toggle";
        menuToggle.textContent = "…";
        menuToggle.title = "Session actions";
        menuToggle.setAttribute("aria-label", "Actions for " + session.title);
        menuToggle.setAttribute("aria-haspopup", "menu");
        menuToggle.setAttribute("aria-expanded", "false");
        const menu = document.createElement("div");
        menu.className = "session-menu";
        menu.setAttribute("role", "menu");
        menu.hidden = true;

        const startInlineRename = () => {
          menu.hidden = true;
          menuToggle.setAttribute("aria-expanded", "false");
          const input = document.createElement("input");
          input.type = "text";
          input.className = "session-inline-rename";
          input.value = session.title;
          input.setAttribute("aria-label", "Rename " + session.title);
          let settled = false;
          const setTitleText = (value) => {
            const textNode = Array.from(title.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
            if (textNode) textNode.textContent = value;
            else title.appendChild(document.createTextNode(value));
          };
          const finish = (save) => {
            if (settled) return;
            settled = true;
            input.remove();
            const nextTitle = input.value.trim();
            if (save && nextTitle && nextTitle !== session.title) {
              vscode.postMessage({
                type: "session-rename",
                kind: session.kind,
                id: session.id,
                path: session.path,
                title: nextTitle,
              });
              setTitleText(nextTitle);
            }
          };
          row.appendChild(input);
          input.addEventListener("click", (event) => event.stopPropagation());
          input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") { event.preventDefault(); finish(true); }
            if (event.key === "Escape") { event.preventDefault(); finish(false); }
          });
          input.addEventListener("blur", () => finish(true));
          input.focus();
          input.select();
        };

        const rename = document.createElement("button");
        rename.type = "button";
        rename.className = "session-menu-item";
        rename.textContent = "Rename session";
        rename.setAttribute("role", "menuitem");
        rename.addEventListener("click", startInlineRename);
        menu.appendChild(rename);

        if (session.referenceId) {
          const copyId = document.createElement("button");
          copyId.type = "button";
          copyId.className = "session-menu-item";
          copyId.textContent = "Copy session ID";
          copyId.setAttribute("role", "menuitem");
          copyId.addEventListener("click", () => {
            vscode.postMessage({ type: "session-copy-id", sessionId: session.referenceId });
            menu.hidden = true;
            menuToggle.setAttribute("aria-expanded", "false");
          });
          menu.appendChild(copyId);
        }

        const fork = document.createElement("button");
        fork.type = "button";
        fork.className = "session-menu-item";
        fork.textContent = "Fork session";
        fork.setAttribute("role", "menuitem");
        fork.addEventListener("click", () => {
          vscode.postMessage({
            type: "session-fork",
            kind: session.kind,
            id: session.id,
            path: session.path,
          });
          menu.hidden = true;
          menuToggle.setAttribute("aria-expanded", "false");
        });
        menu.appendChild(fork);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "session-menu-item session-menu-delete";
        remove.textContent = "Delete session";
        remove.setAttribute("role", "menuitem");
        remove.addEventListener("click", () => {
          vscode.postMessage({
            type: "session-delete",
            kind: session.kind,
            id: session.id,
            path: session.path,
          });
          menu.hidden = true;
          menuToggle.setAttribute("aria-expanded", "false");
        });
        menu.appendChild(remove);
        const setMenuOpen = (openMenu, pointer) => {
          document.querySelectorAll(".session-menu").forEach((candidate) => {
            if (candidate !== menu) candidate.hidden = true;
          });
          menu.classList.toggle("context-positioned", Boolean(pointer));
          menu.style.left = "";
          menu.style.top = "";
          menu.style.right = "";
          menu.hidden = !openMenu;
          menuToggle.setAttribute("aria-expanded", String(openMenu));
          if (openMenu && pointer) {
            const left = Math.min(pointer.x, window.innerWidth - menu.offsetWidth - 4);
            const top = Math.min(pointer.y, window.innerHeight - menu.offsetHeight - 4);
            menu.style.left = Math.max(4, left) + "px";
            menu.style.top = Math.max(4, top) + "px";
          }
          if (openMenu) menu.querySelector(".session-menu-item")?.focus();
        };
        menuToggle.addEventListener("click", (event) => {
          event.stopPropagation();
          setMenuOpen(menu.hidden);
        });
        row.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setMenuOpen(true, { x: event.clientX, y: event.clientY });
        });
        menu.addEventListener("click", (event) => event.stopPropagation());
        actions.append(menuToggle, menu);
        row.prepend(pin, open);
        row.append(actions);
        list.appendChild(row);
      }
    }

    function renderSessions(sessions, directories, collapsedDirectories) {
      sessionList.replaceChildren();
      for (const [path, collapsed] of Object.entries(collapsedDirectories || {})) {
        if (!(path in uiState.directoryExpanded)) uiState.directoryExpanded[path] = !collapsed;
      }
      const pinnedSessions = sessions.filter((session) => session.pinned);
      const unpinnedSessions = sessions.filter((session) => !session.pinned);
      const multiRoot = directories.length > 1;
      if (sessions.length === 0 && !multiRoot) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = "No sessions yet. Select + new to start.";
        sessionList.appendChild(empty);
        return;
      }
      if (pinnedSessions.length > 0) {
        const pinnedGroup = document.createElement("div");
        pinnedGroup.className = "session-pinned-group";
        const heading = document.createElement("div");
        heading.className = "session-group-heading";
        heading.textContent = "Pinned";
        const list = document.createElement("div");
        pinnedGroup.append(heading, list);
        sessionList.appendChild(pinnedGroup);
        renderSessionRows(pinnedSessions, list, undefined, true);
      }
      const groups = multiRoot
        ? directories.map((directory) => ({ ...directory, sessions: unpinnedSessions.filter((session) => session.directory === directory.path) }))
        : [{ name: "", path: directories[0]?.path, sessions: unpinnedSessions }];
      for (const group of groups) {
        const list = document.createElement("div");
        if (multiRoot) {
          const directoryElement = document.createElement("div");
          directoryElement.className = "session-directory";
          const heading = document.createElement("button");
          heading.type = "button";
          heading.className = "session-directory-heading";
          heading.setAttribute("aria-expanded", String(uiState.directoryExpanded[group.path] !== false));
          heading.append(createDirectoryIcon(), document.createTextNode(group.name));
          heading.addEventListener("click", () => {
            uiState.directoryExpanded[group.path] = uiState.directoryExpanded[group.path] === false;
            vscode.setState(uiState);
            vscode.postMessage({ type: "directory-collapse", path: group.path, collapsed: uiState.directoryExpanded[group.path] === false });
            renderSessions(currentState?.sessions || [], currentState?.directories || [], currentState?.collapsedDirectories || {});
          });
          const create = document.createElement("button");
          create.type = "button";
          create.className = "session-directory-new";
          create.textContent = "+";
          create.title = "New session";
          create.setAttribute("aria-label", "New session in " + group.name);
          create.addEventListener("click", (event) => {
            event.stopPropagation();
            vscode.postMessage({ type: "new", cwd: group.path });
          });
          heading.appendChild(create);
          directoryElement.append(heading, list);
          sessionList.appendChild(directoryElement);
          if (uiState.directoryExpanded[group.path] === false) continue;
        } else {
          sessionList.appendChild(list);
        }
        renderSessionRows(group.sessions, list, group.path, false);
      }
    }

    function formatDownloads(value) {
      if (!value) return "";
      if (value >= 1000000) return (value / 1000000).toFixed(1) + "M/wk";
      if (value >= 1000) return (value / 1000).toFixed(1) + "K/wk";
      return value + "/wk";
    }

    function openPreview(pkg, video) {
      document.querySelector(".preview-overlay")?.remove();
      const overlay = document.createElement("div");
      overlay.className = "preview-overlay";
      const media = document.createElement(video ? "video" : "img");
      media.src = video ? pkg.videoUrl : pkg.imageUrl;
      if (video) {
        media.controls = true;
        media.autoplay = true;
        media.playsInline = true;
        media.preload = "auto";
        if (pkg.imageUrl) { media.poster = pkg.imageUrl; }
      }
      const close = document.createElement("button");
      close.className = "preview-close";
      close.type = "button";
      close.textContent = "×";
      const remove = () => overlay.remove();
      close.addEventListener("click", remove);
      overlay.addEventListener("click", (event) => { if (event.target === overlay) remove(); });
      overlay.append(media, close);
      document.body.appendChild(overlay);
    }

    function actionButton(label, className, handler, disabled) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "package-action " + (className || "");
      button.textContent = label;
      button.disabled = disabled === true;
      button.addEventListener("click", handler);
      return button;
    }

    function createPackageCard(pkg, installedSection) {
      const card = document.createElement("article");
      card.className = "package-card" + (pkg.installed ? " installed" : "");
      const header = document.createElement("div");
      header.className = "package-card-header";
      const name = document.createElement("span");
      name.className = "package-name";
      name.textContent = pkg.name;
      const version = document.createElement("span");
      version.className = "package-version";
      version.textContent = pkg.version ? "v" + pkg.version : "";
      header.append(name, version);
      card.appendChild(header);

      if (pkg.description) {
        const description = document.createElement("div");
        description.className = "package-description";
        description.textContent = pkg.description;
        card.appendChild(description);
      }

      if (pkg.videoUrl || pkg.imageUrl) {
        const preview = document.createElement("button");
        preview.type = "button";
        preview.className = "package-preview";
        const isVideo = Boolean(pkg.videoUrl);
        const media = document.createElement(isVideo ? "video" : "img");
        media.src = isVideo ? pkg.videoUrl : pkg.imageUrl;
        media.setAttribute("aria-label", pkg.name + " preview");
        if (isVideo) {
          media.muted = true;
          media.loop = true;
          media.playsInline = true;
          media.preload = "auto";
          if (pkg.imageUrl) { media.poster = pkg.imageUrl; }
          const previewTime = 0.08;
          media.addEventListener("loadedmetadata", () => {
            if (!pkg.imageUrl && media.duration > previewTime) { media.currentTime = previewTime; }
          }, { once: true });
          preview.addEventListener("mouseenter", () => { media.play().catch(() => {}); });
          preview.addEventListener("mouseleave", () => {
            media.pause();
            if (media.duration > previewTime) { media.currentTime = previewTime; }
          });
        }
        preview.appendChild(media);
        preview.addEventListener("click", () => openPreview(pkg, isVideo));
        card.appendChild(preview);
      } else if (pkg.videoPending) {
        const pending = document.createElement("div");
        pending.className = "package-preview pending";
        const label = document.createElement("span");
        label.textContent = "preparing video";
        pending.appendChild(label);
        card.appendChild(pending);
      }

      const infoParts = [];
      if (pkg.scope) infoParts.push(pkg.scope);
      if (pkg.publisher) infoParts.push("by " + pkg.publisher);
      if (pkg.license) infoParts.push(pkg.license);
      const downloads = formatDownloads(pkg.downloads);
      if (downloads) infoParts.push(downloads);
      if (infoParts.length > 0) {
        const info = document.createElement("div");
        info.className = "package-info";
        info.textContent = infoParts.join(" · ");
        card.appendChild(info);
      }

      const actions = document.createElement("div");
      actions.className = "package-actions";
      if (installedSection) {
        if (pkg.updateAvailable) {
          actions.appendChild(actionButton("update", "primary", () => {
            vscode.postMessage({ type: "package-update", source: pkg.source });
          }));
        }
        actions.appendChild(actionButton("remove", "danger", () => {
          vscode.postMessage({ type: "package-uninstall", source: pkg.source, scope: pkg.scope || "user" });
        }));
      } else {
        actions.appendChild(actionButton(pkg.installed ? "installed" : "install", "primary", () => {
          if (!pkg.installed) vscode.postMessage({ type: "package-install", source: pkg.source });
        }, pkg.installed));
      }
      const targetUrl = pkg.repository || pkg.homepage || (pkg.name ? "https://www.npmjs.com/package/" + pkg.name : "");
      if (targetUrl) {
        actions.appendChild(actionButton("open", "", () => {
          vscode.postMessage({ type: "open-url", url: targetUrl });
        }));
      }
      card.appendChild(actions);
      return card;
    }

    function appendPackageGroup(title, packages, installedSection) {
      if (packages.length === 0) return;
      const heading = document.createElement("div");
      heading.className = "package-subtitle";
      heading.textContent = title;
      packageList.appendChild(heading);
      packages.forEach((pkg) => packageList.appendChild(createPackageCard(pkg, installedSection)));
    }

    function renderPackages(packages) {
      packageList.replaceChildren();
      const installed = Array.isArray(packages?.installed) ? packages.installed : [];
      const marketplace = Array.isArray(packages?.marketplace) ? packages.marketplace : [];
      if (uiState.packagesExpanded && packages?.ready && !packages?.loading &&
          marketplace.length === 0 && !marketplaceRequested) {
        marketplaceRequested = true;
        vscode.postMessage({ type: "package-refresh" });
      }
      packagesCount.textContent = installed.length ? String(installed.length) : "";
      if (document.activeElement !== packageQuery) packageQuery.value = packages?.query || "";
      if (packages?.error) {
        const error = document.createElement("div");
        error.className = "package-error";
        error.textContent = packages.error;
        packageList.appendChild(error);
      }
      appendPackageGroup("installed", installed, true);
      appendPackageGroup(packages?.query ? "results" : "marketplace", marketplace, false);
      if (packages?.loading) {
        const loading = document.createElement("div");
        loading.className = "empty";
        loading.textContent = "Loading packages...";
        packageList.appendChild(loading);
      } else if (!packages?.error && installed.length === 0 && marketplace.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = packages?.ready ? "No packages found." : "Package service is starting...";
        packageList.appendChild(empty);
      }
    }

    function render(state) {
      currentState = state;
      const multiRoot = Array.isArray(state?.directories) && state.directories.length > 1;
      sessionAction.textContent = multiRoot ? "↻" : "+ new";
      sessionAction.title = multiRoot ? "Refresh sessions" : "New Pi session";
      sessionAction.setAttribute("aria-label", sessionAction.title);
      renderSessions(Array.isArray(state?.sessions) ? state.sessions : [], Array.isArray(state?.directories) ? state.directories : [], state?.collapsedDirectories || {});
      renderPackages(state?.packages || {});
    }

    window.addEventListener("message", (event) => {
      if (event.data?.type === "state") render(event.data.state);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") document.querySelector(".preview-overlay")?.remove();
    });
    syncPackagesExpanded();
    vscode.postMessage({ type: "ready" });
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let i = 0; i < 32; i += 1) {
    value += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return value;
}

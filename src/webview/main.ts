// ── Pi on Code Webview Entry Point ─────────────────────────
//
// Initializes state, debug, rendering engine, tool renderers,
// event handlers, and the VS Code message bridge.
//
// Import order matters:
//   1. state.js    — shared mutable state
//   2. debug.js    — debug infrastructure
//   3. engine.js   — rendering functions (pure, no side effects)
//   4. tools.js    — registers tool renderers (side effect)
//   5. handlers.js — sets up message listener (side effect)

import { state, initState } from "./state.js";
import { initDebugObserver } from "./debug.js";
import {
  setupCodeBlockHandlers,
  updateStreamingState,
  scrollToBottom,
} from "./render/engine.js";
import { shouldLoadOlderHistory } from "./render/history-pagination.js";
import { cancelFollowScroll, nextScrollOwner } from "./render/scroll-lock.js";
import { ConversationMinimap } from "./components/conversation-minimap.js";
import { ScrollToBottomButton } from "./components/scroll-to-bottom-button.js";

// Side-effect imports (self-register on load)
import "./tools/index.js";
import "./handlers/index.js";

// ── Initialize ──────────────────────────────────────────────

// Acquire VS Code API and store globally (handlers need it)
const vscode = acquireVsCodeApi();
window.__vscode = vscode;

// Populate DOM refs (called automatically by state.js on import,
// but called again here for clarity and safety)
initState(document);

// Start MutationObserver for debug logging
initDebugObserver();

const conversationMinimap = new ConversationMinimap(state.chatContainer, {
  onNavigate: () => {
    state.scrollOwner = "minimap";
  },
  onLoadTurn: (entryId) => {
    vscode.postMessage({ type: "loadHistoryToEntry", entryId });
  },
});
conversationMinimap.mount(document.body);

const scrollToBottomButton = new ScrollToBottomButton(state.chatContainer, {
  onNavigate: () => {
    clearUserScrollIntent();
    state.scrollOwner = "bottom";
  },
  bottomAnchor: document.getElementById("input-area") ?? undefined,
});
scrollToBottomButton.mount(document.body);

// Set up event delegation (code copy buttons, file path clicks)
setupCodeBlockHandlers();

// Set initial streaming state (show/hide buttons)
updateStreamingState();

// Tell the extension host that the message listener is active before it
// replays any cached Session history into this Webview.
vscode.postMessage({ type: "webviewReady" });

// Populate the composer with the current visible-editor context.
vscode.postMessage({ type: "requestEditorContext" });

// ── Viewport recovery ────────────────────────────────────────
// VS Code retains this webview while its tab is hidden. Chromium can preserve
// the old, small compositor surface when the editor group is resized in the
// background, then repaint it only after a noticeable delay. Briefly promoting
// the app to a fresh layer forces an immediate full-viewport paint. A second
// pass covers the delayed viewport update seen after long background sleeps.
let viewportRecoveryGeneration = 0;

function recoverViewportLayout(): void {
  if (document.visibilityState === "hidden") { return; }

  const generation = ++viewportRecoveryGeneration;
  const root = document.documentElement;
  const restoreScroll = (): void => {
    if (state.scrollOwner !== "stream") { return; }
    state.chatContainer.scrollTop = state.chatContainer.scrollHeight;
  };
  const repaint = (): void => {
    if (generation !== viewportRecoveryGeneration || document.visibilityState === "hidden") {
      return;
    }
    root.classList.remove("pi-viewport-recovering");
    void root.offsetWidth;
    root.classList.add("pi-viewport-recovering");
    void root.offsetWidth;
    requestAnimationFrame(() => {
      if (generation !== viewportRecoveryGeneration) { return; }
      root.classList.remove("pi-viewport-recovering");
      void root.offsetWidth;
      restoreScroll();
    });
  };

  repaint();
  window.setTimeout(repaint, 100);
}

window.addEventListener("pi-viewport-refresh", recoverViewportLayout);

// ── Scroll tracking ─────────────────────────────────────────
// A scroll event alone does not prove user intent: DOM growth can make a
// delayed programmatic scroll event appear to be away from the new bottom.
let hasUserScrollIntent = false;
let userScrollIntentTimer: number | null = null;
let scrollbarPointerActive = false;
let previousTouchY: number | null = null;
let lastPointerClientY: number | null = null;

/** After an explicit upward gesture, keep user ownership for this long even
 *  when the view is still inside the bottom tolerance, so streaming cannot
 *  immediately snap it back to the live edge. */
const UPWARD_GRACE_MS = 500;
let lastUpInputAt = 0;

function clearUserScrollIntent(): void {
  hasUserScrollIntent = false;
  if (userScrollIntentTimer !== null) {
    window.clearTimeout(userScrollIntentTimer);
    userScrollIntentTimer = null;
  }
}

function markUserScrollIntent(): void {
  hasUserScrollIntent = true;
  if (userScrollIntentTimer !== null) {
    window.clearTimeout(userScrollIntentTimer);
  }
  userScrollIntentTimer = window.setTimeout(clearUserScrollIntent, 300);
}

/**
 * Hand scroll control to the user immediately, before the browser fires the
 * scroll event for this input. Waiting for the event lets an already-scheduled
 * follow frame (queued by the previous streaming chunk) run first and yank the
 * view back to the bottom, which makes auto-scroll appear to fight the wheel.
 */
function takeUserScrollControl(): void {
  markUserScrollIntent();
  cancelFollowScroll();
  state.scrollOwner = "user";
}

/** An explicit gesture toward older content (wheel up, thumb up, touch up,
 *  page-up keys). It takes control and latches it for UPWARD_GRACE_MS so a
 *  follow-up scroll event that is still inside the bottom tolerance cannot
 *  hand the view back to streaming. */
function markUpwardScrollInput(): void {
  takeUserScrollControl();
  lastUpInputAt = performance.now();
}

function clearUpwardScrollGrace(): void {
  lastUpInputAt = 0;
}

function isConversationAtBottom(threshold = 50): boolean {
  return state.chatContainer.scrollHeight -
      state.chatContainer.scrollTop -
      state.chatContainer.clientHeight <
    threshold;
}

state.chatContainer.addEventListener("wheel", (event) => {
  if (event.deltaY === 0) { return; }
  if (event.deltaY < 0) {
    // Scrolling up always means the user is reading older content: stop
    // auto-scroll immediately and keep control near the live edge.
    markUpwardScrollInput();
  } else {
    // A downward gesture may reach the live edge and hand control back.
    clearUpwardScrollGrace();
    if (!isConversationAtBottom()) {
      // Scrolling down through older content also takes over until the live
      // edge is reached again.
      takeUserScrollControl();
    }
  }
}, { passive: true });

state.chatContainer.addEventListener("pointerdown", (event) => {
  const bounds = state.chatContainer.getBoundingClientRect();
  const scrollbarWidth = Math.max(
    12,
    state.chatContainer.offsetWidth - state.chatContainer.clientWidth,
  );
  if (event.button === 1 || event.clientX >= bounds.right - scrollbarWidth) {
    scrollbarPointerActive = true;
    lastPointerClientY = event.clientY;
    takeUserScrollControl();
  }
});

state.chatContainer.addEventListener("pointermove", (event) => {
  if (!scrollbarPointerActive) { return; }
  if (lastPointerClientY !== null && event.clientY < lastPointerClientY) {
    markUpwardScrollInput();
  } else {
    clearUpwardScrollGrace();
    takeUserScrollControl();
  }
  lastPointerClientY = event.clientY;
});
document.addEventListener("pointerup", () => {
  scrollbarPointerActive = false;
  lastPointerClientY = null;
});
document.addEventListener("pointercancel", () => {
  scrollbarPointerActive = false;
  lastPointerClientY = null;
});
window.addEventListener("blur", () => {
  scrollbarPointerActive = false;
  lastPointerClientY = null;
  clearUserScrollIntent();
});

state.chatContainer.addEventListener("touchstart", (event) => {
  previousTouchY = event.touches[0]?.clientY ?? null;
}, { passive: true });
state.chatContainer.addEventListener("touchmove", (event) => {
  const currentTouchY = event.touches[0]?.clientY;
  if (currentTouchY !== undefined && previousTouchY !== null && currentTouchY > previousTouchY) {
    markUpwardScrollInput();
  }
  previousTouchY = currentTouchY ?? null;
}, { passive: true });
state.chatContainer.addEventListener("touchend", () => {
  previousTouchY = null;
}, { passive: true });
state.chatContainer.addEventListener("touchcancel", () => {
  previousTouchY = null;
}, { passive: true });

// Keyboard events scroll the conversation only when focus is outside an editor.
document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && (
    target.isContentEditable || target.matches("input, textarea, select")
  )) {
    return;
  }
  if (
    event.key === "ArrowUp" || event.key === "PageUp" || event.key === "Home" ||
    (event.key === " " && event.shiftKey)
  ) {
    markUpwardScrollInput();
  }
});

state.chatContainer.addEventListener("scroll", () => {
  const atBottom = isConversationAtBottom();
  const inUpwardGrace =
    atBottom && performance.now() - lastUpInputAt < UPWARD_GRACE_MS;
  state.scrollOwner = nextScrollOwner(state.scrollOwner, {
    isAtBottom: inUpwardGrace ? false : atBottom,
    hasUserIntent: inUpwardGrace || hasUserScrollIntent || scrollbarPointerActive,
  });
  if (atBottom && !inUpwardGrace) { clearUserScrollIntent(); }

  if (shouldLoadOlderHistory({
    scrollTop: state.chatContainer.scrollTop,
    hasMore: state.historyHasMore,
    loading: state.historyLoading,
    streaming: state.isStreaming,
    inBatch: state._inBatch,
    owner: state.scrollOwner,
  })) {
    state.historyLoading = true;
    vscode.postMessage({ type: "loadOlderHistory" });
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    recoverViewportLayout();
    if (state.scrollOwner === "stream") {
      scrollToBottom();
    }
  }
});

window.addEventListener("pageshow", recoverViewportLayout);

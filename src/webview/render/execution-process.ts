export type ExecutionProcessItemKind = "content" | "process";

export interface ExecutionProcessRun {
  start: number;
  length: number;
}

export function findExecutionProcessRuns(kinds: readonly ExecutionProcessItemKind[]): ExecutionProcessRun[] {
  const runs: ExecutionProcessRun[] = [];
  let start = -1;
  for (let index = 0; index <= kinds.length; index++) {
    if (kinds[index] === "process") {
      if (start < 0) { start = index; }
      continue;
    }
    if (start >= 0) {
      runs.push({ start, length: index - start });
      start = -1;
    }
  }
  return runs;
}

function isExecutionProcessElement(element: Element): boolean {
  return element.classList.contains("thinking-block")
    || element.classList.contains("tool-block")
    || element.classList.contains("bash-execution")
    || element.classList.contains("bash-block");
}

function isEmptyAssistantStub(message: HTMLElement): boolean {
  // A model response that only emitted a tool call leaves an empty assistant
  // message (hidden by CSS). It carries no visible prose, so it must not break
  // a contiguous tool run when grouping execution processes.
  if (!message.classList.contains("message") || !message.classList.contains("assistant")) {
    return false;
  }
  if (message.childElementCount !== 1) { return false; }
  const content = message.children[0];
  if (!content.classList.contains("message-content")) { return false; }
  return !content.textContent?.trim() && content.childElementCount === 0;
}

function extractThinkingBlocks(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(".message.assistant > .message-content > .thinking-block").forEach((thinking) => {
    const message = thinking.closest<HTMLElement>(".message.assistant");
    const content = thinking.parentElement;
    if (!message || !content || message.parentElement !== root) { return; }
    root.insertBefore(thinking, message);
    if (!content.textContent?.trim() && content.childElementCount === 0) {
      message.remove();
    }
  });
}

function countToolExecutions(nodes: readonly HTMLElement[]): number {
  let count = 0;
  for (const node of nodes) {
    if (
      node.classList.contains("tool-block")
      || node.classList.contains("bash-execution")
      || node.classList.contains("bash-block")
    ) {
      count++;
    }
  }
  return count;
}

function createExecutionProcess(nodes: readonly HTMLElement[]): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = "execution-process";
  const summary = document.createElement("summary");
  summary.className = "execution-process-summary";
  const execCount = countToolExecutions(nodes);
  summary.textContent = execCount > 0 ? `Investigated · ${execCount} Exec` : "Thought";
  const content = document.createElement("div");
  content.className = "execution-process-content";
  details.append(summary, content);
  nodes[0]?.parentElement?.insertBefore(details, nodes[0]);
  content.append(...nodes);
  return details;
}

export function openExecutionProcessForElement(element: Element): void {
  const details = element.closest<HTMLDetailsElement>("details.execution-process");
  if (details) { details.open = true; }
}

interface ThinkingComponentLike {
  expand?: () => void;
}

/** Expand a finished thinking block that was just folded into an execution
 *  group, so it reads directly in its internal scroller. Live blocks (still
 *  showing a spinner) and non-component nodes are left untouched. */
function expandFinishedThinking(block: HTMLElement): void {
  if (typeof block.querySelector === "function") {
    if (block.querySelector(".thinking-spinner")) { return; }
  }
  const component = (block as HTMLElement & { _component?: ThinkingComponentLike })._component;
  if (component && typeof component.expand === "function") {
    component.expand();
    return;
  }
  if (typeof block.classList.remove === "function") {
    block.classList.remove("thinking-collapsed");
  }
  const button = typeof block.querySelector === "function"
    ? block.querySelector<HTMLElement>(".thinking-expand-btn")
    : null;
  if (button) { button.textContent = "Show less"; }
}

/** Group completed thinking and tool runs without touching assistant prose. */
export function collapseExecutionProcesses(root: HTMLElement): void {
  extractThinkingBlocks(root);
  // Drop empty assistant stubs (tool-only responses) so consecutive tool calls
  // merge into a single execution run instead of several adjacent groups.
  Array.from(root.children as HTMLCollectionOf<HTMLElement>).forEach((child) => {
    if (isEmptyAssistantStub(child)) { child.remove(); }
  });
  const children = Array.from(root.children) as HTMLElement[];
  const kinds = children.map<ExecutionProcessItemKind>((element) =>
    isExecutionProcessElement(element) ? "process" : "content",
  );
  const runs = findExecutionProcessRuns(kinds);
  for (let index = runs.length - 1; index >= 0; index--) {
    const run = runs[index]!;
    createExecutionProcess(children.slice(run.start, run.start + run.length));
    // The outer details row is the only fold the user should see: open any
    // finished thinking block inside the group so its text reads directly in
    // its internal scroller instead of requiring a second level of collapsing.
    children.slice(run.start, run.start + run.length).forEach((node) => {
      if (node.classList.contains("thinking-block")) { expandFinishedThinking(node); }
    });
  }
}

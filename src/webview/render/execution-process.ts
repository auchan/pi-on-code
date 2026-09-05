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

function createExecutionProcess(nodes: readonly HTMLElement[]): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = "execution-process";
  const summary = document.createElement("summary");
  summary.className = "execution-process-summary";
  summary.textContent = `Execution process · ${nodes.length} ${nodes.length === 1 ? "step" : "steps"}`;
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

/** Group completed thinking and tool runs without touching assistant prose. */
export function collapseExecutionProcesses(root: HTMLElement): void {
  extractThinkingBlocks(root);
  const children = Array.from(root.children) as HTMLElement[];
  const kinds = children.map<ExecutionProcessItemKind>((element) =>
    isExecutionProcessElement(element) ? "process" : "content",
  );
  const runs = findExecutionProcessRuns(kinds);
  for (let index = runs.length - 1; index >= 0; index--) {
    const run = runs[index]!;
    createExecutionProcess(children.slice(run.start, run.start + run.length));
  }
}

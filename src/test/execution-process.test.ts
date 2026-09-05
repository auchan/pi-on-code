import * as assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  collapseExecutionProcesses,
  findExecutionProcessRuns,
  openExecutionProcessForElement,
  type ExecutionProcessItemKind,
} from "../webview/render/execution-process.js";

class MockClassList {
  constructor(private readonly owner: MockElement) {}

  contains(name: string): boolean {
    return this.owner.className.split(/\s+/).includes(name);
  }
}

class MockElement {
  className = "";
  readonly classList = new MockClassList(this);
  readonly children: MockElement[] = [];
  parentElement: MockElement | null = null;
  open = false;
  private ownText = "";

  constructor(readonly tagName: string) {}

  get childElementCount(): number { return this.children.length; }

  get textContent(): string {
    return this.ownText + this.children.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    this.ownText = value;
    this.children.splice(0).forEach((child) => { child.parentElement = null; });
  }

  append(...nodes: MockElement[]): void {
    for (const node of nodes) {
      node.detach();
      node.parentElement = this;
      this.children.push(node);
    }
  }

  insertBefore(node: MockElement, reference: MockElement): void {
    node.detach();
    const index = this.children.indexOf(reference);
    assert.notStrictEqual(index, -1, "reference node must be a child");
    node.parentElement = this;
    this.children.splice(index, 0, node);
  }

  remove(): void { this.detach(); }

  closest<T>(selector: string): T | null {
    let candidate: MockElement | null = this;
    while (candidate) {
      if (
        (selector === ".message.assistant" && candidate.classList.contains("message") && candidate.classList.contains("assistant"))
        || (selector === "details.execution-process" && candidate.tagName === "details" && candidate.classList.contains("execution-process"))
      ) {
        return candidate as T;
      }
      candidate = candidate.parentElement;
    }
    return null;
  }

  querySelectorAll<T>(selector: string): T[] {
    assert.strictEqual(selector, ".message.assistant > .message-content > .thinking-block");
    const matches: MockElement[] = [];
    const visit = (element: MockElement): void => {
      if (
        element.classList.contains("thinking-block")
        && element.parentElement?.classList.contains("message-content")
        && element.parentElement.parentElement?.classList.contains("message")
        && element.parentElement.parentElement.classList.contains("assistant")
      ) {
        matches.push(element);
      }
      element.children.forEach(visit);
    };
    this.children.forEach(visit);
    return matches as T[];
  }

  private detach(): void {
    if (!this.parentElement) { return; }
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) { this.parentElement.children.splice(index, 1); }
    this.parentElement = null;
  }
}

function element(tagName: string, className = "", text = ""): MockElement {
  const node = new MockElement(tagName);
  node.className = className;
  node.textContent = text;
  return node;
}

function assistant(thinking: MockElement, prose: string): MockElement {
  const message = element("div", "message assistant");
  const content = element("div", "message-content");
  content.append(thinking, element("p", "", prose));
  message.append(content);
  return message;
}

function withMockDocument(run: () => void): void {
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: (tagName: string) => new MockElement(tagName) },
  });
  try {
    run();
  } finally {
    if (original) { Object.defineProperty(globalThis, "document", original); }
    else { delete (globalThis as { document?: Document }).document; }
  }
}

suite("Execution process grouping", () => {
  test("groups contiguous thinking and tool steps between prose", () => {
    const kinds: ExecutionProcessItemKind[] = [
      "content", "process", "process", "process", "content", "process", "content",
    ];
    assert.deepStrictEqual(findExecutionProcessRuns(kinds), [
      { start: 1, length: 3 },
      { start: 5, length: 1 },
    ]);
  });

  test("extracts thinking, creates closed process details, and preserves prose order", () => {
    withMockDocument(() => {
      const root = element("main");
      const user = element("div", "message user", "request");
      const thinkingBefore = element("div", "thinking-block", "reasoning one");
      const firstAnswer = assistant(thinkingBefore, "checking now");
      const toolOne = element("div", "tool-block", "read");
      const toolTwo = element("div", "bash-execution", "git status");
      const thinkingAfter = element("div", "thinking-block", "reasoning two");
      const finalAnswer = assistant(thinkingAfter, "done");
      root.append(user, firstAnswer, toolOne, toolTwo, finalAnswer);

      collapseExecutionProcesses(root as unknown as HTMLElement);

      assert.strictEqual(root.children.length, 5);
      assert.strictEqual(root.children[0], user);
      assert.strictEqual(root.children[2], firstAnswer);
      assert.strictEqual(root.children[4], finalAnswer);

      const firstProcess = root.children[1];
      const secondProcess = root.children[3];
      assert.strictEqual(firstProcess.tagName, "details");
      assert.strictEqual(firstProcess.className, "execution-process");
      assert.strictEqual(firstProcess.open, false, "process groups must start collapsed");
      assert.strictEqual(
        firstProcess.children[0].textContent,
        "Thought",
        "thinking-only groups use the Thought title",
      );
      assert.strictEqual(
        secondProcess.children[0].textContent,
        "* Investigated · 2 Exec",
        "tool count excludes thinking blocks",
      );
      assert.deepStrictEqual(firstProcess.children[1].children, [thinkingBefore]);
      assert.deepStrictEqual(secondProcess.children[1].children, [toolOne, toolTwo, thinkingAfter]);
      assert.ok(firstAnswer.textContent.includes("checking now"));
      assert.ok(finalAnswer.textContent.includes("done"));

      openExecutionProcessForElement(toolOne as unknown as Element);
      assert.strictEqual(secondProcess.open, true, "revealing a nested tool must expand its process");
    });
  });

  test("hooks completed live turns, initial replay, and paginated history", () => {
    const handlers = readFileSync(
      new URL("../../src/webview/handlers/index.ts", import.meta.url),
      "utf8",
    );
    assert.match(handlers, /handleAgentEnd\(\)[\s\S]*?!state\._inBatch[^\n]*collapseExecutionProcesses/);
    assert.match(handlers, /handleBatchEnd\(data: any\)[\s\S]*?collapseExecutionProcesses\(state\.chatContainer\)/);
    assert.match(handlers, /handleHistoryPageEnd\(data: any\)[\s\S]*?collapseExecutionProcesses\(context\.root\)/);
    assert.match(handlers, /openExecutionProcessForElement\(el\)/);
  });
});

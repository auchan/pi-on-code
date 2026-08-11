import * as vscode from "vscode";
import * as path from "node:path";
import { getWorkspaceCwd } from "./workspace-context.js";

/**
 * Creates the VS Code bridge tools that give the AI agent visibility into
 * the VS Code editor state.
 *
 * A single consolidated tool `vscode_workspace_tool` is injected to keep the
 * tool definitions lean; it dispatches every VS Code capability (including
 * opening files and applying edits) through an `action` parameter.
 *
 * Accepts `defineTool` and `Type` from the pi SDK so all tools use the
 * SDK's type-safe definition pattern.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createBridgeTools(defineTool: Function, Type: any): any[] {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [];

  // Helper: truncate text to reasonable limits
  const truncateText = (text: string, maxLines = 2000, maxBytes = 50 * 1024): string => {
    const lines = text.split("\n");
    let output = lines.length > maxLines ? lines.slice(0, maxLines).join("\n") : text;
    if (Buffer.byteLength(output, "utf8") > maxBytes) {
      output = Buffer.from(output, "utf8").subarray(0, maxBytes).toString("utf8");
    }
    return output;
  };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boundedJson = (value: any): string => {
    const text = JSON.stringify(value) ?? "null";
    const lineCount = text.split("\n").length;
    const byteCount = Buffer.byteLength(text, "utf8");
    if (lineCount <= 2000 && byteCount <= 50 * 1024) { return text; }
    return JSON.stringify({
      truncated: true,
      message: "Result exceeded output limits.",
      originalBytes: byteCount,
      originalLines: lineCount,
      resultJsonPrefix: truncateText(text),
    });
  };

  const getWorkspaceFolders = (): Array<{ uri: string; name: string; index: number }> =>
    (vscode.workspace.workspaceFolders ?? []).map((f) => ({
      uri: f.uri.toString(),
      name: f.name,
      index: f.index,
    }));

  const workspaceRelativePath = (filePath: string): string => {
    if (!filePath) { return ""; }
    const folders = vscode.workspace.workspaceFolders ?? [];
    const roots = [...folders.map((f) => f.uri.fsPath), getWorkspaceCwd()].filter(Boolean);

    let best = filePath;
    for (const root of roots) {
      const relative = path.relative(root, filePath);
      if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
        if (!relative) { return path.basename(filePath); }
        if (relative.length < best.length) { best = relative; }
      }
    }
    return best;
  };

  const resolvePath = (filePath?: string): string | undefined => {
    if (!filePath) { return undefined; }
    if (path.isAbsolute(filePath)) { return filePath; }
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      return path.resolve(folders[0].uri.fsPath, filePath);
    }
    return path.resolve(getWorkspaceCwd(), filePath);
  };

  const positionType = Type.Object({
    line: Type.Number({ description: "Zero-based line number" }),
    character: Type.Number({ description: "Zero-based character offset" }),
  });

  const errorResult = (message: string): { content: { type: string; text: string }[]; details: object } => ({
    content: [{ type: "text", text: message }],
    details: {},
  });

  // ── Tool: vscode_workspace_tool (consolidated VS Code capabilities) ───

  tools.push(
    defineTool({
      name: "vscode_workspace_tool",
      label: "VS Code Workspace Tool",
      description:
        "Consolidated VS Code tool. Use the action parameter to select a capability; only provide the parameters that action needs. Actions: open_file (open a file, optional preview/preserveFocus/selection), editor_state (active editor, selection, workspace folders, open editors), selection (current selection text and range), diagnostics (LSP/lint/type errors, optional filePath), open_editors (visible editors with dirty state), workspace_folders, document_dirty (is a file open/dirty), save_document, document_symbols (outline from language server), definitions (symbol definitions at position), hover (types/signatures/docs at position), references (symbol references at position), workspace_symbols (query), code_actions (quick fixes for a range, optional start/end), apply_edit (range replacements, uses edits), format_document.",
      executionMode: "sequential",
      parameters: Type.Object({
        action: Type.Enum({
          open_file: "open_file",
          editor_state: "editor_state",
          selection: "selection",
          diagnostics: "diagnostics",
          open_editors: "open_editors",
          workspace_folders: "workspace_folders",
          document_dirty: "document_dirty",
          save_document: "save_document",
          document_symbols: "document_symbols",
          definitions: "definitions",
          hover: "hover",
          references: "references",
          workspace_symbols: "workspace_symbols",
          code_actions: "code_actions",
          apply_edit: "apply_edit",
          format_document: "format_document",
        }, { description: "Which VS Code capability to run" }),
        filePath: Type.Optional(Type.String({ description: "Absolute or workspace-relative file path" })),
        position: Type.Optional(positionType),
        start: Type.Optional(positionType),
        end: Type.Optional(positionType),
        query: Type.Optional(Type.String({ description: "Workspace symbol search query" })),
        preview: Type.Optional(Type.Boolean({ description: "Open in preview mode (open_file)" })),
        preserveFocus: Type.Optional(Type.Boolean({ description: "Keep focus in the current editor (open_file)" })),
        selection: Type.Optional(Type.Object({
          start: positionType,
          end: positionType,
        }, { description: "Optional range to reveal (open_file)" })),
        edits: Type.Optional(Type.Array(Type.Object({
          filePath: Type.String({ description: "Absolute or workspace-relative file path" }),
          range: Type.Object({
            start: positionType,
            end: positionType,
          }),
          newText: Type.String({ description: "Replacement text" }),
        }), { description: "List of text replacements for apply_edit" })),
      }, { additionalProperties: false }),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: async (_toolCallId: string, params: any) => {
        switch (params.action) {
          case "open_file": {
            const resolved = resolvePath(params.filePath);
            if (!resolved) {
              return errorResult("Error: no file path provided");
            }

            const uri = vscode.Uri.file(resolved);
            const doc = await vscode.workspace.openTextDocument(uri);

            const sel = params.selection;
            const selection = sel
              ? new vscode.Selection(
                  new vscode.Position(sel.start.line, sel.start.character),
                  new vscode.Position(sel.end.line, sel.end.character),
                )
              : undefined;

            await vscode.window.showTextDocument(doc, {
              preview: params.preview ?? true,
              preserveFocus: params.preserveFocus ?? false,
              ...(selection ? { selection } : {}),
            });

            return {
              content: [{
                type: "text",
                text: boundedJson({
                  opened: resolved,
                  relativePath: workspaceRelativePath(resolved),
                  languageId: doc.languageId,
                  lineCount: doc.lineCount,
                }),
              }],
              details: {},
            };
          }

          case "editor_state": {
            const editor = vscode.window.activeTextEditor;
            const selection = editor?.selection;
            const doc = editor?.document;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
            const state: any = {
              workspaceFolders: getWorkspaceFolders(),
              openEditors: vscode.window.visibleTextEditors.map((e) => ({
                filePath: e.document.uri.fsPath,
                languageId: e.document.languageId,
                isDirty: e.document.isDirty,
                isUntitled: e.document.isUntitled,
              })),
              activeEditor: doc
                ? {
                    filePath: doc.uri.fsPath,
                    languageId: doc.languageId,
                    isDirty: doc.isDirty,
                    isUntitled: doc.isUntitled,
                    lineCount: doc.lineCount,
                  }
                : null,
              selection: selection
                ? {
                    start: { line: selection.start.line, character: selection.start.character },
                    end: { line: selection.end.line, character: selection.end.character },
                    isEmpty: selection.isEmpty,
                    text: doc?.getText(selection) ?? "",
                  }
                : null,
            };

            return { content: [{ type: "text", text: boundedJson(state) }], details: {} };
          }

          case "selection": {
            const editor = vscode.window.activeTextEditor;
            const doc = editor?.document;
            const selection = editor?.selection;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result: any = {
              filePath: doc?.uri.fsPath ?? null,
              languageId: doc?.languageId ?? null,
              selection: selection
                ? {
                    start: { line: selection.start.line, character: selection.start.character },
                    end: { line: selection.end.line, character: selection.end.character },
                    isEmpty: selection.isEmpty,
                    text: doc?.getText(selection) ?? "",
                  }
                : null,
            };

            return { content: [{ type: "text", text: boundedJson(result) }], details: {} };
          }

          case "diagnostics": {
            const resolved = resolvePath(params.filePath);
            const allDiagnostics = vscode.languages.getDiagnostics();

            let diagnostics: [vscode.Uri, readonly vscode.Diagnostic[]][];
            if (resolved) {
              const uri = vscode.Uri.file(resolved);
              diagnostics = allDiagnostics.filter(([u]) => u.fsPath === uri.fsPath);
            } else {
              diagnostics = allDiagnostics;
            }

            const result = diagnostics.map(([uri, diags]) => ({
              filePath: uri.fsPath,
              relativePath: workspaceRelativePath(uri.fsPath),
              diagnostics: diags.map((d) => ({
                message: d.message,
                severity: ["error", "warning", "info", "hint"][d.severity],
                range: {
                  start: { line: d.range.start.line, character: d.range.start.character },
                  end: { line: d.range.end.line, character: d.range.end.character },
                },
                source: d.source,
                code: typeof d.code === "object" ? String(d.code?.value ?? "") : String(d.code ?? ""),
              })),
            }));

            const counts = { errors: 0, warnings: 0, infos: 0, hints: 0 };
            for (const [, diags] of diagnostics) {
              for (const d of diags) {
                if (d.severity === vscode.DiagnosticSeverity.Error) { counts.errors++; }
                else if (d.severity === vscode.DiagnosticSeverity.Warning) { counts.warnings++; }
                else if (d.severity === vscode.DiagnosticSeverity.Information) { counts.infos++; }
                else if (d.severity === vscode.DiagnosticSeverity.Hint) { counts.hints++; }
              }
            }

            return {
              content: [{ type: "text", text: boundedJson({ counts, diagnostics: result }) }],
              details: {},
            };
          }

          case "open_editors": {
            const activeEditor = vscode.window.activeTextEditor;
            const result = {
              activeFilePath: activeEditor?.document.uri.fsPath ?? null,
              editors: vscode.window.visibleTextEditors.map((e) => ({
                filePath: e.document.uri.fsPath,
                relativePath: workspaceRelativePath(e.document.uri.fsPath),
                languageId: e.document.languageId,
                isDirty: e.document.isDirty,
                isUntitled: e.document.isUntitled,
              })),
            };

            return { content: [{ type: "text", text: boundedJson(result) }], details: {} };
          }

          case "workspace_folders": {
            return {
              content: [{ type: "text", text: boundedJson({ folders: getWorkspaceFolders(), cwd: getWorkspaceCwd() }) }],
              details: {},
            };
          }

          case "document_dirty": {
            const resolved = resolvePath(params.filePath);
            if (!resolved) {
              return errorResult(boundedJson({ error: "No file path provided" }));
            }
            const uri = vscode.Uri.file(resolved);
            const editor = vscode.window.visibleTextEditors.find((e) => e.document.uri.fsPath === uri.fsPath);
            return {
              content: [{
                type: "text",
                text: boundedJson({
                  filePath: resolved,
                  isOpen: !!editor,
                  isDirty: editor?.document.isDirty ?? false,
                  languageId: editor?.document.languageId ?? null,
                }),
              }],
              details: {},
            };
          }

          case "save_document": {
            const resolved = resolvePath(params.filePath);
            if (!resolved) {
              return errorResult("Error: no file path provided");
            }
            const uri = vscode.Uri.file(resolved);
            const doc = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === uri.fsPath);
            if (doc && doc.isDirty) { await doc.save(); }
            return {
              content: [{ type: "text", text: boundedJson({ saved: resolved, wasDirty: doc?.isDirty ?? false }) }],
              details: {},
            };
          }

          case "document_symbols": {
            const resolved = resolvePath(params.filePath);
            if (!resolved) {
              return errorResult("Error: no file path provided");
            }
            const uri = vscode.Uri.file(resolved);
            const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
              "vscode.executeDocumentSymbolProvider",
              uri,
            );
            return {
              content: [{
                type: "text",
                text: boundedJson({
                  filePath: resolved,
                  symbols: (symbols ?? []).map((s) => ({
                    name: s.name,
                    kind: vscode.SymbolKind[s.kind],
                    location: {
                      filePath: s.location.uri.fsPath,
                      range: {
                        start: { line: s.location.range.start.line, character: s.location.range.start.character },
                        end: { line: s.location.range.end.line, character: s.location.range.end.character },
                      },
                    },
                    containerName: s.containerName,
                  })),
                }),
              }],
              details: {},
            };
          }

          case "definitions": {
            const resolved = resolvePath(params.filePath);
            if (!resolved) {
              return errorResult("Error: no file path provided");
            }
            const uri = vscode.Uri.file(resolved);
            const pos = new vscode.Position(params.position.line, params.position.character);
            const locations = await vscode.commands.executeCommand<vscode.Location[]>(
              "vscode.executeDefinitionProvider",
              uri,
              pos,
            );
            return {
              content: [{
                type: "text",
                text: boundedJson(
                  (locations ?? []).map((l) => ({
                    filePath: l.uri.fsPath,
                    relativePath: workspaceRelativePath(l.uri.fsPath),
                    range: {
                      start: { line: l.range.start.line, character: l.range.start.character },
                      end: { line: l.range.end.line, character: l.range.end.character },
                    },
                  })),
                ),
              }],
              details: {},
            };
          }

          case "hover": {
            const resolved = resolvePath(params.filePath);
            if (!resolved) {
              return errorResult("Error: no file path provided");
            }
            const uri = vscode.Uri.file(resolved);
            const pos = new vscode.Position(params.position.line, params.position.character);
            const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
              "vscode.executeHoverProvider",
              uri,
              pos,
            );
            const result = (hovers ?? []).map((h) => ({
              contents: h.contents.map((c) => {
                if (typeof c === "string") { return c; }
                if (typeof c === "object" && "value" in c) { return c.value; }
                if (typeof c === "object" && "language" in c) {
                  const mc = c as { language: string; value: string };
                  return `\`\`\`${mc.language}\n${mc.value}\n\`\`\``;
                }
                return String(c);
              }),
              range: h.range
                ? { start: { line: h.range.start.line, character: h.range.start.character }, end: { line: h.range.end.line, character: h.range.end.character } }
                : null,
            }));
            return { content: [{ type: "text", text: boundedJson(result) }], details: {} };
          }

          case "references": {
            const resolved = resolvePath(params.filePath);
            if (!resolved) {
              return errorResult("Error: no file path provided");
            }
            const uri = vscode.Uri.file(resolved);
            const pos = new vscode.Position(params.position.line, params.position.character);
            const locations = await vscode.commands.executeCommand<vscode.Location[]>(
              "vscode.executeReferenceProvider",
              uri,
              pos,
            );
            return {
              content: [{
                type: "text",
                text: boundedJson(
                  (locations ?? []).map((l) => ({
                    filePath: l.uri.fsPath,
                    relativePath: workspaceRelativePath(l.uri.fsPath),
                    range: {
                      start: { line: l.range.start.line, character: l.range.start.character },
                      end: { line: l.range.end.line, character: l.range.end.character },
                    },
                  })),
                ),
              }],
              details: {},
            };
          }

          case "workspace_symbols": {
            const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
              "vscode.executeWorkspaceSymbolProvider",
              params.query,
            );
            return {
              content: [{
                type: "text",
                text: boundedJson(
                  (symbols ?? []).map((s) => ({
                    name: s.name,
                    kind: vscode.SymbolKind[s.kind],
                    location: {
                      filePath: s.location.uri.fsPath,
                      relativePath: workspaceRelativePath(s.location.uri.fsPath),
                      range: {
                        start: { line: s.location.range.start.line, character: s.location.range.start.character },
                        end: { line: s.location.range.end.line, character: s.location.range.end.character },
                      },
                    },
                    containerName: s.containerName,
                  })),
                ),
              }],
              details: {},
            };
          }

          case "code_actions": {
            const resolved = resolvePath(params.filePath);
            if (!resolved) {
              return errorResult("Error: no file path provided");
            }
            const uri = vscode.Uri.file(resolved);
            const range = params.start
              ? new vscode.Range(
                  new vscode.Position(params.start.line, params.start.character),
                  new vscode.Position(params.end?.line ?? params.start.line, params.end?.character ?? params.start.character),
                )
              : new vscode.Range(0, 0, 0, 0);
            const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
              "vscode.executeCodeActionProvider",
              uri,
              range,
            );
            return {
              content: [{
                type: "text",
                text: boundedJson(
                  (codeActions ?? []).map((a, i) => ({
                    id: `action-${i}`,
                    title: a.title,
                    kind: a.kind?.value ?? "",
                    isPreferred: a.isPreferred,
                    disabled: a.disabled?.reason ?? null,
                  })),
                ),
              }],
              details: {},
            };
          }

          case "apply_edit": {
            const we = new vscode.WorkspaceEdit();
            for (const edit of params.edits ?? []) {
              const resolved = resolvePath(edit.filePath);
              if (!resolved) { continue; }
              const uri = vscode.Uri.file(resolved);
              const range = new vscode.Range(
                new vscode.Position(edit.range.start.line, edit.range.start.character),
                new vscode.Position(edit.range.end.line, edit.range.end.character),
              );
              we.replace(uri, range, edit.newText);
            }
            const success = await vscode.workspace.applyEdit(we);
            // Save each edited file so the disk matches the buffer and subsequent
            // read/edit operations see the current content.
            const savedPaths = new Set<string>();
            for (const edit of params.edits ?? []) {
              const resolved = resolvePath(edit.filePath);
              if (!resolved || savedPaths.has(resolved)) { continue; }
              savedPaths.add(resolved);
              const doc = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === resolved);
              if (doc?.isDirty) { await doc.save(); }
            }
            return {
              content: [{ type: "text", text: boundedJson({ applied: success, editCount: params.edits?.length ?? 0, saved: savedPaths.size }) }],
              details: {},
            };
          }

          case "format_document": {
            const resolved = resolvePath(params.filePath);
            if (!resolved) {
              return errorResult("Error: no file path provided");
            }
            const uri = vscode.Uri.file(resolved);
            const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
              "vscode.executeFormatDocumentProvider",
              uri,
              {},
            );
            if (edits && edits.length > 0) {
              const we = new vscode.WorkspaceEdit();
              for (const edit of edits) {
                we.replace(uri, edit.range, edit.newText);
              }
              await vscode.workspace.applyEdit(we);
            }
            return {
              content: [{ type: "text", text: boundedJson({ formatted: resolved, editsApplied: edits?.length ?? 0 }) }],
              details: {},
            };
          }

          default:
            return errorResult(`Unknown vscode_workspace_tool action: ${params.action}`);
        }
      },
    }),
  );

  return tools;
}

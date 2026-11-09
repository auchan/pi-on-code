// Offline compatibility check against a real installed Pi SDK.
// PI_SDK_PATH points at the package root; no user settings/sessions are read.
// Run with Node (the VS Code extension host runtime), not Bun's module loader.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

function resolveSdkRoot() {
  if (process.env.PI_SDK_PATH) return path.resolve(process.env.PI_SDK_PATH);
  const suffix = path.join("node_modules", "@earendil-works", "pi-coding-agent");
  const candidates = [
    process.env.APPDATA && path.join(process.env.APPDATA, "npm", suffix),
    path.join(os.homedir(), ".pi", "npm", suffix),
    path.join(os.homedir(), ".npm-global", "lib", suffix),
    path.join(os.homedir(), ".local", "lib", suffix),
    path.join("/usr/local/lib", suffix),
    path.join("/usr/lib", suffix),
  ];
  const root = candidates.find((candidate) => candidate && fs.existsSync(path.join(candidate, "package.json")));
  assert.ok(root, "Set PI_SDK_PATH to an installed @earendil-works/pi-coding-agent package root");
  return root;
}

const sdkRoot = resolveSdkRoot();
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pi-sdk-smoke-"));
const agentDir = path.join(cwd, "agent");
// Set before importing Pi: avoid discovery of real user resources/credentials.
process.env.PI_CODING_AGENT_DIR = agentDir;
const SDK = await import(pathToFileURL(path.join(sdkRoot, "dist/index.js")).href);
const pkg = JSON.parse(fs.readFileSync(path.join(sdkRoot, "package.json"), "utf8"));
console.log(`Pi ${pkg.version}, Node ${process.versions.node}`);
let session;
try {
  for (const name of ["ModelRuntime", "ModelRegistry", "SessionManager", "SettingsManager",
    "DefaultPackageManager", "createAgentSessionServices", "createAgentSessionFromServices",
    "createSyntheticSourceInfo", "defineTool"]) {
    assert.equal(typeof SDK[name], "function", name);
  }
  fs.mkdirSync(agentDir, { recursive: true });
  const runtime = await SDK.ModelRuntime.create({
    authPath: path.join(agentDir, "auth.json"),
    modelsPath: path.join(agentDir, "models.json"),
    modelsStorePath: path.join(agentDir, "models-cache.json"),
    allowModelNetwork: false,
    refreshOnCreate: false,
  });
  const model = runtime.getModels().find((candidate) => candidate.provider === "openai");
  assert.ok(model, "offline catalog contains a real chat model");
  assert.ok(new SDK.ModelRegistry(runtime).find(model.provider, model.id));
  const services = await SDK.createAgentSessionServices({
    cwd, agentDir, modelRuntime: runtime,
    resourceLoaderOptions: {
      noExtensions: true, noSkills: true, noPromptTemplates: true, noContextFiles: true,
    },
  });
  assert.ok(Array.isArray(services.diagnostics));
  const manager = new SDK.DefaultPackageManager({ cwd, agentDir, settingsManager: services.settingsManager });
  assert.deepEqual(manager.listConfiguredPackages(), []);

  // Match the TypeBox loader and tool shape used by the VS Code bridge.
  const { Type } = await import(pathToFileURL(path.join(sdkRoot, "node_modules/typebox/build/index.mjs")).href);
  let executedArgs;
  const tool = SDK.defineTool({
    name: "pion_smoke", label: "Smoke", description: "Offline smoke tool",
    parameters: Type.Object({ action: Type.String(), limit: Type.Optional(Type.Number()) }),
    execute: async (_id, args) => {
      executedArgs = args;
      return { content: [{ type: "text", text: args.action }], details: {} };
    },
  });
  const sessionManager = SDK.SessionManager.create(cwd, path.join(agentDir, "sessions"));
  ({ session } = await SDK.createAgentSessionFromServices({
    services, sessionManager, model, thinkingLevel: "off", customTools: [tool],
  }));
  await session.bindExtensions({ mode: "rpc" });
  for (const name of ["prompt", "abort", "getAvailableThinkingLevels", "setThinkingLevel", "setModel",
    "getAllTools", "setActiveToolsByName", "getContextUsage", "subscribe", "reload", "dispose"]) {
    assert.equal(typeof session[name], "function", `session.${name}`);
  }
  assert.ok(session.getAllTools().some((entry) => entry.name === "pion_smoke"));
  session.setActiveToolsByName(["read", "pion_smoke"]);
  assert.deepEqual(session.getActiveToolNames().sort(), ["pion_smoke", "read"]);
  session.setThinkingLevel("off");
  assert.ok(session.getAvailableThinkingLevels().length > 0);
  console.log("ok: runtime, services, tools, RPC extension binding, package manager");

  // No provider request: replace only the stream transport, exercise the real
  // agent loop, argument validation, tool execution, and Session persistence.
  const { createAssistantMessageEventStream } = await import(pathToFileURL(
    path.join(sdkRoot, "node_modules/@earendil-works/pi-ai/dist/index.js"),
  ).href);
  await runtime.setRuntimeApiKey(model.provider, "offline-smoke-not-a-real-key");
  let responses = 0;
  session.agent.streamFunction = () => {
    assert.ok(++responses <= 2, "agent should stop after the tool result");
    const stream = createAssistantMessageEventStream();
    const message = {
      role: "assistant", api: model.api, provider: model.provider, model: model.id,
      content: [], stopReason: responses === 1 ? "toolUse" : "stop", timestamp: Date.now(),
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    };
    // Defer production until the SDK starts consuming the stream.
    setTimeout(() => {
      stream.push({ type: "start", partial: message });
      if (responses === 1) {
        const call = { type: "toolCall", id: "smoke-call", name: "pion_smoke", arguments: { action: "help", limit: "2" } };
        message.content.push(call);
        stream.push({ type: "toolcall_start", contentIndex: 0, partial: message });
        stream.push({ type: "toolcall_end", contentIndex: 0, toolCall: call, partial: message });
      } else {
        message.content.push({ type: "text", text: "Smoke complete" });
        stream.push({ type: "text_start", contentIndex: 0, partial: message });
        stream.push({ type: "text_delta", contentIndex: 0, delta: "Smoke complete", partial: message });
        stream.push({ type: "text_end", contentIndex: 0, content: "Smoke complete", partial: message });
      }
      stream.push({ type: "done", reason: message.stopReason, message });
    }, 0);
    return stream;
  };
  const events = [];
  const unsubscribe = session.subscribe((event) => events.push(event));
  try {
    await session.prompt("Run the offline smoke tool");
  } finally {
    unsubscribe();
  }
  assert.deepEqual(executedArgs, { action: "help", limit: 2 }, "SDK coerces TypeBox JSON Schema arguments");
  for (const type of ["agent_start", "message_update", "tool_execution_start", "tool_execution_end", "agent_end"]) {
    assert.ok(events.some((event) => event.type === type), type);
  }
  assert.ok(events.some((event) => event.type === "message_update" && event.message?.role === "assistant"
    && event.assistantMessageEvent?.type === "text_delta"), "direct SDK events retain the Webview's message/delta contract");
  const saved = SDK.SessionManager.open(sessionManager.getSessionFile());
  assert.ok(saved.getEntries().some((entry) => entry.type === "message" && entry.message.role === "toolResult"));
  console.log("ok: streamed turn, schema coercion, tool execution, persisted replay");

  // A deterministic legacy fixture, never a real user's Session file.
  const legacy = path.join(cwd, "legacy.jsonl");
  const timestamp = "2026-08-01T00:00:00.000Z";
  const entries = [
    { type: "session", version: 3, id: "smoke-legacy", timestamp, cwd },
    { type: "message", id: "user-1", parentId: null, timestamp,
      message: { role: "user", content: [{ type: "text", text: "Legacy prompt" }], timestamp: Date.parse(timestamp) } },
  ];
  fs.writeFileSync(legacy, entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
  const restored = SDK.SessionManager.open(legacy, path.join(agentDir, "sessions"));
  assert.equal(restored.getEntries().find((entry) => entry.id === "user-1")?.message.content[0].text, "Legacy prompt");
  assert.equal(restored.buildSessionContext().messages[0].role, "user");
  console.log("ok: legacy JSONL restore");
  console.log("SMOKE OK");
} finally {
  session?.dispose();
  fs.rmSync(cwd, { recursive: true, force: true });
}

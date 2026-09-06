// Compatibility smoke test for the installed @earendil-works/pi-coding-agent SDK.
//
// Verifies the SDK entry points Pi on Code relies on exist and boot offline on
// the installed version (ModelRuntime, SessionManager, agent session services),
// and that a legacy session JSONL written by an older agent can still be read
// (the plugin's session-restore path).
//
// Usage:
//   bun run scripts/smoke-pi-sdk.mjs
//   # or point at a specific SDK install:
//   PI_SDK_PATH=/abs/path/to/pi-coding-agent bun run scripts/smoke-pi-sdk.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);

function resolveSdkRoot() {
  if (process.env.PI_SDK_PATH && fs.existsSync(process.env.PI_SDK_PATH)) {
    return process.env.PI_SDK_PATH;
  }
  const suffix = path.join("node_modules", "@earendil-works", "pi-coding-agent");
  const candidates = new Set();
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const appData = process.env.APPDATA || "";
  for (const base of [
    home && path.join(home, ".pi", "npm", suffix),
    process.platform === "win32" && appData && path.join(appData, "npm", suffix),
    home && path.join(home, ".npm-global", "lib", suffix),
    home && path.join(home, ".local", "lib", suffix),
  ]) {
    if (base) candidates.add(base);
  }
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
  }
  throw new Error(
    "pi-coding-agent SDK not found. Install it globally first:\n" +
      "  npm install -g --ignore-scripts @earendil-works/pi-coding-agent",
  );
}

function check(ok, label, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) process.exitCode = 1;
}

const sdkRoot = resolveSdkRoot();
const SDK = require(sdkRoot);
const pkg = require(path.join(sdkRoot, "package.json"));
console.log(`pi-coding-agent ${pkg.version} at ${sdkRoot}`);

// ── root entry points used by the extension ────────────────────────────
const required = [
  "ModelRuntime",
  "ModelRegistry",
  "SessionManager",
  "createAgentSessionServices",
  "createAgentSessionFromServices",
  "createAgentSession",
  "createSyntheticSourceInfo",
];
const missing = required.filter((key) => typeof SDK[key] === "undefined");
check(missing.length === 0, "required SDK entry points present", missing.join(", ") || "all");

if (missing.length) process.exit(1);

// ── offline boot + session creation in a temp directory ────────────────
const cwd = path.join(os.tmpdir(), `pi-sdk-smoke-${Date.now()}`);
const agentDir = path.join(cwd, ".pi", "agent");
try {
  fs.mkdirSync(agentDir, { recursive: true });
  const runtime = await SDK.ModelRuntime.create({
    authPath: path.join(agentDir, "auth.json"),
    modelsPath: path.join(agentDir, "models.json"),
  });
  check(true, "ModelRuntime.create() boots offline");

  const sessionManager = SDK.SessionManager.create(cwd, agentDir);
  check(
    Boolean(sessionManager.getSessionFile?.()?.endsWith(".jsonl")),
    "SessionManager.create() returns a session path (file persists on first write)",
  );

  const services = await SDK.createAgentSessionServices({ cwd, agentDir, modelRuntime: runtime });
  check(Array.isArray(services.diagnostics), "createAgentSessionServices() returns diagnostics");

  const agent = await SDK.createAgentSessionFromServices({
    services,
    sessionManager,
    model: { provider: "openai", id: "gpt-5.6" },
  });
  const session = agent?.session;
  check(
    session && typeof session.getAvailableThinkingLevels === "function",
    "agent session exposes getAvailableThinkingLevels()",
  );
  check(typeof session?.setThinkingLevel === "function", "agent session exposes setThinkingLevel()");
  check(typeof session?.setModel === "function", "agent session exposes setModel()");
  check(typeof SDK.ModelRegistry === "function", "ModelRegistry facade constructs", "");

  // ── legacy JSONL restore path ──────────────────────────────────────────
  const legacyRoot = path.join(os.homedir(), ".pi", "agent", "sessions");
  let opened = null;
  let legacyFile = null;
  if (fs.existsSync(legacyRoot)) {
    outer: for (const project of fs.readdirSync(legacyRoot)) {
      const dir = path.join(legacyRoot, project);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".jsonl"))) {
        legacyFile = path.join(dir, file);
        break outer;
      }
    }
  }
  if (legacyFile) {
    opened = SDK.SessionManager.open(legacyFile, agentDir);
    const entries = opened.getEntries?.() ?? [];
    check(entries.length > 0, "legacy session JSONL opens and parses", `${entries.length} entries`);
  } else {
    console.log("skip no legacy session files under ~/.pi/agent/sessions");
  }

  console.log(process.exitCode ? "SMOKE FAILED" : "SMOKE OK");
} finally {
  fs.rmSync(cwd, { recursive: true, force: true });
}

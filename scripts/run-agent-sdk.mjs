#!/usr/bin/env node

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PROVIDER_CONFIG = "config/agent-providers.json";
const DEFAULT_FALLBACK_AGENT = "codex-harness:codex-main";
const DEFAULT_SDK = "anthropic";
const OPENAI_SESSION_DIR = ".codex-harness/openai-sessions";
const MAX_TOOL_BYTES = 1024 * 1024;
const MAX_TOOL_OUTPUT_BYTES = 64 * 1024;
const DEFAULT_AGENT_FALLBACKS = {
  "codex-main": { model: "sonnet", effort: "high" },
  "context-explorer": { model: "haiku", effort: "low" },
  "implementation-worker": { model: "sonnet", effort: "medium" },
  "code-reviewer": { model: "sonnet", effort: "high" },
  "verification-auditor": { model: "opus", effort: "max" }
};
const SEQUENCE_ROLE_PERMISSION_PRESETS = {
  "context-explorer": "default",
  "code-reviewer": "default",
  "verification-auditor": "default"
};
const AGENT_PERMISSION_ENVS = {
  "context-explorer": "CODEX_HARNESS_CONTEXT_EXPLORER_PERMISSION_MODE",
  "implementation-worker": "CODEX_HARNESS_IMPLEMENTATION_WORKER_PERMISSION_MODE",
  "code-reviewer": "CODEX_HARNESS_CODE_REVIEWER_PERMISSION_MODE",
  "verification-auditor": "CODEX_HARNESS_VERIFICATION_AUDITOR_PERMISSION_MODE"
};
const activeCodexChildren = new Set();

const HELP = `Usage:
  node scripts/run-agent-sdk.mjs --prompt <text> [--agent <name>] [options]
  node scripts/run-agent-sdk.mjs --prompt <text> --agent-sequence <a,b,c> [options]
  node scripts/run-agent-sdk.mjs --prompt <text> --base-url <url> --api-key-env <ENV_NAME> [options]
  node scripts/run-agent-sdk.mjs --prompt <text> --base-url <url> --auth-token-env <ENV_NAME> [options]

Provider routing:
  --agent-provider-config <path>  Agent provider manifest. Defaults to config/agent-providers.json.
  --agent-sequence <a,b,c>        Run agents sequentially, selecting provider, Codex CLI, or Claude CLI per agent.
  --sdk <openai|anthropic>        External provider SDK. Overrides sdkEnv and manifest sdk.
  --dry-run                      Print sanitized routing decisions without SDK/API/CLI execution.
  --no-fallback                  Fail instead of falling back to Claude CLI.

External provider options:
  --base-url <url>                Provider endpoint URL.
  --api-key-env <ENV_NAME>        Environment variable containing an API key.
  --auth-token-env <ENV_NAME>     Environment variable containing a bearer token.
  --model <name>                  SDK, Codex CLI, or Claude CLI session model. Defaults to "sonnet".
  --agent <name>                  Main-thread agent. Defaults to "codex-main".
  --effort <level>                SDK reasoning effort, Codex CLI effort metadata, and Claude CLI fallback effort.
  --fallback-model <name>         Claude CLI fallback model alias when no agent policy overrides it.
  --fallback-effort <level>       Claude CLI fallback effort when no agent policy overrides it.
  --haiku-model <name>            Maps the haiku alias for this run.
  --sonnet-model <name>           Maps the sonnet alias for this run.
  --opus-model <name>             Maps the opus alias for this run.
  --timeout-ms <number>           Sets API_TIMEOUT_MS for compatible providers.
  --overall-timeout-ms <number>   Aborts the SDK query after this many milliseconds.
                                  Also bounds Codex CLI and Claude CLI fallback runtime.
  --max-turns <number|none>       Maximum SDK agentic turns. Defaults to no runner-imposed turn cap.
  --max-budget-usd <number>       Maximum SDK cost before stopping.
  --permission-mode <mode>        SDK permission mode. Maps to Codex CLI sandbox/approval. Defaults to "default".
  --allowed-tools <a,b,c>         Auto-approved SDK tool names.
  --disallowed-tools <a,b,c>      Blocked SDK tool names.
  --include-partial-messages      Emit SDK partial streaming messages when available.
  --persist-session               Persist SDK session history for later resume/continue.
  --resume <session-id>           Resume an SDK or Codex CLI session by ID.
  --resume-session-at <message-id> Resume an SDK session up to a message UUID.
  --continue                      Continue the latest SDK or Codex CLI session in the current directory.
  --cwd <path>                    Working directory. Defaults to current directory.
  --plugin-path <path>            Plugin path. Defaults to plugins/codex-harness.
  --help                         Show this help.

Claude CLI fallback:
  If an agent has no external provider config, provider env is empty, or SDK execution fails,
  the runner uses Claude Code CLI directly through the harness main agent:
  claude -p --agent codex-harness:codex-main --model <model> --effort <level>.
  This preserves Claude Code Max/Pro subscription usage without calling Claude Code through Agent SDK.

Codex CLI backend:
  Agents with mode "codexCli" run local codex exec with --sandbox and --ask-for-approval never
  mapped from --permission-mode. --allowed-tools and --disallowed-tools are not applied.
  In --agent-sequence runs, role permission presets keep context-explorer, code-reviewer,
  and verification-auditor read-only by default; implementation-worker keeps the requested
  --permission-mode unless an agent-specific permission env overrides it.

Environment fallbacks:
  CODEX_HARNESS_SDK
  Agent manifests can also name per-agent sdkEnv values such as CODEX_HARNESS_CODE_REVIEWER_SDK.
  Agent manifests can name per-agent modeEnv values such as CODEX_HARNESS_CODE_REVIEWER_MODE.
  Example per-agent mode env: CODEX_HARNESS_IMPLEMENTATION_WORKER_MODE.
  Mode env values: claudeCli, codexCli, anthropic, openai, external.
  CODEX_HARNESS_AGENT_PROVIDER_CONFIG
  CODEX_HARNESS_BASE_URL
  CODEX_HARNESS_API_KEY_ENV
  CODEX_HARNESS_AUTH_TOKEN_ENV
  CODEX_HARNESS_MODEL
  CODEX_HARNESS_AGENT
  CODEX_HARNESS_AGENT_SEQUENCE
  CODEX_HARNESS_EFFORT
  CODEX_HARNESS_FALLBACK_MODEL
  CODEX_HARNESS_FALLBACK_EFFORT
  CODEX_HARNESS_TIMEOUT_MS
  CODEX_HARNESS_OVERALL_TIMEOUT_MS
  CODEX_HARNESS_MAX_BUDGET_USD
  CODEX_HARNESS_ALLOWED_TOOLS
  CODEX_HARNESS_DISALLOWED_TOOLS
  CODEX_HARNESS_INCLUDE_PARTIAL_MESSAGES
  CODEX_HARNESS_PERSIST_SESSION
  CODEX_HARNESS_RESUME
  CODEX_HARNESS_RESUME_SESSION_AT
  CODEX_HARNESS_CONTINUE
  CODEX_HARNESS_PERMISSION_MODE
  CODEX_HARNESS_CONTEXT_EXPLORER_PERMISSION_MODE
  CODEX_HARNESS_IMPLEMENTATION_WORKER_PERMISSION_MODE
  CODEX_HARNESS_CODE_REVIEWER_PERMISSION_MODE
  CODEX_HARNESS_VERIFICATION_AUDITOR_PERMISSION_MODE
  CODEX_HARNESS_PROMPT
`;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      throw new Error(`Unexpected argument: ${current}`);
    }
    const equalsIndex = current.indexOf("=");
    if (equalsIndex > -1) {
      args[current.slice(2, equalsIndex)] = current.slice(equalsIndex + 1);
      continue;
    }
    const key = current.slice(2);
    if (
      key === "help" ||
      key === "dry-run" ||
      key === "include-partial-messages" ||
      key === "persist-session" ||
      key === "continue" ||
      key === "no-fallback"
    ) {
      args[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function getOption(args, key, envName, defaultValue) {
  return args[key] ?? process.env[envName] ?? defaultValue;
}

function parseEnvValue(rawValue) {
  let value = rawValue.trim();
  const commentIndex = value.search(/\s#/);
  if (commentIndex >= 0) {
    value = value.slice(0, commentIndex).trimEnd();
  }
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(envPath, loadedEnvFiles = new Set()) {
  const resolvedPath = path.resolve(envPath);
  if (loadedEnvFiles.has(resolvedPath) || !fs.existsSync(resolvedPath)) {
    return;
  }
  loadedEnvFiles.add(resolvedPath);
  const content = fs.readFileSync(resolvedPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const normalized = line.startsWith("export ") ? line.slice("export ".length).trimStart() : line;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }
    const key = normalized.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = parseEnvValue(normalized.slice(equalsIndex + 1));
  }
}

function loadLocalEnvFiles(cwd) {
  const loadedEnvFiles = new Set();
  loadEnvFile(path.join(root, ".env.local"), loadedEnvFiles);
  loadEnvFile(path.join(process.cwd(), ".env.local"), loadedEnvFiles);
  if (cwd) {
    loadEnvFile(path.join(cwd, ".env.local"), loadedEnvFiles);
  }
}

function setIfPresent(env, key, value) {
  if (value !== undefined && value !== "") {
    env[key] = value;
  }
}

function parseCsv(value) {
  if (!value) {
    return undefined;
  }
  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function truthy(value) {
  return value === true || value === "1" || value === "true";
}

function parseMaxTurns(args) {
  const rawValue = getOption(args, "max-turns", "CODEX_HARNESS_MAX_TURNS");
  if (rawValue === undefined || rawValue === "" || rawValue === null) {
    return null;
  }
  const normalized = String(rawValue).trim().toLowerCase();
  if (normalized === "none" || normalized === "unlimited" || normalized === "off" || normalized === "0") {
    return null;
  }
  const maxTurns = Number.parseInt(normalized, 10);
  if (!Number.isInteger(maxTurns) || maxTurns < 1 || String(maxTurns) !== normalized) {
    throw new Error("--max-turns must be a positive integer, none, unlimited, off, or 0.");
  }
  return maxTurns;
}

function permissionEnvNameForAgent(agent) {
  return AGENT_PERMISSION_ENVS[agent];
}

function effectivePermissionMode(agent, args, isSequence = false) {
  const agentEnvName = permissionEnvNameForAgent(agent);
  const agentEnvValue = agentEnvName ? process.env[agentEnvName] : undefined;
  if (agentEnvValue) {
    return agentEnvValue;
  }
  if (isSequence && SEQUENCE_ROLE_PERMISSION_PRESETS[agent]) {
    return SEQUENCE_ROLE_PERMISSION_PRESETS[agent];
  }
  return getOption(args, "permission-mode", "CODEX_HARNESS_PERMISSION_MODE", "default");
}

function hasSequenceReadOnlyPreset(agent, args) {
  const agentEnvName = permissionEnvNameForAgent(agent);
  return Boolean(args.__isSequence && SEQUENCE_ROLE_PERMISSION_PRESETS[agent] && !(agentEnvName && process.env[agentEnvName]));
}

function assertEnvName(name, fieldName) {
  if (!name) {
    return;
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`${fieldName} must be an environment variable name, not a secret value.`);
  }
}

function assertMode(mode, agent) {
  if (mode !== "external" && mode !== "claudeCli" && mode !== "codexCli") {
    throw new Error(`Agent ${agent} has unsupported provider mode: ${mode}`);
  }
}

function assertSdk(sdk, agent) {
  if (sdk !== "anthropic" && sdk !== "openai") {
    throw new Error(`Agent ${agent} has unsupported sdk: ${sdk}`);
  }
}

function backendForEntry(agent, entry = {}) {
  assertEnvName(entry.modeEnv, `${agent}.modeEnv`);
  const rawMode = envValueFromName(entry.modeEnv) ?? entry.mode ?? "claudeCli";
  const normalized = String(rawMode).trim().toLowerCase();
  if (normalized === "anthropic" || normalized === "openai") {
    return { mode: "external", sdk: normalized };
  }
  if (normalized === "external") {
    return { mode: "external" };
  }
  if (normalized === "claudecli" || normalized === "claude-cli") {
    return { mode: "claudeCli" };
  }
  if (normalized === "codexcli" || normalized === "codex-cli") {
    return { mode: "codexCli" };
  }
  throw new Error(`Agent ${agent} has unsupported provider mode: ${rawMode}`);
}

function sdkForEntry(agent, entry = {}, args = {}, backendSdk) {
  assertEnvName(entry.sdkEnv, `${agent}.sdkEnv`);
  const sdk = args.sdk ?? backendSdk ?? envValueFromName(entry.sdkEnv) ?? process.env.CODEX_HARNESS_SDK ?? entry.sdk ?? DEFAULT_SDK;
  assertSdk(sdk, agent);
  return sdk;
}

function fallbackPolicyForAgent(agent, entry = {}, args = {}) {
  const defaults = DEFAULT_AGENT_FALLBACKS[agent] ?? DEFAULT_AGENT_FALLBACKS["codex-main"];
  return {
    agent: entry.fallbackAgent ?? DEFAULT_FALLBACK_AGENT,
    model: entry.fallbackModel ?? entry.claudeModel ?? entry.model ?? getOption(args, "fallback-model", "CODEX_HARNESS_FALLBACK_MODEL", defaults.model),
    effort: entry.fallbackEffort ?? entry.effort ?? getOption(args, "fallback-effort", "CODEX_HARNESS_FALLBACK_EFFORT", defaults.effort)
  };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}

function readJsonIfPresent(configPath) {
  if (!configPath || !fs.existsSync(configPath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function resolveConfigPath(args) {
  const configured = getOption(args, "agent-provider-config", "CODEX_HARNESS_AGENT_PROVIDER_CONFIG", DEFAULT_PROVIDER_CONFIG);
  const candidates = [configured];
  if (configured === DEFAULT_PROVIDER_CONFIG) {
    candidates.push("config/agent-provider.json");
  } else if (configured === "config/agent-provider.json") {
    candidates.push(DEFAULT_PROVIDER_CONFIG);
  }
  for (const candidate of candidates) {
    const resolvedPath = path.resolve(root, candidate);
    if (fs.existsSync(resolvedPath)) {
      return resolvedPath;
    }
  }
  return path.resolve(root, configured);
}

function envValueFromName(envName) {
  return envName ? process.env[envName] : undefined;
}

function providerFromManifest(agent, config, args = {}) {
  const agents = config?.agents ?? {};
  const entry = agents[agent];
  if (!entry) {
    const sdk = sdkForEntry(agent, {}, args);
    return {
      mode: "claudeCli",
      sdk,
      fallbackReason: "no agent provider entry",
      fallback: fallbackPolicyForAgent(agent)
    };
  }
  const backend = backendForEntry(agent, entry);
  const mode = backend.mode;
  assertMode(mode, agent);
  const sdk = sdkForEntry(agent, entry, args, backend.sdk);
  const fallback = fallbackPolicyForAgent(agent, entry);
  if (mode === "codexCli") {
    assertEnvName(entry.modelEnv, `${agent}.modelEnv`);
    assertEnvName(entry.codexModelEnv, `${agent}.codexModelEnv`);
    assertEnvName(entry.codexProfileEnv, `${agent}.codexProfileEnv`);
    return {
      mode,
      sdk,
      model: args.model ?? envValueFromName(entry.codexModelEnv) ?? envValueFromName(entry.modelEnv) ?? process.env.CODEX_HARNESS_MODEL ?? entry.model ?? "sonnet",
      effort: entry.effort ?? getOption(args, "effort", "CODEX_HARNESS_EFFORT", "medium"),
      codexProfile: envValueFromName(entry.codexProfileEnv) ?? entry.codexProfile,
      codexProfileEnv: entry.codexProfileEnv,
      codexModelEnv: entry.codexModelEnv ?? entry.modelEnv,
      fallback,
      entry
    };
  }
  if (mode === "claudeCli") {
    return {
      mode,
      sdk,
      model: fallback.model,
      effort: fallback.effort,
      fallback,
      fallbackReason: "agent configured for Claude CLI",
      entry
    };
  }

  const credential = entry.credential ?? {};
  assertEnvName(entry.baseUrlEnv, `${agent}.baseUrlEnv`);
  assertEnvName(entry.sdkEnv, `${agent}.sdkEnv`);
  assertEnvName(credential.env, `${agent}.credential.env`);
  assertEnvName(entry.modelEnv, `${agent}.modelEnv`);
  assertEnvName(entry.haikuModelEnv, `${agent}.haikuModelEnv`);
  assertEnvName(entry.sonnetModelEnv, `${agent}.sonnetModelEnv`);
  assertEnvName(entry.opusModelEnv, `${agent}.opusModelEnv`);
  if (credential.type !== "apiKey" && credential.type !== "authToken") {
    throw new Error(`Agent ${agent} credential.type must be apiKey or authToken.`);
  }

  const baseUrl = envValueFromName(entry.baseUrlEnv);
  const credentialValue = envValueFromName(credential.env);
  const model = envValueFromName(entry.modelEnv) ?? entry.model;
  if (!baseUrl || !credentialValue || !model) {
    return {
      mode: "claudeCli",
      sdk,
      fallbackReason: "external provider env is incomplete",
      model: fallback.model,
      effort: fallback.effort,
      fallback,
      entry
    };
  }
  return {
    mode,
    sdk,
    baseUrl,
    credentialType: credential.type,
    credentialEnv: credential.env,
    credentialValue,
    model,
    effort: entry.effort,
    fallback,
    haikuModel: envValueFromName(entry.haikuModelEnv),
    sonnetModel: envValueFromName(entry.sonnetModelEnv),
    opusModel: envValueFromName(entry.opusModelEnv),
    timeoutMs: envValueFromName(entry.timeoutMsEnv),
    entry
  };
}

function providerFromExplicitArgs(args, agent) {
  const sdk = getOption(args, "sdk", "CODEX_HARNESS_SDK", DEFAULT_SDK);
  assertSdk(sdk, agent);
  const baseUrl = getOption(args, "base-url", "CODEX_HARNESS_BASE_URL");
  const apiKeyEnv = getOption(args, "api-key-env", "CODEX_HARNESS_API_KEY_ENV");
  const authTokenEnv = getOption(args, "auth-token-env", "CODEX_HARNESS_AUTH_TOKEN_ENV");
  assertEnvName(apiKeyEnv, "--api-key-env");
  assertEnvName(authTokenEnv, "--auth-token-env");
  if (!baseUrl && !apiKeyEnv && !authTokenEnv) {
    return undefined;
  }
  if (apiKeyEnv && authTokenEnv) {
    throw new Error("Use exactly one credential mode: --api-key-env or --auth-token-env.");
  }
  const credentialEnv = apiKeyEnv || authTokenEnv;
  const credentialValue = envValueFromName(credentialEnv);
  const model = getOption(args, "model", "CODEX_HARNESS_MODEL", "sonnet");
  const fallback = fallbackPolicyForAgent(agent, {}, args);
  if (!baseUrl || !credentialEnv || !credentialValue) {
    return {
      mode: "claudeCli",
      sdk,
      model: fallback.model,
      effort: fallback.effort,
      fallback,
      fallbackReason: "explicit external provider env is incomplete"
    };
  }
  return {
    mode: "external",
    sdk,
    baseUrl,
    credentialType: apiKeyEnv ? "apiKey" : "authToken",
    credentialEnv,
    credentialValue,
    model,
    effort: getOption(args, "effort", "CODEX_HARNESS_EFFORT"),
    fallback,
    haikuModel: args["haiku-model"],
    sonnetModel: args["sonnet-model"],
    opusModel: args["opus-model"],
    timeoutMs: getOption(args, "timeout-ms", "CODEX_HARNESS_TIMEOUT_MS")
  };
}

function resolveProvider(agent, args, config) {
  const explicit = providerFromExplicitArgs(args, agent);
  return explicit ?? providerFromManifest(agent, config, args);
}

function printRouting(agent, provider, args) {
  const fallback = provider.fallback ?? fallbackPolicyForAgent(agent, provider.entry, args);
  const resume = getOption(args, "resume", "CODEX_HARNESS_RESUME");
  const continueSession = truthy(args.continue) || truthy(process.env.CODEX_HARNESS_CONTINUE);
  const permissionMode = effectivePermissionMode(agent, args, args.__isSequence);
  const codexMapping = provider.mode === "codexCli" ? codexCliPermissionMapping(permissionMode) : undefined;
  const policy = buildToolPermissionPolicy(provider, args, agent);
  const payload = {
    agent,
    mode: provider.mode,
    sdk: provider.sdk ?? DEFAULT_SDK,
    model: provider.model ?? getOption(args, "model", "CODEX_HARNESS_MODEL", "sonnet"),
    effort: provider.effort ?? getOption(args, "effort", "CODEX_HARNESS_EFFORT", "medium"),
    fallbackAgent: fallback.agent,
    fallbackModel: fallback.model,
    fallbackEffort: fallback.effort,
    sdkEnv: provider.entry?.sdkEnv,
    modeEnv: provider.entry?.modeEnv,
    baseUrlEnv: provider.entry?.baseUrlEnv,
    credentialType: provider.credentialType ?? provider.entry?.credential?.type,
    credentialEnv: provider.credentialEnv ?? provider.entry?.credential?.env,
    permissionMode,
    permissionModeEnv: permissionEnvNameForAgent(agent),
    handlesApprovals: provider.mode === "external" && ["anthropic", "openai"].includes(provider.sdk ?? DEFAULT_SDK),
    handlesUserInput: provider.mode === "external" && (provider.sdk ?? DEFAULT_SDK) === "anthropic",
    nonInteractiveApproval: true,
    writeTools: provider.mode === "codexCli" ? false : policy.writeAllowed,
    bashTool: provider.mode === "codexCli" ? false : policy.bashAllowed,
    codexProfileEnv: provider.codexProfileEnv ?? provider.entry?.codexProfileEnv,
    codexModelEnv: provider.codexModelEnv ?? provider.entry?.codexModelEnv,
    sandbox: codexMapping?.sandbox,
    approvalPolicy: codexMapping?.approvalPolicy,
    toolPolicyNote: provider.mode === "codexCli" ? "--allowed-tools and --disallowed-tools are not applied by the Codex CLI backend" : undefined,
    persistSession: shouldPersistOpenAiSession(args),
    resume,
    continue: continueSession,
    fallbackReason: provider.fallbackReason,
    fallbackEligible: true,
    maxTurns: parseMaxTurns(args)
  };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function sanitizeReason(reason, provider) {
  let text = String(reason ?? "provider not selected");
  if (provider?.credentialValue) {
    text = text.split(provider.credentialValue).join("[redacted]");
  }
  return text.replace(/\s+/g, " ").slice(0, 500);
}

function codexCliPermissionMapping(permissionMode) {
  if (permissionMode === "acceptEdits") {
    return { sandbox: "workspace-write", approvalPolicy: "never" };
  }
  if (permissionMode === "bypassPermissions") {
    return { sandbox: "workspace-write", approvalPolicy: "never" };
  }
  return { sandbox: "read-only", approvalPolicy: "never" };
}

function buildFallbackPrompt(agent, prompt, provider, reason) {
  return `Handle this Codex harness delegated agent request in the main Claude Code CLI session.

Requested agent: ${agent}
Fallback reason: ${sanitizeReason(reason, provider)}

Use the requested agent's role and complexity policy, but keep normal Codex harness behavior: read relevant context first, preserve unrelated user changes, make scoped edits only when asked, and verify with concrete evidence.

Original task:
${prompt}`;
}

function buildSdkEnv(provider, args) {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  env.ANTHROPIC_BASE_URL = provider.baseUrl;
  if (provider.credentialType === "apiKey") {
    env.ANTHROPIC_API_KEY = provider.credentialValue;
  } else {
    env.ANTHROPIC_AUTH_TOKEN = provider.credentialValue;
  }
  setIfPresent(env, "ANTHROPIC_DEFAULT_HAIKU_MODEL", provider.haikuModel ?? args["haiku-model"]);
  setIfPresent(env, "ANTHROPIC_DEFAULT_SONNET_MODEL", provider.sonnetModel ?? args["sonnet-model"]);
  setIfPresent(env, "ANTHROPIC_DEFAULT_OPUS_MODEL", provider.opusModel ?? args["opus-model"]);
  setIfPresent(env, "CLAUDE_CODE_EFFORT_LEVEL", provider.effort ?? getOption(args, "effort", "CODEX_HARNESS_EFFORT"));
  setIfPresent(env, "API_TIMEOUT_MS", provider.timeoutMs ?? getOption(args, "timeout-ms", "CODEX_HARNESS_TIMEOUT_MS"));
  env.CLAUDE_AGENT_SDK_CLIENT_APP = "codex4claude";
  return env;
}

const READ_TOOL_NAMES = new Set(["read", "ls", "glob", "grep"]);
const WRITE_TOOL_NAMES = new Set(["write", "edit", "multiedit"]);
const USER_INPUT_TOOL_NAMES = new Set(["askuserquestion"]);

function optionToolSet(args, option, envName) {
  return new Set((parseCsv(getOption(args, option, envName)) ?? []).map((name) => name.toLowerCase()));
}

function openAiAllowedSet(args) {
  return new Set(parseCsv(getOption(args, "allowed-tools", "CODEX_HARNESS_ALLOWED_TOOLS")) ?? []);
}

function buildToolPermissionPolicy(provider, args, agent) {
  const allowed = optionToolSet(args, "allowed-tools", "CODEX_HARNESS_ALLOWED_TOOLS");
  const disallowed = optionToolSet(args, "disallowed-tools", "CODEX_HARNESS_DISALLOWED_TOOLS");
  const writeAllowed = canExposeWriteTools(provider, args, agent);
  const bashAllowed = canExposeBashTool(provider, args, agent);
  return {
    writeAllowed,
    bashAllowed,
    defaultAllowedTools() {
      const names = ["Read", "LS", "Glob", "Grep"];
      if (writeAllowed) {
        names.push("Write", "Edit", "MultiEdit");
      }
      if (bashAllowed) {
        names.push("Bash");
      }
      return names.filter((name) => !disallowed.has(name.toLowerCase()));
    },
    decide(toolName) {
      const normalized = String(toolName ?? "").toLowerCase();
      if (disallowed.has(normalized)) {
        return { decision: "deny", reason: "tool is blocked by --disallowed-tools" };
      }
      if (READ_TOOL_NAMES.has(normalized)) {
        return { decision: "allow", reason: "read-only workspace tool" };
      }
      if (WRITE_TOOL_NAMES.has(normalized)) {
        return writeAllowed
          ? { decision: "allow", reason: "write tools enabled by permission policy" }
          : { decision: "deny", reason: "write tools require acceptEdits, bypassPermissions, or manifest allowWrite" };
      }
      if (normalized === "bash") {
        return bashAllowed
          ? { decision: "allow", reason: "Bash explicitly allowed" }
          : { decision: "deny", reason: "Bash requires --allowed-tools Bash or manifest allowBash" };
      }
      if (USER_INPUT_TOOL_NAMES.has(normalized)) {
        return { decision: "deny", reason: "non-interactive runner cannot answer clarifying questions; continue with provided instructions or rerun interactively" };
      }
      if (allowed.has(normalized)) {
        return { decision: "allow", reason: "tool explicitly allowed" };
      }
      return { decision: "deny", reason: "tool is not approved for non-interactive runner execution" };
    }
  };
}

function canExposeWriteTools(provider, args, agent) {
  if (hasSequenceReadOnlyPreset(agent, args)) {
    return false;
  }
  const permissionMode = effectivePermissionMode(agent, args, args.__isSequence);
  return permissionMode === "acceptEdits" || permissionMode === "bypassPermissions" || provider.entry?.allowWrite === true;
}

function canExposeBashTool(provider, args, agent) {
  if (hasSequenceReadOnlyPreset(agent, args)) {
    return false;
  }
  const allowed = openAiAllowedSet(args);
  return allowed.has("Bash") || allowed.has("bash") || provider.entry?.allowBash === true;
}

function isDisallowedTool(name, args) {
  const disallowed = new Set(parseCsv(getOption(args, "disallowed-tools", "CODEX_HARNESS_DISALLOWED_TOOLS")) ?? []);
  return disallowed.has(name) || disallowed.has(name.toLowerCase());
}

async function realpathIfPresent(targetPath) {
  try {
    return await fs.promises.realpath(targetPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return targetPath;
    }
    throw error;
  }
}

async function assertInsideWorkspace(targetPath, workspaceRoot, allowMissing = false) {
  const resolved = path.resolve(workspaceRoot, targetPath);
  const realWorkspace = await fs.promises.realpath(workspaceRoot);
  const existing = allowMissing ? await realpathIfPresent(path.dirname(resolved)) : await fs.promises.realpath(resolved);
  const relative = path.relative(realWorkspace, existing);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path is outside the workspace root.");
  }
  return resolved;
}

async function assertReadableTextFile(filePath) {
  const stat = await fs.promises.lstat(filePath);
  if (stat.isSymbolicLink()) {
    throw new Error("Symlink reads are refused.");
  }
  if (!stat.isFile()) {
    throw new Error("Path is not a file.");
  }
  if (stat.size > MAX_TOOL_BYTES) {
    throw new Error(`File is too large for tool access (${stat.size} bytes).`);
  }
  const buffer = await fs.promises.readFile(filePath);
  if (buffer.includes(0)) {
    throw new Error("Binary file reads are refused.");
  }
  return buffer.toString("utf8");
}

function truncateToolOutput(text) {
  const buffer = Buffer.from(String(text), "utf8");
  if (buffer.length <= MAX_TOOL_OUTPUT_BYTES) {
    return String(text);
  }
  return `${buffer.subarray(0, MAX_TOOL_OUTPUT_BYTES).toString("utf8")}\n[truncated ${buffer.length - MAX_TOOL_OUTPUT_BYTES} bytes]`;
}

function globToRegExp(pattern) {
  const normalized = pattern.replace(/\\/g, "/");
  let out = "^";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === "*" && next === "*") {
      out += ".*";
      index += 1;
    } else if (char === "*") {
      out += "[^/]*";
    } else if (char === "?") {
      out += "[^/]";
    } else {
      out += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }
  out += "$";
  return new RegExp(out);
}

async function walkFiles(startPath, workspaceRoot, results = []) {
  const entries = await fs.promises.readdir(startPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(startPath, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }
      await walkFiles(fullPath, workspaceRoot, results);
    } else if (entry.isFile()) {
      results.push(path.relative(workspaceRoot, fullPath).replace(/\\/g, "/"));
    }
    if (results.length >= 5000) {
      break;
    }
  }
  return results;
}

function logOpenAiTool(kind, name, detail = "") {
  process.stderr.write(`[openai-tool-${kind}] ${name}${detail ? ` ${detail}` : ""}\n`);
}

async function createOpenAiTools(options, provider, agentName) {
  const [{ tool }, { z }] = await Promise.all([import("@openai/agents"), import("zod")]);
  const workspaceRoot = await fs.promises.realpath(options.cwd);
  const policy = buildToolPermissionPolicy(provider, options.args, agentName);
  const tools = [];
  const addTool = (name, description, parameters, execute, needsApproval = false) => {
    if (isDisallowedTool(name, options.args)) {
      return;
    }
    tools.push(tool({
      name,
      description,
      parameters,
      strict: true,
      needsApproval,
      async execute(input) {
        logOpenAiTool("start", name);
        const result = await execute(input);
        logOpenAiTool("result", name);
        return truncateToolOutput(result);
      }
    }));
  };

  addTool("Read", "Read a UTF-8 text file inside the workspace root.", z.object({
    file_path: z.string(),
    offset: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(2000).optional()
  }), async ({ file_path: filePath, offset, limit }) => {
    const resolved = await assertInsideWorkspace(filePath, workspaceRoot);
    const content = await assertReadableTextFile(resolved);
    const lines = content.split(/\r?\n/);
    const start = offset ? offset - 1 : 0;
    const selected = lines.slice(start, limit ? start + limit : undefined);
    return selected.map((line, index) => `${start + index + 1}: ${line}`).join("\n");
  });

  addTool("LS", "List files and directories inside the workspace root.", z.object({
    path: z.string().optional()
  }), async ({ path: requestedPath = "." }) => {
    const resolved = await assertInsideWorkspace(requestedPath, workspaceRoot);
    const entries = await fs.promises.readdir(resolved, { withFileTypes: true });
    return entries
      .filter((entry) => !entry.isSymbolicLink())
      .slice(0, 500)
      .map((entry) => `${entry.isDirectory() ? "dir" : "file"} ${entry.name}`)
      .join("\n");
  });

  addTool("Glob", "Find workspace files matching a glob pattern.", z.object({
    pattern: z.string(),
    path: z.string().optional()
  }), async ({ pattern, path: requestedPath = "." }) => {
    const basePath = await assertInsideWorkspace(requestedPath, workspaceRoot);
    const matcher = globToRegExp(pattern);
    const files = await walkFiles(basePath, workspaceRoot);
    return files.filter((file) => matcher.test(file) || matcher.test(path.basename(file))).slice(0, 500).join("\n");
  });

  addTool("Grep", "Search UTF-8 workspace files for a literal or regex pattern.", z.object({
    pattern: z.string(),
    path: z.string().optional(),
    glob: z.string().optional(),
    regex: z.boolean().optional()
  }), async ({ pattern, path: requestedPath = ".", glob, regex = false }) => {
    const basePath = await assertInsideWorkspace(requestedPath, workspaceRoot);
    const files = await walkFiles(basePath, workspaceRoot);
    const fileMatcher = glob ? globToRegExp(glob) : undefined;
    const matcher = regex ? new RegExp(pattern) : undefined;
    const matches = [];
    for (const relativeFile of files) {
      if (fileMatcher && !fileMatcher.test(relativeFile) && !fileMatcher.test(path.basename(relativeFile))) {
        continue;
      }
      const fullPath = path.join(workspaceRoot, relativeFile);
      let content;
      try {
        content = await assertReadableTextFile(fullPath);
      } catch {
        continue;
      }
      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if ((matcher && matcher.test(line)) || (!matcher && line.includes(pattern))) {
          matches.push(`${relativeFile}:${index + 1}: ${line}`);
          if (matches.length >= 500) {
            return matches.join("\n");
          }
        }
      }
    }
    return matches.join("\n");
  });

  if (policy.writeAllowed) {
    addTool("Edit", "Replace existing text in a workspace file after verifying the old text is present.", z.object({
      file_path: z.string(),
      old_string: z.string(),
      new_string: z.string(),
      replace_all: z.boolean().optional()
    }), async ({ file_path: filePath, old_string: oldString, new_string: newString, replace_all: replaceAll = false }) => {
      const resolved = await assertInsideWorkspace(filePath, workspaceRoot);
      const content = await assertReadableTextFile(resolved);
      if (!content.includes(oldString)) {
        throw new Error("old_string was not found.");
      }
      const updated = replaceAll ? content.split(oldString).join(newString) : content.replace(oldString, newString);
      await fs.promises.writeFile(resolved, updated, "utf8");
      return `edited ${path.relative(workspaceRoot, resolved)}`;
    }, true);

    addTool("MultiEdit", "Apply ordered text replacements to a workspace file, each with preimage verification.", z.object({
      file_path: z.string(),
      edits: z.array(z.object({
        old_string: z.string(),
        new_string: z.string(),
        replace_all: z.boolean().optional()
      })).min(1).max(50)
    }), async ({ file_path: filePath, edits }) => {
      const resolved = await assertInsideWorkspace(filePath, workspaceRoot);
      let content = await assertReadableTextFile(resolved);
      for (const edit of edits) {
        if (!content.includes(edit.old_string)) {
          throw new Error("old_string was not found.");
        }
        content = edit.replace_all ? content.split(edit.old_string).join(edit.new_string) : content.replace(edit.old_string, edit.new_string);
      }
      await fs.promises.writeFile(resolved, content, "utf8");
      return `edited ${path.relative(workspaceRoot, resolved)} (${edits.length} edits)`;
    }, true);

    addTool("Write", "Create or overwrite a UTF-8 workspace file.", z.object({
      file_path: z.string(),
      content: z.string()
    }), async ({ file_path: filePath, content }) => {
      if (Buffer.byteLength(content, "utf8") > MAX_TOOL_BYTES) {
        throw new Error("Content is too large.");
      }
      const resolved = await assertInsideWorkspace(filePath, workspaceRoot, true);
      await fs.promises.mkdir(path.dirname(resolved), { recursive: true });
      await fs.promises.writeFile(resolved, content, "utf8");
      return `wrote ${path.relative(workspaceRoot, resolved)}`;
    }, true);
  }

  if (policy.bashAllowed) {
    addTool("Bash", "Run an approved command in the workspace root with timeout and output caps.", z.object({
      command: z.string(),
      timeout_ms: z.number().int().min(1000).max(120000).optional()
    }), async ({ command, timeout_ms: timeoutMs = 30000 }) => {
      if (/\b(rm|del|erase|rmdir|Remove-Item|git\s+reset|git\s+checkout)\b/i.test(command)) {
        throw new Error("Command is blocked by the harness destructive-command policy.");
      }
      return runOpenAiBash(command, { cwd: workspaceRoot, timeoutMs });
    }, true);
  }

  return tools;
}

function runOpenAiBash(command, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: options.cwd,
      env: process.env,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Bash timed out after ${options.timeoutMs}ms.`));
    }, options.timeoutMs);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (Buffer.byteLength(output, "utf8") > MAX_TOOL_OUTPUT_BYTES * 2) {
        child.kill();
      }
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      const result = truncateToolOutput(output);
      if (code === 0) {
        resolve(result);
      } else {
        resolve(`exit=${code}\n${result}`);
      }
    });
  });
}

function printAssistantText(message) {
  const content = message?.message?.content;
  if (!Array.isArray(content)) {
    return "";
  }
  let text = "";
  for (const part of content) {
    if (part?.type === "text" && part.text) {
      text += part.text;
      process.stdout.write(part.text);
      if (!part.text.endsWith("\n")) {
        process.stdout.write("\n");
        text += "\n";
      }
    } else if (part?.type === "tool_use") {
      process.stderr.write(`[tool_use] ${part.name ?? "unknown"}\n`);
    }
  }
  return text;
}

function handleStreamEvent(message, state, prefix) {
  state.sawStreamEvent = true;
  const event = message.event ?? {};
  if (event.type === "message_start") {
    process.stderr.write(`[${prefix}-message-start] model=${event.message?.model ?? "unknown"} ttftMs=${message.ttft_ms ?? "unknown"}\n`);
    return;
  }
  if (event.type === "content_block_start") {
    const block = event.content_block ?? {};
    state.blocks[event.index] = { type: block.type, name: block.name, input: "" };
    if (block.type === "tool_use") {
      process.stderr.write(`[${prefix}-tool-start] ${block.name ?? "unknown"}\n`);
    }
    return;
  }
  if (event.type === "content_block_delta") {
    const delta = event.delta ?? {};
    if (delta.type === "text_delta" && delta.text) {
      state.seenPartialText = true;
      state.output += delta.text;
      state.lastTextEndsNewline = delta.text.endsWith("\n");
      process.stdout.write(delta.text);
      return;
    }
    if (delta.type === "thinking_delta" && delta.thinking) {
      state.seenPartialText = true;
      process.stderr.write(`[${prefix}-thinking]\n`);
      return;
    }
    if (delta.type === "input_json_delta" && delta.partial_json) {
      const block = state.blocks[event.index];
      if (block) {
        block.input += delta.partial_json;
        if (block.input.length >= 160 && !block.reportedInput) {
          process.stderr.write(`[${prefix}-tool-input] ${block.name ?? "unknown"} ${block.input.replace(/\s+/g, " ").slice(0, 240)}\n`);
          block.reportedInput = true;
        }
      }
    }
    return;
  }
  if (event.type === "content_block_stop") {
    const block = state.blocks[event.index];
    if (block?.type === "tool_use" && block.input && !block.reportedInput) {
      process.stderr.write(`[${prefix}-tool-input] ${block.name ?? "unknown"} ${block.input.replace(/\s+/g, " ").slice(0, 240)}\n`);
    }
    return;
  }
  if (event.type === "message_delta") {
    const reason = event.delta?.stop_reason;
    if (reason) {
      if (state.seenPartialText && !state.lastTextEndsNewline) {
        process.stdout.write("\n");
        state.lastTextEndsNewline = true;
      }
      process.stderr.write(`[${prefix}-message-delta] stop=${reason} outputTokens=${event.usage?.output_tokens ?? "unknown"}\n`);
    }
    return;
  }
  if (event.type === "message_stop") {
    process.stderr.write(`[${prefix}-message-stop]\n`);
  }
}

function buildClaudeSdkPermissionHandlers(provider, options, agent) {
  const policy = buildToolPermissionPolicy(provider, options.args, agent);
  const decide = (toolName) => {
    process.stderr.write(`[sdk-permission-request] tool=${toolName ?? "unknown"}\n`);
    const result = policy.decide(toolName);
    const decision = result.decision === "allow" ? "allow" : "deny";
    if (String(toolName ?? "").toLowerCase() === "askuserquestion") {
      process.stderr.write(`[sdk-user-input-denied] tool=AskUserQuestion reason=non-interactive\n`);
    }
    process.stderr.write(`[sdk-permission-result] tool=${toolName ?? "unknown"} decision=${decision} reason=${result.reason}\n`);
    return result;
  };
  return {
    allowedTools: policy.defaultAllowedTools(),
    canUseTool: async (toolName) => {
      const result = decide(toolName);
      if (result.decision === "allow") {
        return { behavior: "allow" };
      }
      return { behavior: "deny", message: result.reason, interrupt: false };
    },
    hooks: {
      PreToolUse: [{
        hooks: [async (input) => {
          if (input?.tool_name === "AskUserQuestion") {
            const result = decide(input.tool_name);
            return {
              continue: true,
              hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "deny",
                permissionDecisionReason: result.reason
              }
            };
          }
          return { continue: true };
        }]
      }],
      PermissionRequest: [{
        hooks: [async (input) => {
          const result = decide(input?.tool_name);
          return {
            continue: true,
            hookSpecificOutput: {
              hookEventName: "PermissionRequest",
              decision: result.decision === "allow"
                ? { behavior: "allow" }
                : { behavior: "deny", message: result.reason, interrupt: false }
            }
          };
        }]
      }]
    }
  };
}

async function runSdk(agent, prompt, provider, options) {
  let sdk;
  try {
    sdk = await import("@anthropic-ai/claude-agent-sdk");
  } catch (error) {
    throw new Error(`SDK import failed: ${error.message}`);
  }

  const abortController = options.overallTimeoutMs ? new AbortController() : undefined;
  const timeout = abortController
    ? setTimeout(() => abortController.abort(), options.overallTimeoutMs)
    : undefined;
  const permissionHandlers = buildClaudeSdkPermissionHandlers(provider, options, agent);
  const explicitAllowedTools = parseCsv(getOption(options.args, "allowed-tools", "CODEX_HARNESS_ALLOWED_TOOLS"));
  const allowedTools = Array.from(new Set([...permissionHandlers.allowedTools, ...(explicitAllowedTools ?? [])]));
  const disallowedTools = parseCsv(getOption(options.args, "disallowed-tools", "CODEX_HARNESS_DISALLOWED_TOOLS"));
  const includePartialMessages = truthy(options.args["include-partial-messages"]) || truthy(process.env.CODEX_HARNESS_INCLUDE_PARTIAL_MESSAGES);
  const resume = getOption(options.args, "resume", "CODEX_HARNESS_RESUME");
  const resumeSessionAt = getOption(options.args, "resume-session-at", "CODEX_HARNESS_RESUME_SESSION_AT");
  const continueSession = truthy(options.args.continue) || truthy(process.env.CODEX_HARNESS_CONTINUE);
  const persistSession = truthy(options.args["persist-session"]) || truthy(process.env.CODEX_HARNESS_PERSIST_SESSION) || Boolean(resume || continueSession);
  if (resume && continueSession) {
    throw new Error("--resume and --continue are mutually exclusive.");
  }

  const queryOptions = {
    abortController,
    allowedTools,
    disallowedTools,
    cwd: options.cwd,
    env: buildSdkEnv(provider, options.args),
    model: provider.model,
    effort: provider.effort ?? getOption(options.args, "effort", "CODEX_HARNESS_EFFORT"),
    agent,
    maxBudgetUsd: options.maxBudgetUsd,
    includePartialMessages,
    resume,
    resumeSessionAt,
    continue: continueSession,
    plugins: [{ type: "local", path: options.pluginPath }],
    settingSources: ["project"],
    systemPrompt: { type: "preset", preset: "claude_code" },
    tools: { type: "preset", preset: "claude_code" },
    permissionMode: effectivePermissionMode(agent, options.args, options.args.__isSequence),
    canUseTool: permissionHandlers.canUseTool,
    hooks: permissionHandlers.hooks,
    persistSession
  };
  if (options.maxTurns !== null) {
    queryOptions.maxTurns = options.maxTurns;
  }

  const query = sdk.query({
    prompt,
    options: queryOptions
  });

  const state = { output: "", seenPartialText: false, sawStreamEvent: false, lastTextEndsNewline: true, blocks: {} };
  try {
    for await (const message of query) {
      if (message.type === "system" && message.subtype === "init") {
        process.stderr.write(`[init] mode=external agent=${agent} model=${message.model} cwd=${message.cwd}\n`);
      } else if (message.type === "system" && message.subtype === "status") {
        process.stderr.write(`[sdk-status] ${message.status ?? "unknown"}\n`);
      } else if (message.type === "assistant") {
        if (!state.sawStreamEvent) {
          state.output += printAssistantText(message);
        }
      } else if (message.type === "user") {
        process.stderr.write("[sdk-tool-result]\n");
      } else if (message.type === "result" && message.subtype !== "success") {
        throw new Error(`SDK result failed: ${message.subtype}`);
      } else if (message.type === "result") {
        process.stderr.write(`[result] success turns=${message.num_turns} cost=${message.total_cost_usd ?? "unknown"} session=${message.session_id ?? "unknown"}\n`);
      } else if (message.type === "stream_event") {
        handleStreamEvent(message, state, "sdk");
      }
    }
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
  return state.output.trim();
}

function openAiInstructions(agent, options) {
  return `You are running as the Codex harness ${agent} agent.

Work only inside this workspace: ${options.cwd}
Use available tools for file inspection before making claims about files. Do not reveal hidden reasoning. Keep edits scoped to the user request, preserve unrelated changes, and report concrete verification evidence.`;
}

function buildOpenAiProvider(sdk, provider) {
  return new sdk.OpenAIProvider({
    apiKey: provider.credentialValue,
    baseURL: provider.baseUrl,
    useResponses: false,
    strictFeatureValidation: false
  });
}

function shouldPersistOpenAiSession(args) {
  const resume = getOption(args, "resume", "CODEX_HARNESS_RESUME");
  const continueSession = truthy(args.continue) || truthy(process.env.CODEX_HARNESS_CONTINUE);
  return truthy(args["persist-session"]) || truthy(process.env.CODEX_HARNESS_PERSIST_SESSION) || Boolean(resume || continueSession);
}

function openAiSessionRoot(cwd) {
  return path.join(cwd, OPENAI_SESSION_DIR);
}

function sanitizeSessionId(sessionId) {
  const id = String(sessionId ?? "").trim();
  if (!/^[A-Za-z0-9_.-]{1,120}$/.test(id)) {
    throw new Error("OpenAI session ID must contain only letters, numbers, dot, dash, or underscore.");
  }
  return id;
}

function openAiSessionFile(cwd, sessionId) {
  return path.join(openAiSessionRoot(cwd), `${sanitizeSessionId(sessionId)}.json`);
}

function openAiLatestSessionFile(cwd) {
  return path.join(openAiSessionRoot(cwd), "latest.json");
}

async function readJsonFileIfPresent(filePath) {
  try {
    return JSON.parse(await fs.promises.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function generateOpenAiSessionId(agentName) {
  const safeAgent = agentName.replace(/[^A-Za-z0-9_.-]/g, "-").slice(0, 40) || "agent";
  return `${safeAgent}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

function trimOpenAiSessionItems(items, resumeSessionAt) {
  if (!resumeSessionAt) {
    return items;
  }
  const index = items.findIndex((item) => item?.id === resumeSessionAt || item?.item?.id === resumeSessionAt);
  if (index === -1) {
    throw new Error(`OpenAI session item not found for --resume-session-at: ${resumeSessionAt}`);
  }
  return items.slice(0, index + 1);
}

async function resolveOpenAiSessionConfig(agentName, options, sdk) {
  const resume = getOption(options.args, "resume", "CODEX_HARNESS_RESUME");
  const resumeSessionAt = getOption(options.args, "resume-session-at", "CODEX_HARNESS_RESUME_SESSION_AT");
  const continueSession = truthy(options.args.continue) || truthy(process.env.CODEX_HARNESS_CONTINUE);
  const persistSession = shouldPersistOpenAiSession(options.args);
  if (resume && continueSession) {
    throw new Error("--resume and --continue are mutually exclusive.");
  }
  if (!persistSession) {
    return { persistSession: false, sessionId: undefined, session: undefined };
  }

  let sessionId = resume ? sanitizeSessionId(resume) : undefined;
  if (continueSession) {
    const latest = await readJsonFileIfPresent(openAiLatestSessionFile(options.cwd));
    if (!latest?.sessionId) {
      throw new Error("No OpenAI session is available for --continue in this workspace.");
    }
    sessionId = sanitizeSessionId(latest.sessionId);
  }
  sessionId ??= generateOpenAiSessionId(agentName);

  const stored = await readJsonFileIfPresent(openAiSessionFile(options.cwd, sessionId));
  const initialItems = trimOpenAiSessionItems(Array.isArray(stored?.items) ? stored.items : [], resumeSessionAt);
  return {
    persistSession: true,
    sessionId,
    session: new sdk.MemorySession({ sessionId, initialItems })
  };
}

async function persistOpenAiSession(cwd, agentName, sessionId, session) {
  if (!sessionId || !session) {
    return;
  }
  const sessionRoot = openAiSessionRoot(cwd);
  await fs.promises.mkdir(sessionRoot, { recursive: true });
  const items = await session.getItems();
  const payload = {
    version: 1,
    sdk: "openai",
    agent: agentName,
    sessionId,
    updatedAt: new Date().toISOString(),
    items
  };
  await fs.promises.writeFile(openAiSessionFile(cwd, sessionId), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.promises.writeFile(openAiLatestSessionFile(cwd), `${JSON.stringify({
    version: 1,
    sdk: "openai",
    agent: agentName,
    sessionId,
    updatedAt: payload.updatedAt
  }, null, 2)}\n`, "utf8");
}

function logOpenAiStreamEvent(event) {
  if (event.type === "agent_updated_stream_event") {
    process.stderr.write(`[openai-progress] agent=${event.agent?.name ?? "unknown"}\n`);
    return;
  }
  if (event.type === "run_item_stream_event") {
    if (event.name === "message_output_created") {
      process.stderr.write("[openai-progress] message_output_created\n");
    } else if (event.name === "handoff_occurred") {
      process.stderr.write("[openai-progress] handoff_occurred\n");
    }
    return;
  }
  if (event.type === "raw_model_stream_event") {
    const type = event.data?.type;
    if (type && /error|failed/i.test(type)) {
      process.stderr.write(`[openai-progress] ${type}\n`);
    }
  }
}

function openAiApprovalToolName(item) {
  return item?.name ?? item?.toolName ?? item?.rawItem?.name ?? item?.rawItem?.action?.type ?? "unknown";
}

function applyOpenAiApprovalPolicy(streamed, provider, options, agentName) {
  const policy = buildToolPermissionPolicy(provider, options.args, agentName);
  const interruptions = streamed.interruptions ?? [];
  for (const item of interruptions) {
    const toolName = openAiApprovalToolName(item);
    process.stderr.write(`[openai-approval-request] tool=${toolName}\n`);
    const result = policy.decide(toolName);
    if (result.decision === "allow") {
      streamed.state.approve(item);
      process.stderr.write(`[openai-approval-result] tool=${toolName} decision=approve reason=${result.reason}\n`);
    } else {
      streamed.state.reject(item, { message: result.reason });
      process.stderr.write(`[openai-approval-result] tool=${toolName} decision=reject reason=${result.reason}\n`);
    }
  }
  return interruptions.length > 0;
}

async function runOpenAiSdk(agentName, prompt, provider, options) {
  let sdk;
  try {
    sdk = await import("@openai/agents");
  } catch (error) {
    throw new Error(`OpenAI Agents SDK import failed: ${error.message}`);
  }

  const abortController = options.overallTimeoutMs ? new AbortController() : undefined;
  const timeout = abortController
    ? setTimeout(() => abortController.abort(), options.overallTimeoutMs)
    : undefined;
  const tools = await createOpenAiTools(options, provider, agentName);
  const modelProvider = buildOpenAiProvider(sdk, provider);
  const sessionConfig = await resolveOpenAiSessionConfig(agentName, options, sdk);
  sdk.setTracingDisabled(!truthy(process.env.CODEX_HARNESS_OPENAI_TRACING));
  const agent = new sdk.Agent({
    name: agentName,
    instructions: openAiInstructions(agentName, options),
    model: provider.model,
    tools
  });
  const runOptions = {
    stream: true,
    maxTurns: options.maxTurns,
    signal: abortController?.signal,
    session: sessionConfig.session
  };

  process.stderr.write(`[openai-init] mode=external agent=${agentName} model=${provider.model} cwd=${options.cwd} tools=${tools.map((item) => item.name).join(",")}\n`);
  if (sessionConfig.sessionId) {
    process.stderr.write(`[openai-progress] session=${sessionConfig.sessionId} persist=${sessionConfig.persistSession}\n`);
  }
  const runner = new sdk.Runner({
    modelProvider,
    tracingDisabled: !truthy(process.env.CODEX_HARNESS_OPENAI_TRACING),
    traceIncludeSensitiveData: false,
    workflowName: "codex4claude"
  });
  let streamed = await runner.run(agent, prompt, runOptions);
  try {
    while (true) {
      for await (const event of streamed) {
        logOpenAiStreamEvent(event);
      }
      await streamed.completed;
      if (!applyOpenAiApprovalPolicy(streamed, provider, options, agentName)) {
        break;
      }
      streamed = await runner.run(agent, streamed.state, runOptions);
    }
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
    await modelProvider.close?.();
  }
  if (streamed.error) {
    throw streamed.error;
  }
  await persistOpenAiSession(options.cwd, agentName, sessionConfig.sessionId, sessionConfig.session);
  const output = String(streamed.finalOutput ?? "").trim();
  if (output) {
    process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
  }
  const turnCount = streamed.rawResponses?.length ?? streamed.currentTurn ?? "unknown";
  process.stderr.write(`[openai-result] success turns=${turnCount} response=${streamed.lastResponseId ?? "unknown"} session=${sessionConfig.sessionId ?? "none"}\n`);
  return output;
}

function handleCliStreamLine(line, state) {
  if (!line.trim()) {
    return;
  }
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    process.stdout.write(line.endsWith("\n") ? line : `${line}\n`);
    state.output += line.endsWith("\n") ? line : `${line}\n`;
    return;
  }
  if (message.type === "system" && message.subtype === "init") {
    process.stderr.write(`[fallback-init] session=${message.session_id ?? "unknown"} model=${message.model ?? "unknown"} cwd=${message.cwd ?? "unknown"}\n`);
    return;
  }
  if (message.type === "system" && message.subtype === "status") {
    process.stderr.write(`[fallback-status] ${message.status ?? "unknown"}\n`);
    return;
  }
  if (message.type === "assistant") {
    if (!state.sawStreamEvent) {
      state.output += printAssistantText(message);
    }
    return;
  }
  if (message.type === "user") {
    process.stderr.write("[fallback-tool-result]\n");
    return;
  }
  if (message.type === "result") {
    if (message.subtype === "success") {
      if (message.result && !state.output.trim()) {
        process.stdout.write(message.result.endsWith("\n") ? message.result : `${message.result}\n`);
        state.output += message.result.endsWith("\n") ? message.result : `${message.result}\n`;
      }
      process.stderr.write(`[fallback-result] success turns=${message.num_turns ?? "unknown"} cost=${message.total_cost_usd ?? "unknown"} session=${message.session_id ?? "unknown"}\n`);
    } else {
      state.failure = `Claude CLI result failed: ${message.subtype ?? "unknown"}`;
    }
    return;
  }
  if (message.type === "stream_event") {
    handleStreamEvent(message, state, "fallback");
    return;
  }
  if (message.type === "rate_limit_event") {
    process.stderr.write(`[fallback-rate-limit] status=${message.rate_limit_info?.status ?? "unknown"} type=${message.rate_limit_info?.rateLimitType ?? "unknown"}\n`);
  }
}

function shouldRetryStandardContext(error, model) {
  return model === "opus" && /Usage credits required|1M context|standard context/i.test(error.message);
}

function cleanupWarning(reason, error) {
  process.stderr.write(`[codex-cleanup-warning] reason=${reason} error=${String(error?.message ?? error)}\n`);
}

function cleanupCodexProcessTree(child, reason) {
  if (!child?.pid || child.killed) {
    return Promise.resolve();
  }
  if (process.platform === "win32") {
    return new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true
      });
      killer.on("error", (error) => {
        cleanupWarning(reason, error);
        resolve();
      });
      killer.on("close", (code) => {
        if (code !== 0) {
          cleanupWarning(reason, `taskkill exited with code ${code}`);
        }
        resolve();
      });
    });
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    cleanupWarning(reason, error);
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        // Process group already exited.
      }
      resolve();
    }, 1000);
  });
}

async function cleanupActiveCodexChildren(reason) {
  await Promise.all([...activeCodexChildren].map((child) => cleanupCodexProcessTree(child, reason)));
}

function spawnClaudeCli(cliArgs, options) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", cliArgs, {
      cwd: options.cwd,
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const state = { output: "", failure: undefined, seenPartialText: false, sawStreamEvent: false, lastTextEndsNewline: true, blocks: {} };
    let stdout = "";
    let stderr = "";
    let bufferedStdout = "";
    const startedAt = Date.now();
    const progress = setInterval(() => {
      process.stderr.write(`[fallback-progress] running elapsedMs=${Date.now() - startedAt}\n`);
    }, 15000);
    const timeout = options.overallTimeoutMs
      ? setTimeout(() => {
          process.stderr.write(`[fallback-timeout] elapsedMs=${Date.now() - startedAt} limitMs=${options.overallTimeoutMs}\n`);
          child.kill();
        }, options.overallTimeoutMs)
      : undefined;
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      bufferedStdout += text;
      const lines = bufferedStdout.split(/\r?\n/);
      bufferedStdout = lines.pop() ?? "";
      for (const line of lines) {
        handleCliStreamLine(line, state);
      }
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      clearInterval(progress);
      if (timeout) {
        clearTimeout(timeout);
      }
      if (bufferedStdout) {
        handleCliStreamLine(bufferedStdout, state);
      }
      if (state.failure) {
        reject(new Error(state.failure));
        return;
      }
      if (code === 0) {
        resolve((state.output || stdout).trim());
      } else {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr.trim()}`));
      }
    });
  });
}

function codexEventText(message) {
  if (typeof message.text === "string") {
    return message.text;
  }
  if (typeof message.delta === "string") {
    return message.delta;
  }
  if (typeof message.result === "string") {
    return message.result;
  }
  if (typeof message.output === "string") {
    return message.output;
  }
  if (typeof message.final_output === "string") {
    return message.final_output;
  }
  if (typeof message.item?.text === "string") {
    return message.item.text;
  }
  const content = message.message?.content ?? message.item?.content ?? message.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => typeof part === "string" ? part : part?.text ?? part?.content ?? "")
      .filter(Boolean)
      .join("");
  }
  return "";
}

function handleCodexCliStreamLine(line, state) {
  if (!line.trim()) {
    return;
  }
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    process.stdout.write(line.endsWith("\n") ? line : `${line}\n`);
    state.output += line.endsWith("\n") ? line : `${line}\n`;
    return;
  }

  const type = String(message.type ?? message.event ?? "");
  const itemType = String(message.item?.type ?? "");
  if (/session|init|started/i.test(type) && !state.sawInit) {
    state.sawInit = true;
    state.sessionId = message.thread_id ?? message.session_id ?? message.sessionId ?? message.id ?? "unknown";
    process.stderr.write(`[codex-init] session=${state.sessionId} model=${message.model ?? "unknown"} cwd=${message.cwd ?? "unknown"}\n`);
  }
  if (type === "turn.started") {
    process.stderr.write("[codex-progress] turn.started\n");
    return;
  }
  if (type === "turn.completed") {
    const usage = message.usage;
    const usageText = usage ? ` input=${usage.input_tokens ?? "unknown"} output=${usage.output_tokens ?? "unknown"} reasoning=${usage.reasoning_output_tokens ?? "unknown"}` : "";
    process.stderr.write(`[codex-progress] turn.completed${usageText}\n`);
    state.completed = true;
    process.stderr.write(`[codex-result] success session=${state.sessionId ?? "unknown"}\n`);
    return;
  }
  if (type === "item.started" && itemType === "command_execution") {
    process.stderr.write(`[codex-tool-start] ${message.item?.command ?? "command_execution"}\n`);
    return;
  }
  if (type === "item.completed" && itemType === "command_execution") {
    process.stderr.write(`[codex-tool-result] status=${message.item?.status ?? "unknown"} exit=${message.item?.exit_code ?? "unknown"}\n`);
    return;
  }
  if (type === "item.started" && itemType) {
    process.stderr.write(`[codex-progress] item.started ${itemType}\n`);
    return;
  }
  if (/tool.*start/i.test(type) || itemType === "tool_call") {
    process.stderr.write(`[codex-tool-start] ${message.name ?? message.item?.name ?? message.tool_name ?? "unknown"}\n`);
    return;
  }
  if (/tool.*result/i.test(type) || itemType === "tool_call_output") {
    process.stderr.write("[codex-tool-result]\n");
    return;
  }
  if (/progress|turn|agent|status/i.test(type)) {
    process.stderr.write(`[codex-progress] ${type || "event"}\n`);
  }

  const text = codexEventText(message);
  if (text && (itemType === "agent_message" || !/result|complete|done/i.test(type))) {
    process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
    state.output += text.endsWith("\n") ? text : `${text}\n`;
    return;
  }
  if (/error|failed/i.test(type) || message.error) {
    state.failure = `Codex CLI result failed: ${message.error?.message ?? message.message ?? type}`;
    return;
  }
  if (/result|complete|done/i.test(type)) {
    if (text && !state.output.trim()) {
      process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
      state.output += text.endsWith("\n") ? text : `${text}\n`;
    }
    if (type !== "item.completed") {
      process.stderr.write(`[codex-result] success session=${message.session_id ?? message.sessionId ?? message.id ?? state.sessionId ?? "unknown"}\n`);
    }
  }
}

function spawnCodexCli(cliArgs, options) {
  return new Promise((resolve, reject) => {
    const codexCommand = resolveCodexCommand(cliArgs);
    const child = spawn(codexCommand.command, codexCommand.args, {
      cwd: options.cwd,
      env: process.env,
      detached: process.platform !== "win32",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    activeCodexChildren.add(child);
    const state = { output: "", failure: undefined, sawInit: false };
    let stdout = "";
    let stderr = "";
    let bufferedStdout = "";
    const startedAt = Date.now();
    const progress = setInterval(() => {
      process.stderr.write(`[codex-progress] running elapsedMs=${Date.now() - startedAt}\n`);
    }, 15000);
    const timeout = options.overallTimeoutMs
      ? setTimeout(() => {
          process.stderr.write(`[codex-timeout] elapsedMs=${Date.now() - startedAt} limitMs=${options.overallTimeoutMs}\n`);
          void cleanupCodexProcessTree(child, "timeout");
        }, options.overallTimeoutMs)
      : undefined;
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      bufferedStdout += text;
      const lines = bufferedStdout.split(/\r?\n/);
      bufferedStdout = lines.pop() ?? "";
      for (const line of lines) {
        handleCodexCliStreamLine(line, state);
      }
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.on("error", (error) => {
      activeCodexChildren.delete(child);
      reject(error);
    });
    child.on("close", (code) => {
      activeCodexChildren.delete(child);
      clearInterval(progress);
      if (timeout) {
        clearTimeout(timeout);
      }
      if (bufferedStdout) {
        handleCodexCliStreamLine(bufferedStdout, state);
      }
      if (state.failure) {
        reject(new Error(state.failure));
        return;
      }
      if (code === 0) {
        resolve((state.output || stdout).trim());
      } else {
        reject(new Error(`Codex CLI exited with code ${code}: ${stderr.trim()}`));
      }
    });
  });
}

function resolveCodexCommand(cliArgs) {
  if (process.platform !== "win32") {
    return { command: "codex", args: cliArgs };
  }
  const npmCodexJs = process.env.APPDATA ? path.join(process.env.APPDATA, "npm", "node_modules", "@openai", "codex", "bin", "codex.js") : undefined;
  if (npmCodexJs && fs.existsSync(npmCodexJs)) {
    return { command: process.execPath, args: [npmCodexJs, ...cliArgs] };
  }
  return { command: "codex", args: cliArgs };
}

async function runCodexCli(agent, prompt, provider, options) {
  const resume = getOption(options.args, "resume", "CODEX_HARNESS_RESUME");
  const resumeSessionAt = getOption(options.args, "resume-session-at", "CODEX_HARNESS_RESUME_SESSION_AT");
  const continueSession = truthy(options.args.continue) || truthy(process.env.CODEX_HARNESS_CONTINUE);
  if (resume && continueSession) {
    throw new Error("--resume and --continue are mutually exclusive.");
  }
  if (resumeSessionAt) {
    throw new Error("--resume-session-at is not supported by the Codex CLI backend.");
  }

  const { sandbox, approvalPolicy } = codexCliPermissionMapping(effectivePermissionMode(agent, options.args, options.args.__isSequence));
  const model = provider.model ?? getOption(options.args, "model", "CODEX_HARNESS_MODEL", "sonnet");
  const cliArgs = [
    "--ask-for-approval",
    approvalPolicy,
    "--sandbox",
    sandbox,
    "--cd",
    options.cwd,
    "--model",
    model
  ];
  if (provider.codexProfile) {
    cliArgs.push("--profile", provider.codexProfile);
  }
  cliArgs.push("exec");
  if (continueSession) {
    cliArgs.push("resume", "--last");
  } else if (resume) {
    cliArgs.push("resume", resume);
  }
  cliArgs.push("--json", prompt);
  process.stderr.write(`[codex-init] mode=codexCli agent=${agent} model=${model} cwd=${options.cwd} sandbox=${sandbox} approval=${approvalPolicy}\n`);
  return spawnCodexCli(cliArgs, options);
}

async function runClaudeCli(agent, prompt, provider, options, reason) {
  const fallback = provider.fallback ?? fallbackPolicyForAgent(agent, provider.entry, options.args);
  const model = fallback.model;
  const effort = fallback.effort;
  const cliAgent = fallback.agent;
  const fallbackPrompt = buildFallbackPrompt(agent, prompt, provider, reason);
  const permissionMode = effectivePermissionMode(agent, options.args, options.args.__isSequence);
  const permissionPolicy = buildToolPermissionPolicy(provider, options.args, agent);
  const explicitAllowedTools = parseCsv(getOption(options.args, "allowed-tools", "CODEX_HARNESS_ALLOWED_TOOLS")) ?? [];
  const allowedTools = Array.from(new Set([...permissionPolicy.defaultAllowedTools(), ...explicitAllowedTools])).join(",");
  const disallowedTools = getOption(options.args, "disallowed-tools", "CODEX_HARNESS_DISALLOWED_TOOLS");
  const cliArgs = [
    "-p",
    "--agent",
    cliAgent,
    "--model",
    model,
    "--effort",
    effort,
    "--permission-mode",
    permissionMode,
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--verbose",
    "--plugin-dir",
    options.pluginPath,
    "--no-session-persistence",
    fallbackPrompt
  ];
  if (allowedTools) {
    cliArgs.splice(cliArgs.length - 1, 0, `--allowed-tools=${allowedTools}`);
  }
  if (disallowedTools) {
    cliArgs.splice(cliArgs.length - 1, 0, `--disallowed-tools=${disallowedTools}`);
  }
  if (options.maxBudgetUsd) {
    cliArgs.splice(cliArgs.length - 1, 0, "--max-budget-usd", String(options.maxBudgetUsd));
  }
  process.stderr.write(`[fallback] mode=claudeCli requestedAgent=${agent} cliAgent=${cliAgent} model=${model} effort=${effort} reason=${sanitizeReason(reason, provider)}\n`);
  try {
    return await spawnClaudeCli(cliArgs, options);
  } catch (error) {
    if (!shouldRetryStandardContext(error, model)) {
      throw error;
    }
    const retryArgs = [...cliArgs];
    retryArgs[retryArgs.indexOf("--model") + 1] = "sonnet";
    retryArgs[retryArgs.indexOf("--effort") + 1] = "high";
    process.stderr.write("[fallback-retry] mode=claudeCli model=sonnet effort=high reason=standard context required\n");
    return spawnClaudeCli(retryArgs, options);
  }
}

async function runAgent(agent, prompt, provider, options) {
  if (options.args["dry-run"]) {
    printRouting(agent, provider, options.args);
    return "";
  }
  if (provider.mode === "codexCli") {
    try {
      return await runCodexCli(agent, prompt, provider, options);
    } catch (error) {
      if (options.args["no-fallback"]) {
        throw error;
      }
      return runClaudeCli(agent, prompt, provider, options, error.message);
    }
  }
  if (provider.mode !== "external") {
    if (options.args["no-fallback"]) {
      throw new Error(`Agent ${agent} did not select an external provider: ${provider.fallbackReason ?? "provider not selected"}`);
    }
    return runClaudeCli(agent, prompt, provider, options, provider.fallbackReason ?? "provider not selected");
  }
  try {
    if ((provider.sdk ?? DEFAULT_SDK) === "openai") {
      return await runOpenAiSdk(agent, prompt, provider, options);
    }
    return await runSdk(agent, prompt, provider, options);
  } catch (error) {
    if (options.args["no-fallback"]) {
      throw error;
    }
    return runClaudeCli(agent, prompt, provider, options, error.message);
  }
}

function sequencePrompt(originalPrompt, previousOutputs) {
  if (previousOutputs.length === 0) {
    return originalPrompt;
  }
  return `${originalPrompt}

Previous agent output:
${previousOutputs.join("\n\n---\n\n")}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadLocalEnvFiles();
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }

  let prompt = getOption(args, "prompt", "CODEX_HARNESS_PROMPT");
  if (prompt === "-") {
    prompt = await readStdin();
  }
  if (!prompt) {
    throw new Error("Missing --prompt or CODEX_HARNESS_PROMPT.");
  }

  const cwd = path.resolve(getOption(args, "cwd", "CODEX_HARNESS_CWD", process.cwd()));
  loadLocalEnvFiles(cwd);
  const pluginPath = path.resolve(root, getOption(args, "plugin-path", "CODEX_HARNESS_PLUGIN_PATH", "plugins/codex-harness"));
  const maxTurns = parseMaxTurns(args);
  const overallTimeoutMs = getOption(args, "overall-timeout-ms", "CODEX_HARNESS_OVERALL_TIMEOUT_MS")
    ? Number.parseInt(getOption(args, "overall-timeout-ms", "CODEX_HARNESS_OVERALL_TIMEOUT_MS"), 10)
    : undefined;
  if (overallTimeoutMs !== undefined && (!Number.isInteger(overallTimeoutMs) || overallTimeoutMs < 1)) {
    throw new Error("--overall-timeout-ms must be a positive integer.");
  }
  const maxBudgetUsdRaw = getOption(args, "max-budget-usd", "CODEX_HARNESS_MAX_BUDGET_USD");
  const maxBudgetUsd = maxBudgetUsdRaw ? Number.parseFloat(maxBudgetUsdRaw) : undefined;
  if (maxBudgetUsdRaw && (!Number.isFinite(maxBudgetUsd) || maxBudgetUsd <= 0)) {
    throw new Error("--max-budget-usd must be a positive number.");
  }

  const config = readJsonIfPresent(resolveConfigPath(args));
  const sequence = getOption(args, "agent-sequence", "CODEX_HARNESS_AGENT_SEQUENCE");
  const agents = sequence
    ? sequence.split(",").map((item) => item.trim()).filter(Boolean)
    : [getOption(args, "agent", "CODEX_HARNESS_AGENT", "codex-main")];
  if (agents.length === 0) {
    throw new Error("--agent-sequence must include at least one agent.");
  }
  args.__isSequence = agents.length > 1;

  const options = { args, cwd, pluginPath, maxTurns, maxBudgetUsd, overallTimeoutMs };
  const outputs = [];
  for (let index = 0; index < agents.length; index += 1) {
    const agent = agents[index];
    const provider = resolveProvider(agent, args, config);
    if (agents.length > 1 && !args["dry-run"]) {
      process.stderr.write(`[sequence-start] index=${index + 1}/${agents.length} agent=${agent} sdk=${provider.sdk ?? DEFAULT_SDK} mode=${provider.mode}\n`);
    }
    const output = await runAgent(agent, sequencePrompt(prompt, outputs), provider, options);
    if (output) {
      outputs.push(`[${agent}]\n${output}`);
    }
    if (agents.length > 1 && !args["dry-run"]) {
      process.stderr.write(`[sequence-result] index=${index + 1}/${agents.length} agent=${agent} output=${output ? "nonempty" : "empty"}\n`);
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    await cleanupActiveCodexChildren(signal);
    process.exit(128 + (signal === "SIGINT" ? 2 : 15));
  });
}

process.once("uncaughtException", async (error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  await cleanupActiveCodexChildren("uncaughtException");
  process.exit(1);
});

main().catch(async (error) => {
  await cleanupActiveCodexChildren("mainError");
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
});

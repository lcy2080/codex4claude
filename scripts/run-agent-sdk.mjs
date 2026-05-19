#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PROVIDER_CONFIG = "config/agent-providers.json";
const DEFAULT_FALLBACK_AGENT = "codex-harness:codex-main";
const DEFAULT_AGENT_FALLBACKS = {
  "codex-main": { model: "sonnet", effort: "high" },
  "context-explorer": { model: "haiku", effort: "low" },
  "implementation-worker": { model: "sonnet", effort: "medium" },
  "code-reviewer": { model: "sonnet", effort: "high" },
  "verification-auditor": { model: "opus", effort: "max" }
};

const HELP = `Usage:
  node scripts/run-agent-sdk.mjs --prompt <text> [--agent <name>] [options]
  node scripts/run-agent-sdk.mjs --prompt <text> --agent-sequence <a,b,c> [options]
  node scripts/run-agent-sdk.mjs --prompt <text> --base-url <url> --api-key-env <ENV_NAME> [options]
  node scripts/run-agent-sdk.mjs --prompt <text> --base-url <url> --auth-token-env <ENV_NAME> [options]

Provider routing:
  --agent-provider-config <path>  Agent provider manifest. Defaults to config/agent-providers.json.
  --agent-sequence <a,b,c>        Run agents sequentially, selecting provider or Claude CLI per agent.
  --dry-run                      Print sanitized routing decisions without SDK/API/Claude CLI execution.

External provider options:
  --base-url <url>                Anthropic-compatible endpoint URL.
  --api-key-env <ENV_NAME>        Environment variable containing an API key.
  --auth-token-env <ENV_NAME>     Environment variable containing a bearer token.
  --model <name>                  SDK or Claude CLI session model. Defaults to "sonnet".
  --agent <name>                  Main-thread agent. Defaults to "codex-main".
  --effort <level>                Sets CLAUDE_CODE_EFFORT_LEVEL or passes --effort to Claude CLI.
  --fallback-model <name>         Claude CLI fallback model alias when no agent policy overrides it.
  --fallback-effort <level>       Claude CLI fallback effort when no agent policy overrides it.
  --haiku-model <name>            Maps the haiku alias for this run.
  --sonnet-model <name>           Maps the sonnet alias for this run.
  --opus-model <name>             Maps the opus alias for this run.
  --timeout-ms <number>           Sets API_TIMEOUT_MS for compatible providers.
  --max-turns <number>            Maximum SDK agentic turns.
  --cwd <path>                    Working directory. Defaults to current directory.
  --plugin-path <path>            Plugin path. Defaults to plugins/codex-harness.
  --help                         Show this help.

Claude CLI fallback:
  If an agent has no external provider config, provider env is empty, or SDK execution fails,
  the runner uses Claude Code CLI directly through the harness main agent:
  claude -p --agent codex-harness:codex-main --model <model> --effort <level>.
  This preserves Claude Code Max/Pro subscription usage without calling Claude Code through Agent SDK.

Environment fallbacks:
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
    if (key === "help" || key === "dry-run") {
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

function setIfPresent(env, key, value) {
  if (value !== undefined && value !== "") {
    env[key] = value;
  }
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
  if (mode !== "external" && mode !== "claudeCli") {
    throw new Error(`Agent ${agent} has unsupported provider mode: ${mode}`);
  }
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
  return path.resolve(root, configured);
}

function envValueFromName(envName) {
  return envName ? process.env[envName] : undefined;
}

function providerFromManifest(agent, config) {
  const agents = config?.agents ?? {};
  const entry = agents[agent];
  if (!entry) {
    return {
      mode: "claudeCli",
      fallbackReason: "no agent provider entry",
      fallback: fallbackPolicyForAgent(agent)
    };
  }
  const mode = entry.mode ?? "claudeCli";
  assertMode(mode, agent);
  const fallback = fallbackPolicyForAgent(agent, entry);
  if (mode === "claudeCli") {
    return {
      mode,
      model: fallback.model,
      effort: fallback.effort,
      fallback,
      fallbackReason: "agent configured for Claude CLI",
      entry
    };
  }

  const credential = entry.credential ?? {};
  assertEnvName(entry.baseUrlEnv, `${agent}.baseUrlEnv`);
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
      fallbackReason: "external provider env is incomplete",
      model: fallback.model,
      effort: fallback.effort,
      fallback,
      entry
    };
  }
  return {
    mode,
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
      model: fallback.model,
      effort: fallback.effort,
      fallback,
      fallbackReason: "explicit external provider env is incomplete"
    };
  }
  return {
    mode: "external",
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
  return explicit ?? providerFromManifest(agent, config);
}

function printRouting(agent, provider, args) {
  const fallback = provider.fallback ?? fallbackPolicyForAgent(agent, provider.entry, args);
  const payload = {
    agent,
    mode: provider.mode,
    model: provider.model ?? getOption(args, "model", "CODEX_HARNESS_MODEL", "sonnet"),
    effort: provider.effort ?? getOption(args, "effort", "CODEX_HARNESS_EFFORT", "medium"),
    fallbackAgent: fallback.agent,
    fallbackModel: fallback.model,
    fallbackEffort: fallback.effort,
    baseUrlEnv: provider.entry?.baseUrlEnv,
    credentialType: provider.credentialType ?? provider.entry?.credential?.type,
    credentialEnv: provider.credentialEnv ?? provider.entry?.credential?.env,
    fallbackReason: provider.fallbackReason,
    fallbackEligible: true
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

async function runSdk(agent, prompt, provider, options) {
  let sdk;
  try {
    sdk = await import("@anthropic-ai/claude-agent-sdk");
  } catch (error) {
    throw new Error(`SDK import failed: ${error.message}`);
  }

  const query = sdk.query({
    prompt,
    options: {
      cwd: options.cwd,
      env: buildSdkEnv(provider, options.args),
      model: provider.model,
      agent,
      maxTurns: options.maxTurns,
      plugins: [{ type: "local", path: options.pluginPath }],
      settingSources: ["project"],
      systemPrompt: { type: "preset", preset: "claude_code" },
      tools: { type: "preset", preset: "claude_code" },
      permissionMode: "default",
      persistSession: false
    }
  });

  let output = "";
  for await (const message of query) {
    if (message.type === "system" && message.subtype === "init") {
      process.stderr.write(`[init] mode=external agent=${agent} model=${message.model} cwd=${message.cwd}\n`);
    } else if (message.type === "assistant") {
      output += printAssistantText(message);
    } else if (message.type === "result" && message.subtype !== "success") {
      throw new Error(`SDK result failed: ${message.subtype}`);
    } else if (message.type === "result") {
      process.stderr.write(`[result] success turns=${message.num_turns}\n`);
    }
  }
  return output.trim();
}

function shouldRetryStandardContext(error, model) {
  return model === "opus" && /Usage credits required|1M context|standard context/i.test(error.message);
}

function spawnClaudeCli(cliArgs, options) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", cliArgs, {
      cwd: options.cwd,
      env: process.env,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr.trim()}`));
      }
    });
  });
}

async function runClaudeCli(agent, prompt, provider, options, reason) {
  const fallback = provider.fallback ?? fallbackPolicyForAgent(agent, provider.entry, options.args);
  const model = fallback.model;
  const effort = fallback.effort;
  const cliAgent = fallback.agent;
  const fallbackPrompt = buildFallbackPrompt(agent, prompt, provider, reason);
  const cliArgs = [
    "-p",
    "--agent",
    cliAgent,
    "--model",
    model,
    "--effort",
    effort,
    "--plugin-dir",
    options.pluginPath,
    "--no-session-persistence",
    fallbackPrompt
  ];
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
  if (provider.mode !== "external") {
    return runClaudeCli(agent, prompt, provider, options, provider.fallbackReason ?? "provider not selected");
  }
  try {
    return await runSdk(agent, prompt, provider, options);
  } catch (error) {
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
  const pluginPath = path.resolve(root, getOption(args, "plugin-path", "CODEX_HARNESS_PLUGIN_PATH", "plugins/codex-harness"));
  const maxTurns = args["max-turns"] ? Number.parseInt(args["max-turns"], 10) : undefined;
  if (args["max-turns"] && (!Number.isInteger(maxTurns) || maxTurns < 1)) {
    throw new Error("--max-turns must be a positive integer.");
  }

  const config = readJsonIfPresent(resolveConfigPath(args));
  const sequence = getOption(args, "agent-sequence", "CODEX_HARNESS_AGENT_SEQUENCE");
  const agents = sequence
    ? sequence.split(",").map((item) => item.trim()).filter(Boolean)
    : [getOption(args, "agent", "CODEX_HARNESS_AGENT", "codex-main")];
  if (agents.length === 0) {
    throw new Error("--agent-sequence must include at least one agent.");
  }

  const options = { args, cwd, pluginPath, maxTurns };
  const outputs = [];
  for (const agent of agents) {
    const provider = resolveProvider(agent, args, config);
    const output = await runAgent(agent, sequencePrompt(prompt, outputs), provider, options);
    if (output) {
      outputs.push(`[${agent}]\n${output}`);
    }
  }
}

main().catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
});

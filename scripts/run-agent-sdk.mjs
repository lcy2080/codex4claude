#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const HELP = `Usage:
  node scripts/run-agent-sdk.mjs --prompt <text> --base-url <url> --api-key-env <ENV_NAME> [options]
  node scripts/run-agent-sdk.mjs --prompt <text> --base-url <url> --auth-token-env <ENV_NAME> [options]

Required:
  --prompt <text>                 Prompt to send. Use "-" to read from stdin.
  --base-url <url>                Anthropic-compatible endpoint URL.
  --api-key-env <ENV_NAME>        Environment variable containing an API key.
  --auth-token-env <ENV_NAME>     Environment variable containing a bearer token.

Options:
  --model <name>                  SDK session model. Defaults to "sonnet".
  --agent <name>                  Main-thread agent. Defaults to "codex-main".
  --effort <level>                Sets CLAUDE_CODE_EFFORT_LEVEL for this run.
  --haiku-model <name>            Maps the haiku alias for this run.
  --sonnet-model <name>           Maps the sonnet alias for this run.
  --opus-model <name>             Maps the opus alias for this run.
  --timeout-ms <number>           Sets API_TIMEOUT_MS for compatible providers.
  --max-turns <number>            Maximum agentic turns.
  --cwd <path>                    Working directory. Defaults to current directory.
  --plugin-path <path>            Plugin path. Defaults to plugins/codex-harness.
  --help                         Show this help.

Environment fallbacks:
  CODEX_HARNESS_BASE_URL
  CODEX_HARNESS_API_KEY_ENV
  CODEX_HARNESS_AUTH_TOKEN_ENV
  CODEX_HARNESS_MODEL
  CODEX_HARNESS_AGENT
  CODEX_HARNESS_EFFORT
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
    if (key === "help") {
      args.help = true;
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

function assertEnvName(name, flagName) {
  if (!name) {
    return;
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`${flagName} must be an environment variable name, not a secret value.`);
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}

function setIfPresent(env, key, value) {
  if (value !== undefined && value !== "") {
    env[key] = value;
  }
}

function printAssistantText(message) {
  const content = message?.message?.content;
  if (!Array.isArray(content)) {
    return;
  }
  for (const part of content) {
    if (part?.type === "text" && part.text) {
      process.stdout.write(part.text);
      if (!part.text.endsWith("\n")) {
        process.stdout.write("\n");
      }
    } else if (part?.type === "tool_use") {
      process.stderr.write(`[tool_use] ${part.name ?? "unknown"}\n`);
    }
  }
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
  const baseUrl = getOption(args, "base-url", "CODEX_HARNESS_BASE_URL");
  const apiKeyEnv = getOption(args, "api-key-env", "CODEX_HARNESS_API_KEY_ENV");
  const authTokenEnv = getOption(args, "auth-token-env", "CODEX_HARNESS_AUTH_TOKEN_ENV");

  assertEnvName(apiKeyEnv, "--api-key-env");
  assertEnvName(authTokenEnv, "--auth-token-env");

  if (!prompt) {
    throw new Error("Missing --prompt or CODEX_HARNESS_PROMPT.");
  }
  if (!baseUrl) {
    throw new Error("Missing --base-url or CODEX_HARNESS_BASE_URL.");
  }
  if (apiKeyEnv && authTokenEnv) {
    throw new Error("Use exactly one credential mode: --api-key-env or --auth-token-env.");
  }
  if (!apiKeyEnv && !authTokenEnv) {
    throw new Error("Use exactly one credential mode: --api-key-env or --auth-token-env.");
  }

  const credentialEnvName = apiKeyEnv || authTokenEnv;
  const credentialValue = process.env[credentialEnvName];
  if (!credentialValue) {
    throw new Error(`Environment variable ${credentialEnvName} is not set or is empty.`);
  }

  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  env.ANTHROPIC_BASE_URL = baseUrl;
  if (apiKeyEnv) {
    env.ANTHROPIC_API_KEY = credentialValue;
  } else {
    env.ANTHROPIC_AUTH_TOKEN = credentialValue;
  }
  setIfPresent(env, "ANTHROPIC_DEFAULT_HAIKU_MODEL", args["haiku-model"]);
  setIfPresent(env, "ANTHROPIC_DEFAULT_SONNET_MODEL", args["sonnet-model"]);
  setIfPresent(env, "ANTHROPIC_DEFAULT_OPUS_MODEL", args["opus-model"]);
  setIfPresent(env, "CLAUDE_CODE_EFFORT_LEVEL", getOption(args, "effort", "CODEX_HARNESS_EFFORT"));
  setIfPresent(env, "API_TIMEOUT_MS", getOption(args, "timeout-ms", "CODEX_HARNESS_TIMEOUT_MS"));
  env.CLAUDE_AGENT_SDK_CLIENT_APP = "codex4claude";

  const cwd = path.resolve(getOption(args, "cwd", "CODEX_HARNESS_CWD", process.cwd()));
  const pluginPath = path.resolve(root, getOption(args, "plugin-path", "CODEX_HARNESS_PLUGIN_PATH", "plugins/codex-harness"));
  const model = getOption(args, "model", "CODEX_HARNESS_MODEL", "sonnet");
  const agent = getOption(args, "agent", "CODEX_HARNESS_AGENT", "codex-main");
  const maxTurns = args["max-turns"] ? Number.parseInt(args["max-turns"], 10) : undefined;
  if (args["max-turns"] && (!Number.isInteger(maxTurns) || maxTurns < 1)) {
    throw new Error("--max-turns must be a positive integer.");
  }

  let sdk;
  try {
    sdk = await import("@anthropic-ai/claude-agent-sdk");
  } catch (error) {
    throw new Error(`Unable to load @anthropic-ai/claude-agent-sdk. Run npm install first. ${error.message}`);
  }

  const query = sdk.query({
    prompt,
    options: {
      cwd,
      env,
      model,
      agent,
      maxTurns,
      plugins: [{ type: "local", path: pluginPath }],
      settingSources: ["project"],
      systemPrompt: { type: "preset", preset: "claude_code" },
      tools: { type: "preset", preset: "claude_code" },
      permissionMode: "default",
      persistSession: false
    }
  });

  for await (const message of query) {
    if (message.type === "system" && message.subtype === "init") {
      process.stderr.write(`[init] model=${message.model} cwd=${message.cwd}\n`);
    } else if (message.type === "assistant") {
      printAssistantText(message);
    } else if (message.type === "result") {
      if (message.subtype === "success") {
        process.stderr.write(`[result] success turns=${message.num_turns}\n`);
      } else {
        process.stderr.write(`[result] ${message.subtype}\n`);
        if (Array.isArray(message.errors)) {
          for (const error of message.errors) {
            process.stderr.write(`- ${error}\n`);
          }
        }
        process.exitCode = 1;
      }
    }
  }
}

main().catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
});

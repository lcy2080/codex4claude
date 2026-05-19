---
description: Run the Codex harness through Claude Agent SDK against an Anthropic-compatible external provider
argument-hint: [provider-backed task]
model: sonnet
effort: medium
---

Task: $ARGUMENTS

Use `scripts/run-agent-sdk.mjs` when the user explicitly wants this task to run through an Anthropic-compatible external provider. Do not ask the user to paste API keys into chat. Require credentials to already exist in a shell environment variable and pass only that variable name to the runner.

Use API-key mode:

```bash
node scripts/run-agent-sdk.mjs --base-url "$CODEX_HARNESS_BASE_URL" --api-key-env PROVIDER_API_KEY --prompt "$ARGUMENTS"
```

Use bearer-token mode:

```bash
node scripts/run-agent-sdk.mjs --base-url "$CODEX_HARNESS_BASE_URL" --auth-token-env PROVIDER_TOKEN --prompt "$ARGUMENTS"
```

If the provider does not accept Claude model aliases, include `--model <provider-model>` or alias mappings such as `--sonnet-model <provider-model>`. Report the provider base URL, selected model, and credential environment variable name, but never print the credential value.

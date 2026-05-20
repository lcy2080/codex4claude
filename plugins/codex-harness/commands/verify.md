---
description: Audit completion against explicit requirements before claiming done
argument-hint: [scope]
model: opus
effort: xhigh
---

Verification scope: $ARGUMENTS

Use `node scripts/run-agent-sdk.mjs --agent verification-auditor --prompt "$ARGUMENTS"` first when the runner is available. The runner uses the backend selected by `CODEX_HARNESS_VERIFICATION_AUDITOR_MODE`; leave it unset or set it to `claudeCli` for the default Claude CLI path, or set it to `external`, `anthropic`, `openai`, or `codexCli` to select another backend. If provider configuration is incomplete or execution fails, rely on the runner's Claude CLI fallback.

If the runner is unavailable in this workspace, continue in the current Claude Code session and state that the runner was unavailable. Restate the objective as deliverables, build a prompt-to-artifact checklist, inspect actual evidence, identify missing or weakly verified items, and continue working if any required item is incomplete.

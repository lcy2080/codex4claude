---
description: Audit completion against explicit requirements before claiming done
argument-hint: [scope]
model: opus
effort: xhigh
---

Verification scope: $ARGUMENTS

Perform a completion audit:

1. Restate the objective as concrete deliverables.
2. Build a prompt-to-artifact checklist.
3. Inspect actual files, command output, tests, or docs for each item.
4. Identify missing, weakly verified, or uncovered requirements.
5. Continue working if any required item is incomplete.

Do not treat passing tests or a manifest as sufficient unless they cover the stated requirements.

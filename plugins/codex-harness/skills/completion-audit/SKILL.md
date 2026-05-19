---
description: Use before claiming a task is complete. Audits explicit user requirements against actual files, command output, tests, and other concrete evidence.
effort: max
---

# Completion Audit

Run this workflow before saying a task is done:

1. Restate the user objective as concrete deliverables.
2. Build a checklist that maps every explicit requirement, named file, command, test, gate, and deliverable to evidence.
3. Inspect the relevant files or command output for each checklist item.
4. Mark each item as satisfied, missing, incomplete, or weakly verified.
5. Continue working if any required item is missing or uncertain.

Do not rely on intent, elapsed effort, a plausible manifest, or passing tests unless they directly cover the requirement.

---
description: Use at the start of unfamiliar repository work to gather just enough context for a safe plan without over-reading or anchoring on irrelevant files.
---

# Context Triage

1. Read repository instructions first.
2. List files with `rg --files` or the fastest available file search.
3. Search for exact symbols, command names, route names, or config keys from the task.
4. Read only the files needed to understand the change boundary.
5. Summarize what is known, what is inferred, and what remains unknown.

Stop when you can name the likely files to change and the verification command.

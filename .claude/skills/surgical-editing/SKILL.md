---
description: Use when making code or configuration edits where scope control matters. Enforces read-before-write, minimal diffs, local style matching, and preservation of unrelated user changes.
---

# Surgical Editing

Before editing:

1. Read the nearest instructions and the relevant target files.
2. Identify the minimum files needed for the request.
3. Note assumptions if ambiguity affects behavior or scope.

While editing:

- Match existing style and naming.
- Avoid speculative abstractions.
- Keep unrelated formatting and cleanup out of the diff.
- Preserve user changes, even if they are adjacent.

After editing:

- Remove only unused code introduced by your change.
- Run focused verification.
- Report changed paths and verification evidence.

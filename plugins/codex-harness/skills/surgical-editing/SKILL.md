---
description: Use when making code or configuration edits where scope control matters. Enforces read-before-write, minimal diffs, local style matching, and preservation of unrelated user changes.
---

# Surgical Editing

Before editing, read the nearest instructions and target files, identify the minimum files needed, and note assumptions if ambiguity affects scope.

While editing, match local style, avoid speculative abstractions, keep unrelated cleanup out of the diff, and preserve user changes.

After editing, remove only unused code introduced by your change, run focused verification, and report changed paths with evidence.

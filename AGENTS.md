# Agent Instructions

This repository packages a Claude Code harness. Before editing, read this file. If a personal global instruction file exists at `%USERPROFILE%\.claude\KARPATHY.md` on Windows or `$HOME/.claude/KARPATHY.md` on POSIX systems, read it as well and merge it with these repository instructions.

Use the smallest change that advances the harness. Do not add speculative features, new framework dependencies, or unrelated docs. Every artifact should map to one of the harness surfaces: project memory, settings, output style, slash commands, skills, agents, plugin packaging, or verification.

Before claiming completion, run `pwsh -File scripts/verify-harness.ps1` and inspect the actual file list.

---
okf_version: "0.2"
---

# ADR index

| Doc | Status | Description |
|-----|--------|-------------|
| [001-eslint-plugin-for-claude-config.md](001-eslint-plugin-for-claude-config.md) | stable | The checks for Claude Code configuration files live in an ESLint plugin, `eslint-plugin-claude`, on `@eslint/markdown` and `@eslint/json`, with `yaml` for frontmatter. It is TypeScript built to `dist/`, published to npm from this repository, and ships the `recommended` and `strict` configs. |

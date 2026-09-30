---
okf_version: "0.2"
---

# ADR index

| Doc | Status | Description |
|-----|--------|-------------|
| [001-eslint-plugin-for-claude-config.md](001-eslint-plugin-for-claude-config.md) | stable | The checks for Claude Code configuration files live in an ESLint plugin, `eslint-plugin-claude`, on `@eslint/markdown` and `@eslint/json`, with `yaml` for frontmatter. It is TypeScript built to `dist/`, published to npm from this repository, and ships the `recommended` and `strict` configs. |
| [002-classify-docs-changes-with-jev.md](002-classify-docs-changes-with-jev.md) | stable | The docs watch classifies each changed Claude Code docs block with three TypeSafe Jev Noul questions and fixed thresholds, keeps its state in docs/ where only a reviewed pull request changes it, and opens one deduplicated GitHub issue for each finding. |

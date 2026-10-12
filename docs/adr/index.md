---
okf_version: "0.2"
---

# ADR index

| Doc | Status | Description |
|-----|--------|-------------|
| [001-eslint-plugin-for-claude-config.md](001-eslint-plugin-for-claude-config.md) | stable | The checks for Claude Code configuration files live in an ESLint plugin, `eslint-plugin-claude`, on `@eslint/markdown` and `@eslint/json`, with `yaml` for frontmatter. It is TypeScript built to `dist/`, published to npm from this repository, and ships the `recommended` and `strict` configs. Its rules check only the files that a git repository holds. |
| [002-classify-docs-changes-with-jev.md](002-classify-docs-changes-with-jev.md) | stable | The docs watch classifies each changed Claude Code docs block with three TypeSafe Jev Noul questions and fixed thresholds, keeps its state in docs/ where only a reviewed pull request changes it, and opens deduplicated GitHub issues, with digest issues for the uncited blocks of each page. |
| [003-generate-rule-docs-with-eslint-doc-generator.md](003-generate-rule-docs-with-eslint-doc-generator.md) | stable | eslint-doc-generator 3.7.1 writes the README rule list and the header and options list of each rule doc from the rule meta, in its own format. A docs check in CI fails when they do not agree. The rule details, the examples, Usage, the Category and Files table and Sources stay hand-written. |

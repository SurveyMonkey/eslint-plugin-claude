---
okf_version: "0.2"
---

# Docs index

| Doc | Description |
|-----|-------------|
| [rules-inventory.md](rules-inventory.md) | Every check on Claude Code configuration files that the Claude Code docs make measurable, as candidate rules for eslint-plugin-claude, with a group, a preset and a severity for each rule and a link to the docs that source it. |
| [adr/index.md](adr/index.md) | The Architecture Decision Records. |
| [rules/index.md](rules/index.md) | One doc for each rule that eslint-plugin-claude ships, with its configs, severity, files, options and sources. |
| [rule-sources.json](rule-sources.json) | The pages and headings of the Claude Code docs that are the source of each rule that eslint-plugin-claude ships. A test checks it. |
| [docs-snapshot/](docs-snapshot/) | The stored state of each Claude Code docs page that a rule cites. It holds the page hash, the hash of each block, and the text of each mapped block. The docs watch compares live pages with it. |

---
okf_version: "0.2"
---

# Rule docs index

| Doc | Description |
|-----|-------------|
| [skill-description-max-length.md](skill-description-max-length.md) | The ESLint rule claude/skill-description-max-length, which limits a SKILL.md description plus when_to_use to 1,536 characters, the cut in the Claude Code skill listing, with its options, examples and sources. |
| [command-legacy-format.md](command-legacy-format.md) | The ESLint rule claude/command-legacy-format, which reports each Markdown file in a .claude/commands/ directory or in the commands/ directory of a plugin as the legacy form of a skill. |
| [hooks-event-name-known.md](hooks-event-name-known.md) | The ESLint rule claude/hooks-event-name-known, which reports a hook event name that Claude Code does not know in hooks.json, settings or plugin.json, and suggests the correct name for a near miss. |
| [skill-frontmatter-position.md](skill-frontmatter-position.md) | The ESLint rule claude/skill-frontmatter-position, which reports a frontmatter block in a SKILL.md or command file that does not start on line 1, because Claude Code then reads it as body text. |
| [skill-frontmatter-schema.md](skill-frontmatter-schema.md) | The ESLint rule claude/skill-frontmatter-schema, which reports a frontmatter key that Claude Code does not know, a near miss of a known key, a wrong type or value, and a name or paths field in a command file. |
| [skill-fork-fields-require-context.md](skill-fork-fields-require-context.md) | The ESLint rule claude/skill-fork-fields-require-context, which reports an agent or background field in a skill or command file that does not set context: fork, because Claude Code then ignores both fields. |
| [skill-invocation-unreachable.md](skill-invocation-unreachable.md) | The ESLint rule claude/skill-invocation-unreachable, which reports a SKILL.md that sets disable-model-invocation to true and user-invocable to false, because neither Claude nor the user can invoke it. |
| [skill-reserved-name.md](skill-reserved-name.md) | The ESLint rule claude/skill-reserved-name, which reports a skill folder named synced, and a skill folder, frontmatter name, or command file or folder named anthropic-skills, outside a plugin, because Claude Code does not load them. |
| [skill-plugin-vars-outside-plugin.md](skill-plugin-vars-outside-plugin.md) | The ESLint rule claude/skill-plugin-vars-outside-plugin, which reports CLAUDE_PLUGIN_ROOT and CLAUDE_PLUGIN_DATA in the body or allowed-tools of a skill or command file outside a plugin, where they stay literal text. |
| [skill-inject-bang-position.md](skill-inject-bang-position.md) | The ESLint rule claude/skill-inject-bang-position, which reports an inline command placeholder in a skill or command body that follows a character other than whitespace, because Claude Code then keeps it as literal text and does not run it. |
| [skill-allowed-tools-ineffective.md](skill-allowed-tools-ineffective.md) | The ESLint rule claude/skill-allowed-tools-ineffective, which reports EndConversation in disallowed-tools and AskUserQuestion in allowed-tools in a skill or command file, because neither entry has an effect. |

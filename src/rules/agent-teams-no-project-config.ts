// Claude Code has no project-level team config. A file under `.claude/teams/`
// is an ordinary file (docs/rules/agent-teams-no-project-config.md). The rule
// reports each Markdown and JSON file there, because ESLint lints a file
// only when a language matches it. One rule object serves both languages: the
// Markdown tree has a `root` node, and the JSON tree has a `Document` node.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'

const name = 'agent-teams-no-project-config' as const

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not keep a team config file in .claude/teams/',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      noProjectConfig:
        'Claude Code has no project-level team config. It does not read this file as configuration.',
    },
  },
  create(context) {
    const report = () =>
      context.report({
        loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
        messageId: 'noProjectConfig',
      })
    return { root: report, Document: report }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/.claude/teams/**/*.md'],
  // The same rule, for the files that the JSON language reads.
  also: { language: 'json' as const, files: ['**/.claude/teams/**/*.json'] },
  rule,
}

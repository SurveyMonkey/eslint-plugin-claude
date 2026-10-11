// Claude Code reads no standalone hooks file for project or user hooks
// (docs/rules/hooks-no-standalone-file.md). Those hooks go under the `hooks` key of a settings
// file. A plugin reads `hooks/hooks.json` at its root, and not a file under `.claude-plugin/`.
// `hooksFileKind` finds what Claude Code does with the file.
import type { Rule } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { hooksFileKind } from '../hooks-files.ts'

const name = 'hooks-no-standalone-file' as const

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Put project hooks under the hooks key of a settings file, not in a hooks file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      standalone:
        'Claude Code does not read this file. Project and user hooks go under the "hooks" key of a settings file, such as .claude/settings.json.',
      pluginDir:
        'Claude Code does not read this file. A plugin keeps its hooks in hooks/hooks.json at the plugin root, not in .claude-plugin/.',
    },
  },
  create(context) {
    return {
      Document() {
        const kind = hooksFileKind(context.filename)
        if (kind === 'project' || kind === 'manifestDir') {
          context.report({
            loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
            messageId: kind === 'project' ? 'standalone' : 'pluginDir',
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: [
    '**/.claude/hooks.json',
    '**/.claude/hooks/hooks.json',
    '**/.claude-plugin/hooks.json',
    '**/.claude-plugin/hooks/hooks.json',
  ],
  rule,
}

// Claude Code does not load a skill folder `synced`, or a skill or command
// named `anthropic-skills` (docs/rules/skill-reserved-name.md). A plugin is
// out of scope: the docs give the rule for names outside a plugin.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-reserved-name' as const

/** True for `anthropic-skills`, and for a name that starts with
 *  `anthropic-skills:`. */
function isSyncedNamespace(text: string): boolean {
  return text === 'anthropic-skills' || text.startsWith('anthropic-skills:')
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'folder' | 'name' | 'command' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not use a name that Claude Code reserves for synced skills',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      folder:
        '`{{name}}` is a reserved name. Claude Code does not load this skill. Rename the folder.',
      name: '`{{name}}` is a reserved name. Claude Code does not load this skill. Rename it.',
      command:
        '`{{name}}` is a reserved name. Claude Code does not load this command. Rename the file or folder.',
    },
  },
  create(context) {
    const file = classifySkillFile(context.filename)
    if (file === null || file.plugin) {
      return {}
    }
    const first = { line: 1, column: 1 }
    return {
      root() {
        if (file.kind === 'skill') {
          const folder = file.names[0] as string
          if (folder.toLowerCase() === 'synced' || isSyncedNamespace(folder)) {
            context.report({ loc: first, messageId: 'folder', data: { name: folder } })
          }
          return
        }
        const reserved = file.names.find(isSyncedNamespace)
        if (reserved !== undefined) {
          context.report({ loc: first, messageId: 'command', data: { name: reserved } })
        }
      },
      yaml(node) {
        const fm = file.kind === 'skill' ? readFrontmatter(context.sourceCode, node) : null
        const field = fm?.fields.get('name')
        const value = fm?.data.name
        if (fm && field && typeof value === 'string' && isSyncedNamespace(value)) {
          context.report({
            loc: fm.at(field.valueStart, field.valueEnd),
            messageId: 'name',
            data: { name: value },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/SKILL.md', '**/commands/**/*.md'],
  rule,
}

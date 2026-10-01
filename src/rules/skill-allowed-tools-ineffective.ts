// `disallowed-tools` cannot remove `EndConversation`, and `allowed-tools` does
// not auto-allow `AskUserQuestion` (docs/rules/skill-allowed-tools-ineffective.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-allowed-tools-ineffective' as const

/** Each field with the tools that it does not affect. */
const INEFFECTIVE: Record<string, string[]> = {
  'allowed-tools': ['AskUserQuestion'],
  'disallowed-tools': ['EndConversation'],
}

/** The tool names in a field value: a string or a list of strings. Entries
 *  split at spaces and commas outside parentheses, and a permission rule
 *  such as `Bash(git add *)` keeps its tool name only. */
function toolNames(value: unknown): string[] {
  const names: string[] = []
  for (const item of Array.isArray(value) ? value : [value]) {
    let depth = 0
    let entry = ''
    for (const char of typeof item === 'string' ? `${item} ` : '') {
      depth += char === '(' ? 1 : char === ')' ? -1 : 0
      if (depth <= 0 && /[\s,]/.test(char)) {
        names.push(entry.split('(')[0] as string)
        entry = ''
      } else {
        entry += char
      }
    }
  }
  return names
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'ineffective' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not list a tool in a field that does not affect it',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      ineffective: '`{{tool}}` in `{{field}}` has no effect.',
    },
  },
  create(context) {
    if (classifySkillFile(context.filename) === null) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null) {
          return
        }
        for (const [key, tools] of Object.entries(INEFFECTIVE)) {
          const field = fm.fields.get(key)
          if (field === undefined) {
            continue
          }
          const listed = toolNames(fm.data[key])
          for (const tool of tools.filter((t) => listed.includes(t))) {
            context.report({
              loc: fm.at(field.valueStart, field.valueEnd),
              messageId: 'ineffective',
              data: { tool, field: key },
            })
          }
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

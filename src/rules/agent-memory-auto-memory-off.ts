// The `memory` field of a subagent needs auto memory. When the settings turn
// auto memory off, the field has no effect
// (docs/rules/agent-memory-auto-memory-off.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { envOf, isOn, localAgentSettings } from '../agent-settings.ts'
import { MEMORY_SCOPES } from '../data/agent-fields.ts'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'agent-memory-auto-memory-off' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'off' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set `memory` in a local agent when the settings turn auto memory off',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      off: 'The settings turn auto memory off. `memory` has no effect, and the agent starts without memory.',
    },
  },
  create(context) {
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('memory')
        if (
          fm === null ||
          field === undefined ||
          !(MEMORY_SCOPES as readonly string[]).includes(fm.data.memory as string)
        ) {
          return
        }
        const settings = localAgentSettings(context.filename)
        if (settings === null || settings === UNREADABLE) {
          return
        }
        if (
          settings.autoMemoryEnabled === false ||
          isOn(envOf(settings).CLAUDE_CODE_DISABLE_AUTO_MEMORY)
        ) {
          context.report({ loc: fm.at(field.keyStart, field.valueEnd), messageId: 'off' })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/agents/**/*.md'],
  rule,
}

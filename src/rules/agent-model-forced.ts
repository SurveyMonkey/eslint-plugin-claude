// `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` makes each subagent use one model, so the
// `model` field of a local agent has no effect (docs/rules/agent-model-forced.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { envOf, isOn, localAgentSettings } from '../agent-settings.ts'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'agent-model-forced' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'forced' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set `model` in a local agent when the settings force one subagent model',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      forced:
        'The settings set `CLAUDE_CODE_SUBAGENT_MODEL_FORCE`. Claude Code ignores `model` and uses one model for each subagent.',
    },
  },
  create(context) {
    if (classifyAgentFile(context.filename)?.plugin !== false) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('model')
        if (fm === null || field === undefined || typeof fm.data.model !== 'string') {
          return
        }
        const settings = localAgentSettings(context.filename)
        if (
          settings === null ||
          settings === UNREADABLE ||
          !isOn(envOf(settings).CLAUDE_CODE_SUBAGENT_MODEL_FORCE)
        ) {
          return
        }
        context.report({ loc: fm.at(field.keyStart, field.valueEnd), messageId: 'forced' })
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

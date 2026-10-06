// The `agent` setting runs a subagent as the main thread. `omitClaudeMd` then
// leaves the CLAUDE.md files out of the main session
// (docs/rules/agent-omit-claude-md-main.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { localAgentSettings } from '../agent-settings.ts'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'agent-omit-claude-md-main' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'omitted' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Do not set `omitClaudeMd` in a local agent that the settings run as the main thread',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      omitted:
        'The `agent` setting runs this agent as the main thread, and `omitClaudeMd` leaves the CLAUDE.md files out of the session.',
    },
  },
  create(context) {
    if (classifyAgentFile(context.filename)?.plugin !== false) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('omitClaudeMd')
        if (fm === null || field === undefined || fm.data.omitClaudeMd !== true) {
          return
        }
        const agentName = fm.data.name
        const settings = localAgentSettings(context.filename)
        if (
          typeof agentName !== 'string' ||
          settings === null ||
          settings === UNREADABLE ||
          settings.agent !== agentName
        ) {
          return
        }
        context.report({ loc: fm.at(field.keyStart, field.valueEnd), messageId: 'omitted' })
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

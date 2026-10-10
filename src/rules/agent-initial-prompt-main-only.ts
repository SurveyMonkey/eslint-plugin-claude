// `initialPrompt` is submitted only when the agent runs as the main session agent, through
// `--agent` or the `agent` setting. In a subagent run it does nothing
// (docs/rules/agent-initial-prompt-main-only.md). Claude Code ignores the field in a plugin agent,
// and `agent-plugin-ignored-fields` reports that case.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { mainAgentNames } from '../agent-project.ts'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import { UNREADABLE } from '../skill-tree.ts'

const name = 'agent-initial-prompt-main-only' as const

type Options = [{ allow: string[] }]

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'ignored' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Set initialPrompt only in a local agent that the settings run as the main thread',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { allow: { type: 'array', items: { type: 'string' }, uniqueItems: true } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: [] }],
    messages: {
      ignored:
        'Claude Code submits `initialPrompt` only when this agent runs as the main session agent. No committed `agent` setting names `{{name}}`. The rule cannot see the `--agent` flag. Name the agent in the option `allow` if you start it with the flag.',
    },
  },
  create(context) {
    const scope = classifyAgentFile(context.filename)
    if (scope === null || scope.plugin) {
      return {}
    }
    const [{ allow }] = context.options
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('initialPrompt')
        const prompt = fm?.data.initialPrompt
        const agentName = fm?.data.name
        // A prompt with no text submits nothing. A name that is not a string, or is empty, is no
        // name to compare with the setting.
        if (
          fm === null ||
          field === undefined ||
          typeof prompt !== 'string' ||
          prompt.trim() === '' ||
          typeof agentName !== 'string' ||
          agentName === '' ||
          allow.includes(agentName)
        ) {
          return
        }
        const names = mainAgentNames(scope)
        if (names === UNREADABLE || names.includes(agentName)) {
          return
        }
        context.report({
          loc: fm.at(field.keyStart, field.valueEnd),
          messageId: 'ignored',
          data: { name: agentName },
        })
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/agents/**/*.md'], rule }

// The `agent` setting of a project or local settings file must name an agent that the repository
// can show (docs/rules/settings-agent-exists.md). A heuristic, and `off` in `recommended`. The
// built-in agents are in `src/data/agent-fields.ts`. The rule reads the `.claude/agents/` folders
// of the project. The option `allow` lists the user and plugin agents that a repository cannot
// show. The rule does not check a managed file. A managed file applies to every project on a
// machine, so the project agents that it names are not in the repository that holds it.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { BUILT_IN_AGENTS } from '../data/agent-fields.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { agentNames } from '../project-names.ts'

const name = 'settings-agent-exists' as const

type Options = [{ allow: string[] }]

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: 'unknown' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Name an agent that the repository defines or Claude Code ships in the agent setting',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: [] }],
    messages: {
      unknown:
        '"{{agent}}" is not a built-in agent, and no file in .claude/agents/ defines it. If the agent is a user or plugin agent, name it in the option "allow".',
    },
  },
  create(context) {
    const [{ allow }] = context.options
    return {
      Document(node) {
        const value = lastMember(node.body, 'agent')?.value
        if (value?.type !== 'String') {
          return
        }
        const agent = value.value
        // A name with a colon is a plugin agent. The docs do not say if Claude Code compares
        // names with case, so the rule does not.
        const same = (other: string) => other.toLowerCase() === agent.toLowerCase()
        if (agent === '' || agent.includes(':') || BUILT_IN_AGENTS.some(same) || allow.some(same)) {
          return
        }
        const found = agentNames(path.dirname(path.resolve(context.filename)))
        // A path that the rule cannot read can hold the agent. The rule cannot prove that the
        // agent is absent.
        if (!found.unseen && !found.names.some(same)) {
          context.report({ node: value, messageId: 'unknown', data: { agent } })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  rule,
}

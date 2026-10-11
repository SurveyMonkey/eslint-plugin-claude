// An `Agent(Name)` permission rule must name a subagent that exists
// (docs/rules/permissions-agent-rule-exists.md). A heuristic, and `off` in `recommended`. The
// built-in agents are in `src/data/agent-fields.ts`. The rule reads the `.claude/agents/` folders
// of the project and of each directory above it, up to the repository root, as
// `settings-agent-exists` does, and makes no report when it cannot see one of them. The option
// `allow` lists the user and plugin agents that a repository cannot show. A file with no
// `description` defines no agent, as Claude Code skips it. A managed file applies
// to every project on a machine, so the rule does not check it.

import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { BUILT_IN_AGENTS } from '../data/agent-fields.ts'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { agentNames } from '../project-names.ts'
import { kindOf } from '../settings-files.ts'

const name = 'permissions-agent-rule-exists' as const

type Options = [{ allow: string[] }]

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: 'unknown' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Name an agent that the repository defines or Claude Code ships in an Agent rule',
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
        'The rule names the agent "{{agent}}". It is not a built-in agent, and no file in .claude/agents/ defines it. If the agent is a user or plugin agent, name it in the option "allow".',
    },
  },
  create(context) {
    if (kindOf(context.filename) === 'managed') {
      return {}
    }
    const [{ allow }] = context.options
    return settingsListener(context, (entries) => {
      let found: ReturnType<typeof agentNames> | undefined
      for (const { loc, rule: parsed } of entries) {
        const agent = parsed.specifier?.trim() ?? ''
        // A name with a colon is a plugin agent, and a `param:value` specifier is a parameter
        // rule. A glob is not a name. The docs do not say if Claude Code compares names with
        // case, so the rule does not.
        if (parsed.tool !== 'Agent' || agent === '' || /[:*?[]/.test(agent)) {
          continue
        }
        const same = (other: string) => other.toLowerCase() === agent.toLowerCase()
        if (BUILT_IN_AGENTS.some(same) || allow.some(same)) {
          continue
        }
        found ??= agentNames(path.dirname(path.resolve(context.filename)), true)
        // A path that the rule cannot read can hold the agent.
        if (!found.unseen && !found.names.some(same)) {
          context.report({ loc, messageId: 'unknown', data: { agent } })
        }
      }
    })
  },
}

export default {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  rule,
}

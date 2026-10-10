// `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` is not on in the shared settings file
// (docs/rules/settings-env-subprocess-scrub.md). The variable strips credentials from the
// environment of subprocesses, such as Bash commands, hooks and stdio MCP servers. A heuristic,
// and `off` in `recommended`: a team can set the variable in a managed file or in a shell. The
// rule reads `.claude/settings.json` only, so the file without the variable is the file that
// reports.
import type { JSONRuleDefinition } from '@eslint/json'
import { isEnvOn } from '../data/settings-env.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'

const name = 'settings-env-subprocess-scrub' as const

const VARIABLE = 'CLAUDE_CODE_SUBPROCESS_ENV_SCRUB'

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'scrub' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Set CLAUDE_CODE_SUBPROCESS_ENV_SCRUB to 1 in the shared settings file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      scrub:
        '"CLAUDE_CODE_SUBPROCESS_ENV_SCRUB" is not on in the "env" of this file. Claude Code then keeps credentials from its environment in the subprocesses that it starts, such as Bash commands, hooks and stdio MCP servers.',
    },
  },
  create(context) {
    return {
      Document(node) {
        if (node.body.type !== 'Object') {
          return
        }
        const env = lastMember(node.body, 'env')?.value
        const value = env?.type === 'Object' ? lastMember(env, VARIABLE)?.value : undefined
        // A value that is not a string is for `settings-env-value-format`.
        if (value !== undefined && value.type !== 'String') {
          return
        }
        if (value === undefined || !isEnvOn(value.value)) {
          context.report({ node: value ?? node.body, messageId: 'scrub' })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude/settings.json'],
  rule,
}

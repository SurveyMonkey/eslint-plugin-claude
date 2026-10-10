// A credential variable in an inline `headersHelper` (docs/rules/mcp-headershelper-credential-env.md).
// A helper that a project `.mcp.json` or a plugin supplies runs without the credential variables
// of the user. Claude Code removes each variable with `TOKEN`, `SECRET`, `PASSWORD`, `KEY` or
// `AUTH` in its name, in either letter case. It keeps `GIT_CONFIG_KEY_<n>`. It also removes
// `ANTHROPIC_CUSTOM_HEADERS`. The rule finds `$NAME` and `${NAME}` in the command text. The words
// are in `src/data/mcp-credential-vars.ts`.
import type { JSONRuleDefinition } from '@eslint/json'
import {
  HELPER_CREDENTIAL_WORDS,
  HELPER_KEPT_VAR,
  HELPER_REMOVED_VARS,
} from '../data/mcp-credential-vars.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { mcpFileKind, serverMembers } from '../mcp-servers.ts'

const name = 'mcp-headershelper-credential-env' as const

/** `$NAME` or `${NAME`. The match skips `$(command)` and `$1`. */
const SHELL_VARIABLE = /\$\{?([A-Za-z_][A-Za-z0-9_]*)/g

/** True when Claude Code removes the variable `variable` from the environment of the helper. */
function isRemoved(variable: string): boolean {
  if (HELPER_REMOVED_VARS.includes(variable)) {
    return true
  }
  const upper = variable.toUpperCase()
  return (
    !HELPER_KEPT_VAR.test(variable) && HELPER_CREDENTIAL_WORDS.some((word) => upper.includes(word))
  )
}

const rule: JSONRuleDefinition<{ MessageIds: 'removed' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not read a credential variable in an inline MCP headersHelper',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      removed:
        'The `headersHelper` of the server "{{server}}" reads `{{variable}}`. Claude Code removes this variable from the helper environment. Read the credential from a file or a credential store.',
    },
  },
  create(context) {
    const kind = mcpFileKind(context.filename)
    if (kind === null) {
      return {}
    }
    return {
      Document(node) {
        for (const member of serverMembers(node.body, kind)) {
          const helper = lastMember(member.value, 'headersHelper')?.value
          if (helper?.type !== 'String') {
            continue
          }
          const variables = new Set(
            Array.from(helper.value.matchAll(SHELL_VARIABLE), (match) => String(match[1])).filter(
              isRemoved,
            ),
          )
          for (const variable of variables) {
            context.report({
              node: helper,
              messageId: 'removed',
              data: { server: keyOf(member.name), variable },
            })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.mcp.json'],
  rule,
}

// `MCP_CLIENT_SECRET` in the `env` block of the committed project settings file
// (docs/rules/mcp-env-client-secret.md). The variable holds the OAuth client secret of an MCP
// server that needs pre-configured credentials. The file is in the repository, so the secret
// is too. The local file is not committed and a managed file is not a project file, so the rule
// reads `.claude/settings.json` only. A message never holds the value.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { kindOf } from '../settings-files.ts'

const name = 'mcp-env-client-secret' as const

const VARIABLE = 'MCP_CLIENT_SECRET'

const rule: JSONRuleDefinition<{ MessageIds: 'secret' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set MCP_CLIENT_SECRET in the env block of a committed settings file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      secret:
        'The "env" block of a committed settings file sets "MCP_CLIENT_SECRET", the OAuth client secret of an MCP server. The repository then holds the secret. Remove it, and set the variable in the shell of the person who adds the server.',
    },
  },
  create(context) {
    if (kindOf(context.filename) !== 'project') {
      return {}
    }
    return {
      Document(node) {
        const env = lastMember(node.body, 'env')?.value
        const member = lastMember(env, VARIABLE)
        // An empty value cancels a value from the shell. It holds no secret.
        if (member?.value.type === 'String' && member.value.value.trim() !== '') {
          context.report({ node: member.name, messageId: 'secret' })
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

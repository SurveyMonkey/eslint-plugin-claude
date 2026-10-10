// `${VAR}` with no `:-default` in a server entry (docs/rules/mcp-env-var-default.md). When the
// variable is unset, the config still loads. Claude Code warns in `claude mcp list`, and uses
// the text `${VAR}` as written. The form is valid when the variable is set, so the rule is a
// heuristic and its message names the risk. The rule skips the variables that Claude Code sets in
// a plugin, `${user_config.KEY}`, a reference inside a default, and a credential variable in the
// `url` or `headers` of a remote server (`mcp-credential-var-remote`), where a default does not
// help. `mcp-env-var-syntax` owns the malformed forms. A field that Claude Code does not expand
// is `mcp-env-expansion-field`.
import type { JSONRuleDefinition } from '@eslint/json'
import { REMOTE_EMPTY_CREDENTIAL_VARS } from '../data/mcp-credential-vars.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { expandedStrings, lintedServers, REMOTE_SERVER_TYPES } from '../mcp-servers.ts'

const name = 'mcp-env-var-default' as const

/** The variables that Claude Code substitutes in a plugin configuration, or sets itself.
 *  (https://code.claude.com/docs/en/mcp#plugin-provided-mcp-servers) */
const SET_BY_CLAUDE_CODE: readonly string[] = [
  'CLAUDE_PLUGIN_ROOT',
  'CLAUDE_PLUGIN_DATA',
  'CLAUDE_PROJECT_DIR',
]

// A reference with a default. The rule removes it first, so that a reference inside the default is
// not read.
const WITH_DEFAULT = /\$\{[A-Za-z_][A-Za-z0-9_]*:-[^}]*\}?/g
const BARE_REFERENCE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g

const rule: JSONRuleDefinition<{ MessageIds: 'noDefault' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Give an MCP variable reference a default, in case the variable is unset',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      noDefault: `The \`{{field}}\` of the server "{{server}}" uses \`{{reference}}\` with no default. When the variable is unset, Claude Code keeps the text as written and warns in \`claude mcp list\`. Set the variable in the environment of each person who uses the server, or write a default such as \`{{example}}\`.`,
    },
  },
  create(context) {
    return {
      Document(node) {
        for (const server of lintedServers(context.filename, node.body)) {
          const type = lastMember(server.member.value, 'type')?.value
          const remote = type?.type === 'String' && REMOTE_SERVER_TYPES.includes(type.value)
          for (const { node: text, field } of expandedStrings(server.member.value)) {
            const covered = remote && (field === 'url' || field === 'headers')
            const variables = new Set(
              Array.from(
                text.value.replaceAll(WITH_DEFAULT, '').matchAll(BARE_REFERENCE),
                (match) => String(match[1]),
              ).filter(
                (variable) =>
                  !SET_BY_CLAUDE_CODE.includes(variable) &&
                  !(covered && REMOTE_EMPTY_CREDENTIAL_VARS.includes(variable)),
              ),
            )
            for (const variable of variables) {
              context.report({
                node: server.pinned ?? text,
                messageId: 'noDefault',
                data: {
                  field,
                  server: server.name,
                  reference: `\${${variable}}`,
                  example: `\${${variable}:-value}`,
                },
              })
            }
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.mcp.json', '**/.claude-plugin/plugin.json'],
  rule,
}

// A `serverName` entry of a policy list (docs/rules/mcp-policy-servername-weak.md). The name is
// the label that a user gives a server, so a name does not control which server runs. In an
// allowlist, Claude Code also admits a remote (stdio) server by name only when the allowlist has
// no `serverUrl` (`serverCommand`) entry. The managed settings page combines the lists of the
// managed files, so the rule counts the entries of the sibling files too. An allowlist with both
// kinds is the case of `mcp-allowlist-servername-dead`, which reports each name there. An entry
// that `mcp-policy-entry-schema` reports is not valid, so the rule skips it.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { plainOf, policyKey } from '../mcp-servers.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES, readSiblingSettings } from '../settings-files.ts'

const name = 'mcp-policy-servername-weak' as const

type MessageId = 'allow' | 'allowNoStdio' | 'allowNoRemote' | 'deny'

/** The kinds of the valid allowlist entries in `entries`: `url` and `command`. */
const kindsOf = (entries: unknown[]) =>
  entries.flatMap((entry) => {
    const key = policyKey(entry)
    return key?.startsWith('url:') ? ['url'] : key?.startsWith('command:') ? ['command'] : []
  })

/** The name of the valid `serverName` entry `entry` of `list`, or undefined for any other entry. */
const nameOf = (entry: unknown, list: 'allowedMcpServers' | 'deniedMcpServers') => {
  const key = policyKey(entry, list)
  return key?.startsWith('name:') ? key.slice('name:'.length) : undefined
}

const rule: JSONRuleDefinition<{ MessageIds: MessageId }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not rely on a serverName entry in an MCP policy list',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      allow:
        'The serverName entry "{{server}}" admits any server that a user calls "{{server}}". A name is a label, not a security control. Use a serverUrl or serverCommand entry.',
      allowNoStdio:
        'The serverName entry "{{server}}" admits a remote server that a user calls "{{server}}". It does not admit a stdio server, because the allowlist has serverCommand entries. A name is a label, not a security control. Use a serverUrl entry.',
      allowNoRemote:
        'The serverName entry "{{server}}" admits a stdio server that a user calls "{{server}}". It does not admit a remote server, because the allowlist has serverUrl entries. A name is a label, not a security control. Use a serverCommand entry.',
      deny: 'The serverName entry "{{server}}" blocks only a server that carries this label. A user can call a server by another name. A name is a label, not a security control. Use a serverUrl or serverCommand entry.',
    },
  },
  create(context) {
    // Claude Code ignores a hidden file in `managed-settings.d`.
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const allow = lastMember(node.body, 'allowedMcpServers')?.value
        if (allow?.type === 'Array') {
          const entries = allow.elements.map(({ value }) => ({
            node: value,
            plain: plainOf(value),
          }))
          const names = entries.flatMap(({ node: entry, plain }) => {
            const server = nameOf(plain, 'allowedMcpServers')
            return server === undefined ? [] : [{ node: entry, server }]
          })
          if (names.length > 0) {
            const kinds = new Set(kindsOf(entries.map(({ plain }) => plain)))
            for (const sibling of readSiblingSettings(context.filename)) {
              const other = sibling.allowedMcpServers
              for (const kind of kindsOf(Array.isArray(other) ? other : [])) {
                kinds.add(kind)
              }
            }
            // The allowlist with both kinds is the case of `mcp-allowlist-servername-dead`.
            if (!(kinds.has('url') && kinds.has('command'))) {
              let messageId: MessageId = 'allow'
              if (kinds.has('command')) {
                messageId = 'allowNoStdio'
              } else if (kinds.has('url')) {
                messageId = 'allowNoRemote'
              }
              for (const { node: entry, server } of names) {
                context.report({ node: entry, messageId, data: { server } })
              }
            }
          }
        }
        const deny = lastMember(node.body, 'deniedMcpServers')?.value
        if (deny?.type === 'Array') {
          for (const { value } of deny.elements) {
            const server = nameOf(plainOf(value), 'deniedMcpServers')
            if (server !== undefined) {
              context.report({ node: value, messageId: 'deny', data: { server } })
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
  files: MANAGED_SETTINGS_FILES,
  rule,
}

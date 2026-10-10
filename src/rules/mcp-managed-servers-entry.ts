// An entry of `managedMcpServers` that Claude Code drops (docs/rules/mcp-managed-servers-entry.md).
// The key is an object keyed by server name, and only managed settings read it. Claude Code
// loads an entry only when it passes every check. It drops an entry that fails, with a notice in
// `/status`, and loads the others. The key as an array is the Claude Desktop form, which Claude
// Code does not accept. The checks follow the managed MCP page: the name, `type`, `https://`
// `url`, the four members that name a program or a command, `${VAR}` references, and control or
// invisible characters. A policy key such as `allowedMcpServers` is in `mcp-policy-entry-schema`.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ValueNode } from '../marketplace-json.ts'
import { lastMembers, MANAGED_SERVER_TYPES, SERVER_NAME_PATTERN } from '../mcp-servers.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'mcp-managed-servers-entry' as const

type MessageId =
  | 'notObject'
  | 'name'
  | 'entryNotObject'
  | 'type'
  | 'url'
  | 'forbidden'
  | 'variable'
  | 'invisible'

/** The members that name a program to run. A managed settings document never names one. */
const FORBIDDEN_MEMBERS = ['command', 'args', 'env', 'headersHelper']

const HTTPS_URL = /^https:\/\//i

/** A `${VAR}` reference. Claude Code does not expand it in these entries. */
const VARIABLE_REFERENCE = /\$\{[^}]*\}/

/** A control character, or an invisible character of the Unicode format class. */
const INVISIBLE = /[\p{Cc}\p{Cf}]/u

const rule: JSONRuleDefinition<{ MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write each managedMcpServers entry so that Claude Code loads it',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notObject:
        '"managedMcpServers" is an object keyed by server name. Claude Code does not accept an array or another value, and loads no server from it.',
      name: 'The server name "{{server}}" holds a character other than letters, numbers, hyphens and underscores. Claude Code drops the entry.',
      entryNotObject:
        'The entry "{{server}}" is an object with the members of an http or sse server. Claude Code drops it.',
      type: 'The entry "{{server}}" needs "type" set to http, streamable-http or sse. Claude Code drops the entry.',
      url: 'The entry "{{server}}" needs a "url" that starts with https://. Claude Code refuses a plain http:// URL, also for localhost, and drops the entry.',
      forbidden:
        'The entry "{{server}}" has the member "{{key}}". A managed settings document never names a program to run, so Claude Code drops the entry.',
      variable: `The entry "{{server}}" has a \${VAR} reference. Claude Code does not expand variables in these entries, so write literal values. It drops the entry.`,
      invisible:
        'The entry "{{server}}" has a control or invisible character in a key or value. Claude Code drops the entry.',
    },
  },
  create(context) {
    // Claude Code ignores a hidden file in `managed-settings.d`.
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const servers = lastMember(node.body, 'managedMcpServers')?.value
        if (servers === undefined) {
          return
        }
        if (servers.type !== 'Object') {
          context.report({ node: servers, messageId: 'notObject' })
          return
        }
        for (const member of lastMembers(servers.members)) {
          const server = keyOf(member.name)
          const entry = member.value
          if (!SERVER_NAME_PATTERN.test(server)) {
            context.report({ node: member.name, messageId: 'name', data: { server } })
          }
          if (entry.type !== 'Object') {
            context.report({ node: entry, messageId: 'entryNotObject', data: { server } })
            continue
          }
          const type = lastMember(entry, 'type')?.value
          if (type?.type !== 'String' || !MANAGED_SERVER_TYPES.includes(type.value)) {
            context.report({ node: type ?? entry, messageId: 'type', data: { server } })
          }
          const url = lastMember(entry, 'url')?.value
          if (url?.type !== 'String' || !HTTPS_URL.test(url.value)) {
            context.report({ node: url ?? entry, messageId: 'url', data: { server } })
          }
          for (const key of lastMembers(entry.members)) {
            if (FORBIDDEN_MEMBERS.includes(keyOf(key.name))) {
              context.report({
                node: key.name,
                messageId: 'forbidden',
                data: { server, key: keyOf(key.name) },
              })
            }
          }

          /** Report each variable reference and each invisible character under `value`. */
          const walk = (value: ValueNode): void => {
            if (value.type === 'String') {
              if (VARIABLE_REFERENCE.test(value.value)) {
                context.report({ node: value, messageId: 'variable', data: { server } })
              }
              if (INVISIBLE.test(value.value)) {
                context.report({ node: value, messageId: 'invisible', data: { server } })
              }
            } else if (value.type === 'Array') {
              for (const element of value.elements) {
                walk(element.value)
              }
            } else if (value.type === 'Object') {
              for (const inner of lastMembers(value.members)) {
                if (INVISIBLE.test(keyOf(inner.name))) {
                  context.report({ node: inner.name, messageId: 'invisible', data: { server } })
                }
                walk(inner.value)
              }
            }
          }
          walk(entry)
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

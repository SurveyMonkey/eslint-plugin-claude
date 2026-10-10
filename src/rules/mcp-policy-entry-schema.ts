// An entry of `allowedMcpServers` or `deniedMcpServers` that breaks the entry schema
// (docs/rules/mcp-policy-entry-schema.md). An entry has exactly one key: `serverName`,
// `serverCommand` or `serverUrl`. In managed settings, Claude Code strips an invalid entry and
// enforces the rest. In an allowlist, `serverName` holds letters, numbers, hyphens and
// underscores. In a denylist, it is not empty and has no leading or trailing whitespace. A `*` in
// a `serverName` is a literal character, so the rule makes no report on it.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ValueNode } from '../marketplace-json.ts'
import { lastMembers } from '../mcp-servers.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'mcp-policy-entry-schema' as const

type MessageId = 'notObject' | 'keyCount' | 'unknownKey' | 'valueType' | 'allowName' | 'denyName'

const LISTS = ['allowedMcpServers', 'deniedMcpServers'] as const

const ALLOW_NAME = /^[A-Za-z0-9_-]+$/

/** The entry keys, each with the check of its value type. */
const KEY_TYPES: ReadonlyMap<string, { expected: string; ok: (value: ValueNode) => boolean }> =
  new Map([
    ['serverName', { expected: 'a string', ok: (value) => value.type === 'String' }],
    [
      'serverCommand',
      {
        expected: 'an array of strings',
        ok: (value) =>
          value.type === 'Array' &&
          value.elements.every(({ value: item }) => item.type === 'String'),
      },
    ],
    ['serverUrl', { expected: 'a string', ok: (value) => value.type === 'String' }],
  ])

const rule: JSONRuleDefinition<{ MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Write each allowedMcpServers and deniedMcpServers entry with exactly one valid key',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notObject:
        'An entry of "{{list}}" is an object with one key: serverName, serverCommand or serverUrl.',
      keyCount:
        'An entry of "{{list}}" has {{count}} keys. It needs exactly one of serverName, serverCommand and serverUrl.',
      unknownKey:
        'The key "{{key}}" is not valid in an entry of "{{list}}". Use serverName, serverCommand or serverUrl.',
      valueType: 'The value of "{{key}}" in an entry of "{{list}}" must be {{expected}}.',
      allowName:
        'A serverName in "allowedMcpServers" holds letters, numbers, hyphens and underscores only. "{{value}}" does not match.',
      denyName:
        'A serverName in "deniedMcpServers" is not empty and has no leading or trailing whitespace.',
    },
  },
  create(context) {
    // Claude Code ignores a hidden file in `managed-settings.d`.
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        for (const list of LISTS) {
          const entries = lastMember(node.body, list)?.value
          if (entries?.type !== 'Array') {
            continue
          }
          for (const { value: entry } of entries.elements) {
            if (entry.type !== 'Object') {
              context.report({ node: entry, messageId: 'notObject', data: { list } })
              continue
            }
            // Two keys of one name: the last counts, as in `JSON.parse`.
            const members = lastMembers(entry.members)
            const [only, ...others] = members
            if (only === undefined || others.length > 0) {
              context.report({
                node: entry,
                messageId: 'keyCount',
                data: { list, count: String(members.length) },
              })
              continue
            }
            const key = keyOf(only.name)
            const type = KEY_TYPES.get(key)
            if (type === undefined) {
              context.report({ node: only.name, messageId: 'unknownKey', data: { list, key } })
            } else if (!type.ok(only.value)) {
              context.report({
                node: only.value,
                messageId: 'valueType',
                data: { list, key, expected: type.expected },
              })
            } else if (key === 'serverName' && only.value.type === 'String') {
              const value = only.value.value
              if (list === 'allowedMcpServers' && !ALLOW_NAME.test(value)) {
                context.report({ node: only.value, messageId: 'allowName', data: { value } })
              } else if (list === 'deniedMcpServers' && (value === '' || value !== value.trim())) {
                context.report({ node: only.value, messageId: 'denyName' })
              }
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
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}

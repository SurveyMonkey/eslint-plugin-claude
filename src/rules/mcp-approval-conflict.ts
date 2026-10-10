// A name in both `enabledMcpjsonServers` and `disabledMcpjsonServers`
// (docs/rules/mcp-approval-conflict.md). A `disabledMcpjsonServers` entry in any settings file
// still rejects the server, so the enable has no effect. The lists of the settings files of one
// place add up: the two project files of a `.claude/` folder, or the files of one managed source.
// The rule reports at the enabled entry of the linted file, so a pair gets one report. A file
// that the rule cannot read adds no entry, so a conflict that the readable files show stays
// (ADR 001, Decision 14).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES, readSiblingSettings } from '../settings-files.ts'

const name = 'mcp-approval-conflict' as const

type StringNode = Extract<ValueNode, { type: 'String' }>

/** The string items of the array `value`. Another value gives no item. */
const stringItems = (value: ValueNode | undefined): StringNode[] =>
  value?.type === 'Array'
    ? value.elements.flatMap(({ value: item }) => (item.type === 'String' ? [item] : []))
    : []

const rule: JSONRuleDefinition<{ MessageIds: 'conflict' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not list a server in both enabledMcpjsonServers and disabledMcpjsonServers',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      conflict:
        'The server "{{server}}" is in "enabledMcpjsonServers" and in "disabledMcpjsonServers". A "disabledMcpjsonServers" entry in any settings file rejects the server, so this enable has no effect. Remove the name from one list.',
    },
  },
  create(context) {
    // Claude Code ignores a hidden file in `managed-settings.d`.
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const enabled = stringItems(lastMember(node.body, 'enabledMcpjsonServers')?.value)
        if (enabled.length === 0) {
          return
        }
        const disabled = new Set(
          stringItems(lastMember(node.body, 'disabledMcpjsonServers')?.value).map((s) => s.value),
        )
        for (const sibling of readSiblingSettings(context.filename)) {
          const other = sibling.disabledMcpjsonServers
          for (const server of Array.isArray(other) ? other : []) {
            disabled.add(server)
          }
        }
        for (const item of enabled) {
          if (disabled.has(item.value)) {
            context.report({ node: item, messageId: 'conflict', data: { server: item.value } })
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

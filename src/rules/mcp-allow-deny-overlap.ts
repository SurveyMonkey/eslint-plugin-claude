// An entry in both `allowedMcpServers` and `deniedMcpServers`
// (docs/rules/mcp-allow-deny-overlap.md). The denylist takes precedence, so a server on both lists
// is blocked and the allow entry has no effect. Entries from every file merge into one list. The
// rule sums the lists of the settings files of one place: the two project files of a `.claude/`
// folder, or the files of one managed source. It reports at the allow entry of the linted file.
// A file that the rule cannot read adds no entry, so an overlap that the readable files show
// stays (ADR 001, Decision 14). An entry that Claude Code strips is not an entry
// (`mcp-policy-entry-schema` reports it).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type ValueNode } from '../marketplace-json.ts'
import { plainOf, policyKey } from '../mcp-servers.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES, readSiblingSettings } from '../settings-files.ts'

const name = 'mcp-allow-deny-overlap' as const

/** The items of the array `value`. Another value gives no item. */
const itemsOf = (value: ValueNode | undefined): ValueNode[] =>
  value?.type === 'Array' ? value.elements.map((element) => element.value) : []

const rule: JSONRuleDefinition<{ MessageIds: 'overlap' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not list one entry in both allowedMcpServers and deniedMcpServers',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      overlap:
        'The entry {{entry}} is in "allowedMcpServers" and in "deniedMcpServers". The denylist takes precedence, so Claude Code blocks the server and this allow entry has no effect. Remove the entry from one list.',
    },
  },
  create(context) {
    // Claude Code ignores a hidden file in `managed-settings.d`.
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const allowed = itemsOf(lastMember(node.body, 'allowedMcpServers')?.value).flatMap(
          (item) => {
            const key = policyKey(plainOf(item))
            return key === undefined ? [] : [{ item, key }]
          },
        )
        if (allowed.length === 0) {
          return
        }
        const denied = new Set(
          itemsOf(lastMember(node.body, 'deniedMcpServers')?.value).map((item) =>
            policyKey(plainOf(item)),
          ),
        )
        for (const sibling of readSiblingSettings(context.filename)) {
          const other = sibling.deniedMcpServers
          for (const entry of Array.isArray(other) ? other : []) {
            denied.add(policyKey(entry))
          }
        }
        for (const { item, key } of allowed) {
          if (denied.has(key)) {
            context.report({
              node: item,
              messageId: 'overlap',
              data: { entry: JSON.stringify(plainOf(item)) },
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
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}

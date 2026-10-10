// Some fields and source types of a marketplace need a Claude Code version.
// With the option `minVersion`, the rule reports each one that a newer version
// than `minVersion` introduced. With no option, the rule makes no report
// (docs/rules/marketplace-min-version.md). The versions are from the
// marketplace reference ("Top-level fields", "Plugin entries" and "Plugin
// sources"), read on 2026-10-10 for Claude Code 2.1.288. Review them on or
// before 2027-04-10, the `stale_after` date of the rule doc.
import type { JSONRuleDefinition } from '@eslint/json'
import { PLUGIN_SOURCE_TYPES } from '../data/marketplace-source-types.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type MemberNode, pluginEntries, type ValueNode } from '../marketplace-json.ts'

const name = 'marketplace-min-version' as const

type Options = [{ minVersion?: string }]

// The first version of each entry field.
const ENTRY_FIELDS = [
  ['metadata', '2.1.222'],
  ['headers', '2.1.238'],
  ['headersHelper', '2.1.238'],
] as const

// The first version of `metadata.pluginRoot`.
const PLUGIN_ROOT_SINCE = '2.1.239'

// The first version of each source type that is newer than the first plugin sources.
const SOURCE_TYPES: ReadonlyMap<string, string> = new Map([
  [PLUGIN_SOURCE_TYPES.archive, '2.1.224'],
  [PLUGIN_SOURCE_TYPES.command, '2.1.229'],
])

/** True when version `a` is older than version `b`. Both are `major.minor.patch`.
 *  The comparison is numeric: `2.1.99` is older than `2.1.222`. */
function older(a: string, b: string): boolean {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  const index = left.findIndex((part, i) => part !== right[i])
  return index !== -1 && (left[index] as number) < (right[index] as number)
}

const rule: JSONRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'tooNew'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use no marketplace field that is newer than the configured Claude Code version',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { minVersion: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{}],
    messages: {
      tooNew:
        'The {{feature}} needs Claude Code {{since}} or later. The configured "minVersion" is {{minVersion}}.',
    },
  },
  create(context) {
    const [{ minVersion }] = context.options
    // With no `minVersion`, the rule is off.
    if (minVersion === undefined) {
      return {}
    }
    const check = (node: MemberNode | ValueNode, feature: string, since: string) => {
      if (older(minVersion, since)) {
        context.report({ node, messageId: 'tooNew', data: { feature, since, minVersion } })
      }
    }
    return {
      Document(node) {
        const pluginRoot = lastMember(lastMember(node.body, 'metadata')?.value, 'pluginRoot')
        if (pluginRoot !== undefined) {
          check(pluginRoot, '"metadata.pluginRoot" field', PLUGIN_ROOT_SINCE)
        }
        for (const entry of pluginEntries(node)) {
          for (const [field, since] of ENTRY_FIELDS) {
            const member = lastMember(entry, field)
            if (member !== undefined) {
              check(member, `entry field "${field}"`, since)
            }
          }
          // A `source` that is not an object with a string `source` is for `marketplace-schema`
          // and `marketplace-source-schema`.
          const type = lastMember(lastMember(entry, 'source')?.value, 'source')?.value
          if (type?.type === 'String') {
            const since = SOURCE_TYPES.get(type.value)
            if (since !== undefined) {
              check(type, `"${type.value}" source`, since)
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
  files: ['**/.claude-plugin/marketplace.json'],
  rule,
}

// An entry in `marketplace.json` and the `plugin.json` of its relative source
// must not both declare hooks for the same event. The matchers of the entry
// replace the matchers of `plugin.json` for that event
// (docs/rules/marketplace-entry-hooks-override.md). The rule reads
// `plugin.json` through `sourceReader`, and makes no report when it cannot
// read it.
import type { JSONRuleDefinition } from '@eslint/json'
import { HOOK_EVENTS } from '../data/hook-events.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember, pluginEntries } from '../marketplace-json.ts'
import { sourceReader } from '../marketplace-source.ts'

const name = 'marketplace-entry-hooks-override' as const

/** The event names that the inline hooks objects of a `plugin.json` `hooks`
 *  value declare. The value is an object, or an array that can mix paths and
 *  objects. A path is a file that the rule does not read, so it adds no
 *  event. An inline object is the event map itself, with no wrapper
 *  (manifest reference, "hooks"). */
function declaredEvents(hooks: unknown): Set<string> {
  const values = Array.isArray(hooks) ? hooks : [hooks]
  return new Set(
    values.flatMap((value) =>
      value !== null && typeof value === 'object' && !Array.isArray(value)
        ? Object.keys(value)
        : [],
    ),
  )
}

const rule: JSONRuleDefinition<{ MessageIds: 'override' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Declare the hooks of an event in the marketplace entry or in plugin.json, not in both',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      override:
        'The entry and plugin.json both set hooks for "{{event}}". The matchers of the entry replace the matchers of plugin.json for this event. Declare the matchers for "{{event}}" in one place.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const read = sourceReader(context.filename, node)
        for (const entry of pluginEntries(node)) {
          // With `strict` set to false, the entry is a conflict (`marketplace-strict-false-conflict`).
          // A `strict` that is not a boolean is for `marketplace-schema`.
          const strict = lastMember(entry, 'strict')?.value
          if (strict !== undefined && !(strict.type === 'Boolean' && strict.value)) {
            continue
          }
          // The entry reads hooks as an inline object only. A path or an array is for
          // `marketplace-entry-hooks-inline`, and a value of another type is for `marketplace-schema`.
          const hooks = lastMember(entry, 'hooks')?.value
          if (hooks?.type !== 'Object') {
            continue
          }
          const members = HOOK_EVENTS.flatMap((event) => {
            const member = lastMember(hooks, event)
            return member === undefined ? [] : [{ event, member }]
          })
          // The read comes after the key tests, so an entry with no event costs no read.
          const source = members.length > 0 ? read(entry) : undefined
          if (source?.kind === 'manifest') {
            const declared = declaredEvents(source.manifest.hooks)
            for (const { event, member } of members) {
              if (declared.has(event)) {
                context.report({ node: member, messageId: 'override', data: { event } })
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
  files: ['**/.claude-plugin/marketplace.json'],
  rule,
}

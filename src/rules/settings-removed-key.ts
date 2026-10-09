// A settings key that Claude Code reads and does not act on
// (docs/rules/settings-removed-key.md). The keys are in `src/data/settings-keys.ts`.
// The rule reports `permissionExplainerEnabled` and `teammateDefaultModel`, which are
// also Global config keys. `settings-key-scope` makes no report on them, so one fault
// gets one report.
import type { JSONRuleDefinition } from '@eslint/json'
import { IGNORED_FALSE_KEYS, NO_EFFECT_KEYS, SUPERSEDED_KEYS } from '../data/settings-keys.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ObjectNode, type ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-removed-key' as const

/** True when `path` leads from `object` to a value that is not `null`. */
function isSet(object: ObjectNode, path: readonly string[]): boolean {
  let current: ValueNode | undefined = object
  for (const step of path) {
    current = current?.type === 'Object' ? lastMember(current, step)?.value : undefined
  }
  return current !== undefined && current.type !== 'Null'
}

const rule: JSONRuleDefinition<{
  RuleOptions: []
  MessageIds: 'noEffect' | 'falseIgnored' | 'superseded'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set a settings key that has no effect',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      noEffect: 'Claude Code ignores "{{key}}" since v{{since}}. The key has no effect.',
      falseIgnored: 'Claude Code ignores "{{key}}": false. Remove the key to leave the tool on.',
      superseded: 'Claude Code ignores "{{key}}" when "{{by}}" is set. Remove "{{key}}".',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        if (node.body.type !== 'Object') {
          return
        }
        const body = node.body
        for (const member of body.members) {
          const key = keyOf(member.name)
          // Two keys of one name: the last counts, as in `JSON.parse`.
          if (lastMember(body, key) !== member) {
            continue
          }
          // A key such as `constructor` is a property of every object, not a listed key.
          const since = Object.hasOwn(NO_EFFECT_KEYS, key) ? NO_EFFECT_KEYS[key] : undefined
          const replacements = Object.hasOwn(SUPERSEDED_KEYS, key)
            ? SUPERSEDED_KEYS[key]
            : undefined
          if (since !== undefined) {
            context.report({ node: member.name, messageId: 'noEffect', data: { key, since } })
          } else if (
            IGNORED_FALSE_KEYS.includes(key) &&
            member.value.type === 'Boolean' &&
            !member.value.value
          ) {
            context.report({ node: member.value, messageId: 'falseIgnored', data: { key } })
          } else {
            const by = replacements?.find((path) => isSet(body, path))
            if (by !== undefined) {
              context.report({
                node: member.name,
                messageId: 'superseded',
                data: { key, by: by.join('.') },
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
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}

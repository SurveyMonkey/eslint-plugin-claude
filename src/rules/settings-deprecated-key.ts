// A deprecated settings key that Claude Code still honors
// (docs/rules/settings-deprecated-key.md). The keys and their replacements are in
// `src/data/settings-keys.ts`. The rule makes no report on what `settings-removed-key` reports:
// a key that its replacement overrides, and `disableArtifact: false`. `ignorePatterns` is for
// `permissions-ignore-patterns`.
import type { JSONRuleDefinition } from '@eslint/json'
import { DEPRECATED_KEYS, IGNORED_FALSE_KEYS, SUPERSEDED_KEYS } from '../data/settings-keys.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type ObjectNode, type ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-deprecated-key' as const

/** True when `path` leads from `object` to a value that is not `null`. */
function isSet(object: ObjectNode, path: readonly string[]): boolean {
  let current: ValueNode | undefined = object
  for (const step of path) {
    current = lastMember(current, step)?.value
  }
  return current !== undefined && current.type !== 'Null'
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'deprecated' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not set a deprecated settings key',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      deprecated: 'Claude Code still honors "{{key}}", but the key is deprecated. Use {{use}}.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const body = node.body
        if (body.type !== 'Object') {
          return
        }
        for (const [key, use] of Object.entries(DEPRECATED_KEYS)) {
          const member = lastMember(body, key)
          if (member === undefined || member.value.type === 'Null') {
            continue
          }
          // Claude Code honors only `true` for a key in `IGNORED_FALSE_KEYS`. For any other key,
          // it ignores the key once a replacement key is set. `settings-removed-key` reports both.
          const honored = IGNORED_FALSE_KEYS.includes(key)
            ? member.value.type === 'Boolean' && member.value.value
            : !(SUPERSEDED_KEYS[key] as readonly (readonly string[])[]).some((path) =>
                isSet(body, path),
              )
          if (honored) {
            context.report({ node: member.name, messageId: 'deprecated', data: { key, use } })
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

// A `hostPattern` or `pathPattern` entry of `strictKnownMarketplaces` should be anchored
// (docs/rules/settings-known-marketplaces-pattern-anchored.md). The docs say that a pattern
// "matches anywhere" in the host or the path. So an unanchored pattern widens the allowlist. The
// rule reads managed settings files. It leaves the blocklist: an unanchored pattern there blocks
// more, and does not widen what users may add. A top-level alternation is split, and each branch
// needs its anchors. A pattern that does not compile is for
// `settings-known-marketplaces-policy-schema`.
import type { JSONRuleDefinition } from '@eslint/json'
import { UNLOADED_MARKETPLACE_SOURCE_TYPES } from '../data/marketplace-source-types.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { marketplaceMember } from '../marketplace-settings.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'settings-known-marketplaces-pattern-anchored' as const

const { hostPattern: HOST, pathPattern: PATH } = UNLOADED_MARKETPLACE_SOURCE_TYPES

/** The pattern that the docs show as an allow-all for local paths
 *  (plugins/org, "Allowlist with `strictKnownMarketplaces`"). */
const ALLOW_ALL_PATHS = '.*'

/** True when `text` ends in `$` that is not escaped: an even number of backslashes comes before it. */
const endsAnchored = (text: string) => /(?<!\\)(?:\\\\)*\$$/.test(text)

/** The branches of `pattern` at the top level: the text between the `|` that sit outside any
 *  group `(...)`, any class `[...]`, and any escape. */
function branchesOf(pattern: string): string[] {
  const branches: string[] = []
  let start = 0
  let depth = 0
  let inClass = false
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i]
    if (char === '\\') {
      i++
    } else if (inClass) {
      inClass = char !== ']'
    } else if (char === '[') {
      inClass = true
    } else if (char === '(') {
      depth++
    } else if (char === ')') {
      depth--
    } else if (char === '|' && depth === 0) {
      branches.push(pattern.slice(start, i))
      start = i + 1
    }
  }
  return [...branches, pattern.slice(start)]
}

/** True when `text` compiles as a JavaScript regular expression. */
function compiles(text: string): boolean {
  try {
    new RegExp(text)
    return true
  } catch {
    return false
  }
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'unanchored' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Anchor the hostPattern and pathPattern entries of strictKnownMarketplaces',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unanchored:
        'The "{{type}}" pattern "{{value}}" must {{need}}. Claude Code matches the pattern anywhere in the {{target}}, so this entry allows more than it appears to.',
    },
  },
  create(context) {
    return {
      Document(node) {
        // Claude Code ignores a hidden drop-in, so it reads no key there.
        if (isHiddenDropIn(context.filename)) {
          return
        }
        const list = marketplaceMember(node.body, 'strictKnownMarketplaces')?.value
        if (list?.type !== 'Array') {
          return
        }
        for (const { value: entry } of list.elements) {
          const type = lastMember(entry, 'source')?.value
          if (type?.type !== 'String' || (type.value !== HOST && type.value !== PATH)) {
            continue
          }
          const pattern = lastMember(entry, type.value)?.value
          if (pattern?.type !== 'String' || !compiles(pattern.value)) {
            continue
          }
          const host = type.value === HOST
          // Each top-level branch matches on its own, so each one needs its anchors.
          const anchored = branchesOf(pattern.value).every(
            (branch) => branch.startsWith('^') && (!host || endsAnchored(branch)),
          )
          if (!anchored && (host || pattern.value !== ALLOW_ALL_PATHS)) {
            context.report({
              node: pattern,
              messageId: 'unanchored',
              data: {
                type: type.value,
                value: pattern.value,
                need: host ? 'start with "^" and end with "$"' : 'start with "^"',
                target: host ? 'host' : 'path',
              },
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
  files: MANAGED_SETTINGS_FILES,
  rule,
}

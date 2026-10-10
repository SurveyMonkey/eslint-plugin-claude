// The AWS rules of `sandbox.credentials` (docs/rules/sandbox-credentials-aws.md): `awsPairs` names
// whole-value `mask` entries of `envVars` and each name fills one slot, the conventional access key
// and secret key are masked together, and `onExtractNoMatch: "deny"` acts as `error` when the read
// block does not hold. Claude Code honors `awsPairs` and `mask` entries in user and managed
// settings only, so the rule reads the managed files. `settings-key-scope` reports `awsPairs` in a
// project file, and `sandbox-scope` reports a `mask` entry there. A source is the managed files
// that `src/permission-source.ts` adds up.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type ValueNode } from '../marketplace-json.ts'
import {
  at,
  isObject,
  objectEntries,
  type SettingsObject,
  sourceOf,
  stringsAt,
} from '../permission-source.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'sandbox-credentials-aws' as const

type MessageId = 'notWholeMask' | 'reused' | 'unpaired' | 'denyReopened'

const KEY = 'AWS_ACCESS_KEY_ID'
const SECRET = 'AWS_SECRET_ACCESS_KEY'
/** The conventional variables. A pair that names one replaces the automatic link. */
const CONVENTIONAL = [KEY, SECRET, 'AWS_SESSION_TOKEN']
const SLOTS = ['accessKeyIdVar', 'secretAccessKeyVar', 'sessionTokenVar']

const isWholeMask = (entry: SettingsObject) =>
  entry.mode === 'mask' && entry.extract === undefined && entry.decode === undefined

/** A path with no final `/` and no final `/**`. */
const bare = (text: string) => text.replace(/\/\*\*$/, '').replace(/\/+$/, '')

/** True when the `allowRead` entry `allowed` is `target`, or a directory that holds it. */
function reopens(allowed: string, target: string): boolean {
  const base = bare(allowed)
  return base === bare(target) || bare(target).startsWith(`${base}/`)
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Give sandbox.credentials AWS entries that Claude Code can pair and apply',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notWholeMask:
        '"{{variable}}" must be a whole-value "mask" entry of "sandbox.credentials.envVars", with no "extract" or "decode" and no "deny" entry, to be in "awsPairs".',
      reused:
        '"{{variable}}" fills a second slot of "awsPairs". A variable can fill one slot across all pairs.',
      unpaired:
        '"{{masked}}" is masked and "{{missing}}" is not. Mask the access key and the secret key together, or the proxy cannot re-sign AWS requests.',
      denyReopened:
        '`"onExtractNoMatch": "deny"` acts as "error" here, because {{cause}}. Sandbox setup stops when the pattern matches nothing.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename) || kindOf(context.filename) !== 'managed') {
      return {}
    }
    return {
      Document(document) {
        const objects = sourceOf(context.filename, context.sourceCode.text)
        const own = objects[0] as SettingsObject
        const path = ['sandbox', 'credentials']
        const entries = objects.flatMap((object) => {
          const list = at(object, [...path, 'envVars'])
          return Array.isArray(list) ? list.filter(isObject) : []
        })
        // `awsPairs` is taken whole, so a pair in another file decides the key.
        const otherPairs = objects
          .slice(1)
          .some((object) => at(object, [...path, 'awsPairs']) !== undefined)
        const pairs = otherPairs ? [] : objectEntries(document, own, [...path, 'awsPairs'])
        const used = new Set<string>()
        for (const { entry, node } of pairs) {
          for (const slot of SLOTS) {
            const variable = entry[slot]
            if (typeof variable !== 'string') {
              continue
            }
            const target = lastMember(node, slot)?.value as ValueNode
            const named = entries.filter((item) => item.name === variable)
            if (used.has(variable)) {
              context.report({ node: target, messageId: 'reused', data: { variable } })
            } else if (
              named.length > 0 &&
              !(named.some(isWholeMask) && !named.some((item) => item.mode === 'deny'))
            ) {
              context.report({ node: target, messageId: 'notWholeMask', data: { variable } })
            }
            used.add(variable)
          }
        }
        // A pair that names a conventional variable replaces the automatic link.
        const paired = pairs.some(({ entry }) =>
          SLOTS.some((slot) => CONVENTIONAL.includes(entry[slot] as string)),
        )
        const masked = (variable: string) =>
          entries.some((item) => item.name === variable && item.mode === 'mask')
        if (!otherPairs && !paired) {
          for (const { entry, node } of objectEntries(document, own, [...path, 'envVars'])) {
            const other = entry.name === KEY ? SECRET : KEY
            if (
              entry.mode === 'mask' &&
              CONVENTIONAL.slice(0, 2).includes(entry.name as string) &&
              !masked(other)
            ) {
              context.report({
                node: lastMember(node, 'name')?.value as ValueNode,
                messageId: 'unpaired',
                data: { masked: String(entry.name), missing: other },
              })
            }
          }
        }
        const allowRead = stringsAt(objects, ['sandbox', 'filesystem', 'allowRead'])
        const isOff = objects.some(
          (object) => at(object, ['sandbox', 'filesystem', 'disabled']) === true,
        )
        for (const { entry, node } of objectEntries(document, own, [...path, 'files'])) {
          if (
            entry.mode !== 'mask' ||
            entry.onExtractNoMatch !== 'deny' ||
            typeof entry.path !== 'string'
          ) {
            continue
          }
          const target = entry.path
          const cause = isOff
            ? '`sandbox.filesystem.disabled` is true, so the read block is not enforced'
            : allowRead.some((allowed) => reopens(allowed, target))
              ? 'an `allowRead` entry re-opens the path'
              : undefined
          if (cause !== undefined) {
            context.report({
              node: lastMember(node, 'onExtractNoMatch')?.value as ValueNode,
              messageId: 'denyReopened',
              data: { cause },
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

// The settings of one source, as plain objects. A list key such as `permissions.deny` adds up
// over the files of one source: the project pair (`.claude/settings.json` and
// `.claude/settings.local.json`), or the merged managed source. The two sources never mix.
// A sibling file that the rule cannot read adds nothing to a check that a present value proves.
// A check that rests on an absence must make no report when `complete` is false. A scalar value
// is such a check, because an unreadable file can override it.
import type { DocumentNode, ObjectNode } from './marketplace-json.ts'
import { type ParsedRule, parsePermissionRule } from './permission-rule.ts'
import { valueAt } from './permission-sandbox.ts'
import { readSiblings } from './settings-files.ts'
import { UNREADABLE } from './skill-tree.ts'

/** The fields of one settings file. */
export type SettingsObject = Record<string, unknown>

export const isObject = (value: unknown): value is SettingsObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** The value at `path` in `object`, or undefined when a key on the way is not there. */
export function at(object: unknown, path: readonly string[]): unknown {
  let value = object
  for (const key of path) {
    value = isObject(value) ? value[key] : undefined
  }
  return value
}

/** The strings of the list at `path` in each of `objects`, in order. */
export function stringsAt(objects: readonly SettingsObject[], path: readonly string[]): string[] {
  return objects.flatMap((object) => {
    const list = at(object, path)
    return Array.isArray(list)
      ? list.filter((item): item is string => typeof item === 'string')
      : []
  })
}

/** The fields of the file `filename` that holds `text`, then the fields of the other files of its
 *  source. `complete` is false when a file of the source cannot be read, because that file can
 *  hold any key. A document that is not an object has no fields. ESLint has parsed `text` as
 *  JSON already, so `JSON.parse` does not fail. */
export function sourceOf(
  filename: string,
  text: string,
): { readonly objects: SettingsObject[]; readonly complete: boolean } {
  const parsed: unknown = JSON.parse(text)
  const own = isObject(parsed) ? parsed : {}
  const others = readSiblings(filename)
  return others === UNREADABLE
    ? { objects: [own], complete: false }
    : { objects: [own, ...others], complete: true }
}

/** The Boolean that Claude Code reads from `value`, or undefined when it reads none. A managed
 *  file reads the string "true" or "false" as that Boolean. Any other invalid value of a managed
 *  file counts as `strict`, the value that keeps the sandbox strictest for this key: `true` for
 *  `enabled`, `false` for `allowUnsandboxedCommands`
 *  (https://code.claude.com/docs/en/managed-settings#invalid-values-inside-sandbox). A null is
 *  not read. A non-Boolean in a file that is not managed is not read either: `sandbox-schema`
 *  reports it. */
export function boolOf(value: unknown, isManaged: boolean, strict: boolean): boolean | undefined {
  if (typeof value === 'boolean') {
    return value
  }
  if (!isManaged || value === undefined || value === null) {
    return undefined
  }
  return value === 'true' || value === 'false' ? value === 'true' : strict
}

/** The value of `sandbox.enabled` in each of `objects`. A key that is not there gives undefined.
 *  The default is `false`, and a managed value that is invalid counts as `true`. */
export function enabledValues(
  objects: readonly SettingsObject[],
  isManaged: boolean,
): (boolean | undefined)[] {
  return objects.map((object) => boolOf(at(object, ['sandbox', 'enabled']), isManaged, true))
}

/** True when the sandbox is on in the source: a file sets `enabled` to true, and no file sets it
 *  to false. A later file can override a true, so the rule reads a false as the sandbox off. */
export function sandboxOn(objects: readonly SettingsObject[], isManaged: boolean): boolean {
  const values = enabledValues(objects, isManaged)
  return values.includes(true) && !values.includes(false)
}

/** The objects of the list at `path`, as the plain object and the tree node of each. The two
 *  lists have the same order, because `JSON.parse` and the tree read one text. */
export function objectEntries(
  document: DocumentNode,
  own: SettingsObject,
  path: readonly string[],
): { readonly entry: SettingsObject; readonly node: ObjectNode }[] {
  const node = valueAt(document, path)
  const list = at(own, path)
  if (node?.type !== 'Array' || !Array.isArray(list)) {
    return []
  }
  return node.elements.flatMap((element, index) =>
    element.value.type === 'Object'
      ? [{ entry: list[index] as SettingsObject, node: element.value }]
      : [],
  )
}

/** The rules that parse in the list `list` of `permissions`, over each of `objects`, in order. An
 *  entry that is not a string, and one that does not parse, is not a rule. */
export function listRules(
  objects: readonly SettingsObject[],
  list: 'allow' | 'ask' | 'deny',
): ParsedRule[] {
  return stringsAt(objects, ['permissions', list]).flatMap((text) => {
    const parsed = parsePermissionRule(text)
    return parsed.ok ? [parsed] : []
  })
}

/** True when a `deny` or `ask` rule of `objects` covers the `allow` rule `rule` as
 *  `permissions-dead-allow` reads it for a tool that has no command pattern: a rule with no
 *  specifier, or one with the same specifier. That rule reports the `allow` rule, so a rule that
 *  would report it too skips it, and one fault gets one report. */
export function isDeadAllow(objects: readonly SettingsObject[], rule: ParsedRule): boolean {
  return (['deny', 'ask'] as const).some((list) =>
    listRules(objects, list).some(
      (cover) =>
        cover.tool === rule.tool &&
        (cover.specifier === null || cover.specifier === rule.specifier),
    ),
  )
}

/** True when a file of `objects` holds a `PreToolUse` hook. An empty list holds no hook. */
export function hasPreToolUseHook(objects: readonly SettingsObject[]): boolean {
  return objects.some((object) => {
    const hooks = at(object, ['hooks', 'PreToolUse'])
    return hooks !== undefined && !(Array.isArray(hooks) && hooks.length === 0)
  })
}

/** The places of the lock that turns auto mode off, as the docs give them
 *  (https://code.claude.com/docs/en/settings-reference#disableautomode). */
const AUTO_MODE_LOCKS = [['disableAutoMode'], ['permissions', 'disableAutoMode']]

/** True when a file of the managed source `objects` turns auto mode off. The docs lock is
 *  "disable". A value that Claude Code cannot read also reads as the restrictive value, and only
 *  null removes the key (https://code.claude.com/docs/en/managed-settings#keys-that-fail-closed). */
export function isAutoModeLocked(objects: readonly SettingsObject[]): boolean {
  return objects.some((object) =>
    AUTO_MODE_LOCKS.some((path) => {
      const value = at(object, path)
      return value !== undefined && value !== null
    }),
  )
}

// The settings of one source, as plain objects. A list key such as `permissions.deny` adds up
// over the files of one source: the project pair (`.claude/settings.json` and
// `.claude/settings.local.json`), or the merged managed source. The two sources never mix.
// A sibling file that the rule cannot read adds nothing to a check that a present value proves.
// A check that rests on an absence must make no report when `complete` is false.
import type { DocumentNode, ObjectNode } from './marketplace-json.ts'
import { valueAt } from './permission-sandbox.ts'
import { kindOf, readManagedSource, readSiblingSettings } from './settings-files.ts'
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
  const others =
    kindOf(filename) === 'managed' ? readManagedSource(filename) : readSiblingSettings(filename)
  if (others === UNREADABLE) {
    return { objects: [own], complete: false }
  }
  if (others === null) {
    return { objects: [own], complete: true }
  }
  return { objects: [own, ...(Array.isArray(others) ? others : [others])], complete: true }
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

// The reader that the `sandbox-*` rules share. A rule gets the value at a path in a settings file,
// as `JSON.parse` would: the last of two keys of one name counts. A value of the wrong type gives
// nothing here. `sandbox-schema` reports the type of each key.
import { WITHHELD_BY } from './data/sandbox-keys.ts'
import { type DocumentNode, lastMember, type ValueNode } from './marketplace-json.ts'

/** A string value, as the JSON tree holds it. */
export type StringNode = Extract<ValueNode, { type: 'String' }>

/** The value at `path` below the top level of `document`, or undefined when a key on the way is
 *  missing or holds a value that is not an object. */
export function valueAt(document: DocumentNode, path: readonly string[]): ValueNode | undefined {
  let value: ValueNode | undefined = document.body
  for (const key of path) {
    value = lastMember(value, key)?.value
  }
  return value
}

/** The entries of `value` that are strings, in file order. It is empty when `value` is not an
 *  array. An entry of another type is not read. */
export function stringEntries(value: ValueNode | undefined): StringNode[] {
  if (value?.type !== 'Array') {
    return []
  }
  return value.elements.flatMap((element) =>
    element.value.type === 'String' ? [element.value] : [],
  )
}

/** The sentence that a message adds in a managed file for the list `key`: Claude Code withholds
 *  other lists while this one, or an entry of it, is invalid. It is empty for a list that
 *  withholds nothing. */
export function withheldNote(key: string): string {
  const lists = WITHHELD_BY[key]?.map((name) => `"${name}"`)
  return lists === undefined
    ? ''
    : ` Claude Code withholds ${lists.join(' and ')} while this list, or an entry of it, is invalid.`
}

/** The host and the port of a domain entry of `allowedDomains` or `deniedDomains`. The port keeps
 *  its colon, and is empty when absent. The host is in lower case, with no final dot, because an
 *  entry with that dot blocks the same connections
 *  (https://code.claude.com/docs/en/settings-reference#sandbox-network-denieddomains). */
export function domainParts(entry: string): { host: string; port: string } {
  const match = /^(.*?)(:\d+)?$/.exec(entry) as RegExpExecArray
  return { host: (match[1] as string).replace(/\.$/, '').toLowerCase(), port: match[2] ?? '' }
}

/** True when `value` is the Boolean `true`. In a managed file, the string "true" counts too (the
 *  managed settings page, "Invalid values inside sandbox"). */
export function isOn(value: ValueNode | undefined, isManaged: boolean): boolean {
  return (
    (value?.type === 'Boolean' && value.value) ||
    (isManaged && value?.type === 'String' && value.value === 'true')
  )
}

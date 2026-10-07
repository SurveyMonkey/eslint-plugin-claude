// The reader that the `marketplace-*` rules share. A rule gets the top-level
// members of `marketplace.json` and the entries of `plugins`. A value of the
// wrong type gives nothing here. The rule `marketplace-schema` reports it for
// each field that it reads. `marketplace-source-schema` reports the fields
// inside an object `source`.
import type { JSONRuleVisitor } from '@eslint/json'

export type DocumentNode = Parameters<NonNullable<JSONRuleVisitor['Document']>>[0]
export type ObjectNode = Parameters<NonNullable<JSONRuleVisitor['Object']>>[0]
export type MemberNode = ObjectNode['members'][number]
export type ValueNode = MemberNode['value']

/** The text of a member name: a string in JSON, or a bare identifier in
 *  JSON5. */
function keyOf(name: MemberNode['name']): string {
  return name.type === 'String' ? name.value : name.name
}

/** The last member `key` of `value`, as `JSON.parse` keeps the last of two.
 *  It is undefined when `value` is not an object or has no such member. */
export function lastMember(value: ValueNode | undefined, key: string): MemberNode | undefined {
  if (value?.type !== 'Object') {
    return undefined
  }
  return value.members.findLast((member) => keyOf(member.name) === key)
}

/** The entries of `plugins` that are objects, in file order. A `plugins` value
 *  that is not an array, and an entry that is not an object, are not read. */
export function pluginEntries(document: DocumentNode): ObjectNode[] {
  const plugins = lastMember(document.body, 'plugins')?.value
  if (plugins?.type !== 'Array') {
    return []
  }
  return plugins.elements.flatMap((element) =>
    element.value.type === 'Object' ? [element.value] : [],
  )
}

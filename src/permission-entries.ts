// The permission rules in a settings file: each string in `permissions.allow`,
// `permissions.ask` and `permissions.deny`. The grammar rules share this
// reader, so each one reports at the node of the entry. It reads the JSON
// tree. The grammar itself is in `permission-rule.ts`.
import type { JSONRuleVisitor } from '@eslint/json'
import {
  type ParsedRule,
  type ParseResult,
  paramName,
  parsePermissionRule,
} from './permission-rule.ts'

type DocumentNode = Parameters<NonNullable<JSONRuleVisitor['Document']>>[0]
type StringNode = Parameters<NonNullable<JSONRuleVisitor['String']>>[0]
type ObjectNode = Parameters<NonNullable<JSONRuleVisitor['Object']>>[0]
type ValueNode = ObjectNode['members'][number]['value']

type PermissionList = 'allow' | 'ask' | 'deny'
const LISTS: readonly PermissionList[] = ['allow', 'ask', 'deny']

/** One string entry of a permission list, with the result of its parse. */
export interface PermissionEntry {
  readonly list: PermissionList
  readonly node: StringNode
  readonly result: ParseResult
}

/** An entry that parsed. */
export interface ParsedEntry extends PermissionEntry {
  readonly rule: ParsedRule
}

/** The text of a member name: a string in JSON, or a bare identifier in
 *  JSON5. */
function keyOf(
  name: { type: 'String'; value: string } | { type: 'Identifier'; name: string },
): string {
  return name.type === 'String' ? name.value : name.name
}

/** The value of the last member `key` of `value`, as `JSON.parse` keeps the
 *  last of two. It is undefined when `value` is not an object or has no such
 *  member. */
function memberValue(value: ValueNode | undefined, key: string): ValueNode | undefined {
  if (value?.type !== 'Object') {
    return undefined
  }
  return value.members.findLast((member) => keyOf(member.name) === key)?.value
}

/** Each string entry of `permissions.allow`, `permissions.ask` and
 *  `permissions.deny`, in file order within each list. An entry that is not a
 *  string, and a list that is not an array, are not read. */
export function permissionEntries(document: DocumentNode): PermissionEntry[] {
  const permissions = memberValue(document.body, 'permissions')
  return LISTS.flatMap((list) => {
    const value = memberValue(permissions, list)
    if (value?.type !== 'Array') {
      return []
    }
    return value.elements.flatMap((element) =>
      element.value.type === 'String'
        ? [{ list, node: element.value, result: parsePermissionRule(element.value.value) }]
        : [],
    )
  })
}

/** The entries that parse. A rule that does not parse is for
 *  `permissions-rule-syntax` alone. */
export function parsedEntries(document: DocumentNode): ParsedEntry[] {
  return permissionEntries(document).flatMap((entry) =>
    entry.result.ok ? [{ ...entry, rule: entry.result }] : [],
  )
}

/** The parameter name of a deny or ask rule in the `param:value` form, or
 *  null. An allow rule has no such form: its specifier is the syntax of its
 *  tool. */
export function parameterOf(entry: ParsedEntry): string | null {
  const { list, rule } = entry
  return list === 'allow' || rule.specifier === null ? null : paramName(rule.specifier)
}

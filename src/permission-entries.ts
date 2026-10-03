// The permission rules in a file, from two sources. A settings file holds each
// string in `permissions.allow`, `permissions.ask` and `permissions.deny`. A
// skill or command file holds the rules of `allowed-tools`, which is an
// `allow` list, and of `disallowed-tools`, which is a `deny` list. The grammar
// rules share this reader, so each one reports at the location of the entry.
// The grammar itself is in `permission-rule.ts`.
import type { JSONRuleVisitor } from '@eslint/json'
import type { AST } from 'eslint'
import { listEntries, SPACE_OR_COMMA } from './frontmatter-list.ts'
import {
  type ParsedRule,
  type ParseResult,
  paramName,
  parsePermissionRule,
} from './permission-rule.ts'
import type { SkillFrontmatter } from './skill-frontmatter.ts'

type DocumentNode = Parameters<NonNullable<JSONRuleVisitor['Document']>>[0]
type ObjectNode = Parameters<NonNullable<JSONRuleVisitor['Object']>>[0]
type ValueNode = ObjectNode['members'][number]['value']

type PermissionList = 'allow' | 'ask' | 'deny'
const LISTS: readonly PermissionList[] = ['allow', 'ask', 'deny']

/** The frontmatter field of a skill that holds each list. A skill has no
 *  `ask` list. */
const SKILL_FIELDS: readonly (readonly [string, PermissionList])[] = [
  ['allowed-tools', 'allow'],
  ['disallowed-tools', 'deny'],
]

interface EntryBase {
  readonly list: PermissionList
  /** Where the entry sits in the file. A report uses it as `loc`. */
  readonly loc: AST.SourceLocation
}

/** One entry of a permission list, with the result of its parse. */
export interface PermissionEntry extends EntryBase {
  readonly result: ParseResult
}

/** An entry that parsed. */
export interface ParsedEntry extends EntryBase {
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
        ? [{ list, loc: element.value.loc, result: parsePermissionRule(element.value.value) }]
        : [],
    )
  })
}

/** Each rule of `allowed-tools` (as `allow`) and `disallowed-tools` (as
 *  `deny`) in the frontmatter `fm`. `yaml` is the text that `fm` was read from.
 *  The docs accept a space- or comma-separated string, or a YAML list. */
export function skillEntries(fm: SkillFrontmatter, yaml: string): PermissionEntry[] {
  return SKILL_FIELDS.flatMap(([key, list]) =>
    listEntries(fm, yaml, key, SPACE_OR_COMMA).map(({ text, loc }) => ({
      list,
      loc,
      result: parsePermissionRule(text),
    })),
  )
}

/** The entries that parse. A rule that does not parse is for
 *  `permissions-rule-syntax` alone. */
export function parsedEntries(entries: readonly PermissionEntry[]): ParsedEntry[] {
  return entries.flatMap((entry) =>
    entry.result.ok ? [{ list: entry.list, loc: entry.loc, rule: entry.result }] : [],
  )
}

/** The parameter name of a deny or ask rule in the `param:value` form, or
 *  null. An allow rule has no such form: its specifier is the syntax of its
 *  tool. */
export function parameterOf(entry: ParsedEntry): string | null {
  const { list, rule } = entry
  return list === 'allow' || rule.specifier === null ? null : paramName(rule.specifier)
}

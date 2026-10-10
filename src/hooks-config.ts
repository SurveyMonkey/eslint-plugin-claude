// The `hooks` config of a Claude Code file, for the rules that read it. The same
// shape is in the `hooks` key of a settings file, in `hooks/hooks.json` of a plugin,
// and in the `hooks` field of skill and agent frontmatter. A settings file and a
// plugin `hooks.json` are JSON. The frontmatter of a skill and of an agent is YAML.
// This reader turns each of them into one tree of nodes with a location. A rule
// reports at the narrowest part and does not care about the language.
//
// The tree is tolerant: a value of the wrong type is still a node. `hooks-config-schema`
// reports it. The other rules read `handlersOf`, which gives the handlers of well-formed groups only.
import path from 'node:path'
import type { MarkdownSourceCode } from '@eslint/markdown'
import type { AST, Rule } from 'eslint'
import { isMap, isScalar, isSeq, parseDocument, type YAMLMap } from 'yaml'
import { classifyAgentFile } from './agent-files.ts'
import { hooksFileKind } from './hooks-files.ts'
import { type DocumentNode, keyOf, lastMember, type ValueNode } from './marketplace-json.ts'
import { SETTINGS_FILES } from './permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from './settings-files.ts'
import { classifySkillFile } from './skill-files.ts'
import { readFrontmatter } from './skill-frontmatter.ts'

export type Loc = AST.SourceLocation

/** One member of an object node. */
export interface HMember {
  key: string
  keyLoc: Loc
  value: HNode
}

/** A value of the config. A node of kind `other` is a value that no rule reads,
 *  such as a YAML alias. */
export type HNode =
  | { kind: 'object'; loc: Loc; members: HMember[] }
  | { kind: 'array'; loc: Loc; items: HNode[] }
  | { kind: 'string'; loc: Loc; value: string }
  | { kind: 'number'; loc: Loc; value: number }
  | { kind: 'boolean'; loc: Loc; value: boolean }
  | { kind: 'null'; loc: Loc }
  | { kind: 'other'; loc: Loc }

export type HObject = Extract<HNode, { kind: 'object' }>

/** Where a config sits. The kind decides what a rule may say about a handler. */
type SourceKind = 'settings' | 'plugin' | 'skill' | 'agent'

export interface HookSource {
  kind: SourceKind
  /** The `hooks` value. It is undefined when the file has no `hooks` key. */
  hooks: HNode | undefined
  /** The whole file of a plugin `hooks.json`. Settings and frontmatter give undefined. */
  file: HNode | undefined
}

/** A handler in its place: the event, the matcher group and the handler itself. */
export interface HookHandler {
  source: HookSource
  event: string
  /** The `matcher` of the group when it is a string, or undefined. */
  matcher: string | undefined
  handler: HObject
}

/** The path placeholders of the hooks reference, "Reference scripts by path". Claude Code replaces
 *  each `${NAME}` in a `command`, and exports the variable to the process. */
export const PATH_VARIABLES = [
  'CLAUDE_PROJECT_DIR',
  'CLAUDE_PLUGIN_ROOT',
  'CLAUDE_PLUGIN_DATA',
] as const

/** The handler types, from the hooks reference, "Hook handler fields". */
export const HANDLER_TYPES = ['command', 'http', 'mcp_tool', 'prompt', 'agent'] as const
export type HandlerType = (typeof HANDLER_TYPES)[number]

export function isHandlerType(value: string): value is HandlerType {
  return (HANDLER_TYPES as readonly string[]).includes(value)
}

/** Where the rules that read the config look: the settings files, the `hooks.json` of a
 *  plugin, and the frontmatter of a skill and of a subagent. A rule spreads this in
 *  its module. The frontmatter of a command file is not a target: the docs name skills and
 *  subagents only. */
export const HOOKS_TARGET = {
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES, '**/hooks/hooks.json'],
  also: { language: 'markdown' as const, files: ['**/SKILL.md', '**/agents/**/*.md'] },
}

/** `items` as a quoted list for a message: `"a"`, `"a" and "b"`, `"a", "b" and "c"`. */
export function quotedList(items: readonly string[]): string {
  const quoted = items.map((item) => `"${item}"`)
  return quoted.length < 2
    ? quoted.join('')
    : `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`
}

/** The values of a matcher that holds exact-match characters only, or null when Claude Code reads
 *  the matcher as a regular expression. Letters, digits, `_`, `-`, spaces, `,` and `|` are the exact
 *  set, and `|` or `,` separates values. `narrow` is the set of `FileChanged` and `StopFailure`: letters,
 *  digits, `_` and `|`, with `|` as the one separator (the hooks reference, "Matcher patterns").
 *  An empty matcher gives no values. `*` is not an exact-match character, so it gives null. */
export function exactValues(matcher: string, narrow: boolean): string[] | null {
  if (!(narrow ? /^[\w|]*$/ : /^[\w\- ,|]*$/).test(matcher)) {
    return null
  }
  return matcher
    .split(narrow ? '|' : /[|,]/)
    .map((value) => value.trim())
    .filter((value) => value !== '')
}

/** The last member `key` of the object `node`, as `JSON.parse` keeps the last of two. */
export function memberOf(node: HObject, key: string): HMember | undefined {
  return node.members.findLast((member) => member.key === key)
}

/** The members of `node`, with the last of two members of one name. */
export function lastMembers(node: HObject): HMember[] {
  return node.members.filter((member) => memberOf(node, member.key) === member)
}

/** True when the member `key` of `node` is the Boolean `true`. */
export function isTrue(node: HObject, key: string): boolean {
  const value = memberOf(node, key)?.value
  return value?.kind === 'boolean' && value.value
}

/** The string value of the member `key` of `node`, or undefined. */
export function stringOf(node: HObject, key: string): string | undefined {
  const value = memberOf(node, key)?.value
  return value?.kind === 'string' ? value.value : undefined
}

/** A location for a node that has no place in a file, such as a node that is read from a file
 *  that the rule does not lint. */
const NOWHERE: Loc = { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }

/** The node for a parsed JSON value. The location of each node is `NOWHERE`. A rule uses it to read the
 *  hooks of a file that it does not lint with `groupsOf` and `handlersOf`. A value that JSON does not
 *  have, such as a missing key, gives a node of kind `other`. */
export function fromData(value: unknown): HNode {
  if (Array.isArray(value)) {
    return { kind: 'array', loc: NOWHERE, items: value.map(fromData) }
  }
  switch (typeof value) {
    case 'string':
      return { kind: 'string', loc: NOWHERE, value }
    case 'number':
      return { kind: 'number', loc: NOWHERE, value }
    case 'boolean':
      return { kind: 'boolean', loc: NOWHERE, value }
    case 'object':
      return value === null
        ? { kind: 'null', loc: NOWHERE }
        : {
            kind: 'object',
            loc: NOWHERE,
            members: Object.entries(value).map(([key, member]) => ({
              key,
              keyLoc: NOWHERE,
              value: fromData(member),
            })),
          }
    default:
      return { kind: 'other', loc: NOWHERE }
  }
}

function fromJson(node: ValueNode): HNode {
  switch (node.type) {
    case 'Object':
      return {
        kind: 'object',
        loc: node.loc,
        members: node.members.map((member) => ({
          key: keyOf(member.name),
          keyLoc: member.name.loc,
          value: fromJson(member.value),
        })),
      }
    case 'Array':
      return { kind: 'array', loc: node.loc, items: node.elements.map((e) => fromJson(e.value)) }
    case 'String':
      return { kind: 'string', loc: node.loc, value: node.value }
    case 'Number':
      return { kind: 'number', loc: node.loc, value: node.value }
    case 'Boolean':
      return { kind: 'boolean', loc: node.loc, value: node.value }
    case 'Null':
      return { kind: 'null', loc: node.loc }
    default:
      // `NaN` and `Infinity`, which only JSON5 has.
      return { kind: 'other', loc: node.loc }
  }
}

type At = (start: number, end: number) => Loc

/** The node for a YAML node. A null node has no range, so it takes `fallback`. Any other node has a range. */
function fromYaml(node: unknown, at: At, fallback: Loc): HNode {
  // A flow-map entry with a key and no value, such as `{ Stop }`, has a null value node.
  if (node === null) {
    return { kind: 'null', loc: fallback }
  }
  const [start, end] = (node as { range: [number, number, number] }).range
  const loc = at(start, end)
  if (isMap(node)) {
    return {
      kind: 'object',
      loc,
      members: node.items.flatMap((pair) => {
        if (!isScalar(pair.key) || typeof pair.key.value !== 'string') {
          return []
        }
        const [keyStart, keyEnd] = pair.key.range as [number, number, number]
        const keyLoc = at(keyStart, keyEnd)
        return [{ key: pair.key.value, keyLoc, value: fromYaml(pair.value, at, keyLoc) }]
      }),
    }
  }
  if (isSeq(node)) {
    return { kind: 'array', loc, items: node.items.map((item) => fromYaml(item, at, loc)) }
  }
  if (isScalar(node)) {
    const value = node.value
    if (typeof value === 'string') {
      return { kind: 'string', loc, value }
    }
    if (typeof value === 'number') {
      return { kind: 'number', loc, value }
    }
    // The core schema of the parser reads a scalar as a string, a number, a Boolean or null.
    return typeof value === 'boolean' ? { kind: 'boolean', loc, value } : { kind: 'null', loc }
  }
  // An alias.
  return { kind: 'other', loc }
}

/** The kind of a frontmatter file that can hold hooks, or null. A skill is a `SKILL.md`
 *  file. A subagent is an agent file of a project: the hooks of a plugin agent are ignored, and
 *  `agent-plugin-ignored-fields` reports them. */
function frontmatterKind(filename: string): 'skill' | 'agent' | null {
  if (classifySkillFile(filename)?.kind === 'skill') {
    return 'skill'
  }
  return classifyAgentFile(filename)?.plugin === false ? 'agent' : null
}

/** A listener that calls `check` with the hooks config of the file. For a settings file
 *  it does so unless the file is a hidden drop-in in `managed-settings.d`. For a `hooks.json` it
 *  does so when the file is the `hooks.json` of a plugin. For a Markdown file it does so when the
 *  file is a skill or a project subagent, and its frontmatter parses. */
export function hooksListener(
  context: Rule.RuleContext,
  check: (source: HookSource) => void,
): Rule.RuleListener {
  const listener = {
    Document(node: DocumentNode) {
      const body = node.body
      if (path.basename(context.filename) === 'hooks.json') {
        if (hooksFileKind(context.filename) === 'plugin') {
          const file = fromJson(body)
          const hooks = file.kind === 'object' ? memberOf(file, 'hooks')?.value : undefined
          check({ kind: 'plugin', hooks, file })
        }
        return
      }
      if (isHiddenDropIn(context.filename)) {
        return
      }
      const member = lastMember(body, 'hooks')
      check({
        kind: 'settings',
        hooks: member === undefined ? undefined : fromJson(member.value),
        file: undefined,
      })
    },
    yaml(node: Parameters<typeof readFrontmatter>[1]) {
      const kind = frontmatterKind(context.filename)
      if (kind === null) {
        return
      }
      // The `yaml` node exists in a Markdown tree only, so the source code is a Markdown one.
      const fm = readFrontmatter(context.sourceCode as unknown as MarkdownSourceCode, node)
      if (fm === null) {
        return
      }
      // `readFrontmatter` gives a result only when the YAML is a mapping.
      const contents = parseDocument(node.value).contents as YAMLMap
      const value = contents.get('hooks', true)
      check({
        kind,
        hooks: value === undefined ? undefined : fromYaml(value, fm.at, fm.at(0, 0)),
        file: undefined,
      })
    },
  }
  // `Rule.RuleListener` types a node as an ESTree node. These nodes are not.
  return listener as unknown as Rule.RuleListener
}

/** A matcher group in its place: the event and the group object. `matcher` is the `matcher` of the
 *  group when it is a string, with the location of the value. `handlers` is the inner `hooks`
 *  array when it is an array, with the objects in it. */
export interface HookGroup {
  source: HookSource
  event: string
  group: HObject
  matcher: { value: string; loc: Loc } | undefined
  handlers: HObject[]
}

/** The matcher groups of the source, in file order. A value of the wrong shape adds none: an
 *  event whose value is not an array, and a group that is not an object. A group that has no
 *  `hooks` array is still a group, with no handlers. `hooks-config-schema` reports these. */
export function groupsOf(source: HookSource): HookGroup[] {
  const { hooks } = source
  if (hooks?.kind !== 'object') {
    return []
  }
  return lastMembers(hooks).flatMap(({ key: event, value: groups }) => {
    if (groups.kind !== 'array') {
      return []
    }
    return groups.items.flatMap((group) => {
      if (group.kind !== 'object') {
        return []
      }
      const inner = memberOf(group, 'hooks')?.value
      const matcher = memberOf(group, 'matcher')?.value
      return [
        {
          source,
          event,
          group,
          matcher:
            matcher?.kind === 'string' ? { value: matcher.value, loc: matcher.loc } : undefined,
          handlers:
            inner?.kind === 'array'
              ? inner.items.filter((item): item is HObject => item.kind === 'object')
              : [],
        },
      ]
    })
  })
}

/** The handlers of the source, in file order. A value of the wrong shape adds none:
 *  an event whose value is not an array, a group that is not an object or that has no
 *  `hooks` array, and a handler that is not an object. `hooks-config-schema` reports these. A handler may still lack a `type` or hold a field of the wrong type. */
export function handlersOf(source: HookSource): HookHandler[] {
  return groupsOf(source).flatMap(({ event, matcher, handlers }) =>
    handlers.map((handler) => ({ source, event, matcher: matcher?.value, handler })),
  )
}

/** The member of the `hooks` object of `source` that holds the event `event`, or undefined. It gives
 *  the location of the event name. */
export function eventMember(source: HookSource, event: string): HMember | undefined {
  return source.hooks?.kind === 'object' ? memberOf(source.hooks, event) : undefined
}

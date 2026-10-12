// The `hooks` config of a Claude Code file, for the rules that read it. The same
// shape is in the `hooks` key of a settings file, in `hooks/hooks.json` of a plugin,
// and in the `hooks` field of skill and agent frontmatter. A settings file and a
// plugin `hooks.json` are JSON. The frontmatter of a skill and of an agent is YAML.
// This reader turns each of them into one tree of nodes with a location. A rule
// reports at the narrowest part and does not care about the language.
//
// The tree is tolerant: a value of the wrong type is still a node. `hooks-config-schema`
// reports it. The other rules read `handlersOf`, which gives the handlers of well-formed groups only.
// A YAML map that holds a merge key is a node of kind `unseen`. No rule reads into it. A YAML value
// over the alias limit gives no tree at all (see `fromYaml`).
import path from 'node:path'
import type { MarkdownSourceCode } from '@eslint/markdown'
import type { AST, Rule } from 'eslint'
import {
  type Alias,
  isAlias,
  isMap,
  isScalar,
  isSeq,
  type Node,
  parseDocument,
  type Scalar,
  visit,
  type YAMLMap,
} from 'yaml'
import { classifyAgentFile } from './agent-files.ts'
import {
  type HandlerText,
  handlerTexts,
  hooksFileKind,
  type PlaceholderFolders,
} from './hooks-files.ts'
import { type DocumentNode, keyOf, lastMember, type ValueNode } from './marketplace-json.ts'
import { SETTINGS_FILES } from './permission-listener.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from './settings-files.ts'
import { printedBy } from './shell-words.ts'
import { classifySkillFile } from './skill-files.ts'
import { readFrontmatter } from './skill-frontmatter.ts'

export type Loc = AST.SourceLocation

/** One member of an object node. */
export interface HMember {
  key: string
  keyLoc: Loc
  value: HNode
}

/** A value of the config. A node of kind `other` is a value of no JSON type. An example is a
 *  YAML alias that names its own ancestor. No rule reads into it. A node of kind `unseen` is a YAML
 *  map that holds a merge key (`<<`). No rule reads it as a value (see `fromYaml`). */
export type HNode =
  | { kind: 'object'; loc: Loc; members: HMember[] }
  | { kind: 'array'; loc: Loc; items: HNode[] }
  | { kind: 'string'; loc: Loc; value: string }
  | { kind: 'number'; loc: Loc; value: number }
  | { kind: 'boolean'; loc: Loc; value: boolean }
  | { kind: 'null'; loc: Loc }
  | { kind: 'other'; loc: Loc }
  | { kind: 'unseen'; loc: Loc }

export type HObject = Extract<HNode, { kind: 'object' }>

/** Where a config sits. The kind decides what a rule may say about a handler. */
type SourceKind = 'settings' | 'plugin' | 'skill' | 'agent'

export interface HookSource {
  kind: SourceKind
  /** The `hooks` value. It is undefined when the file has no `hooks` key, or when its YAML is over
   *  the alias limit (see `fromYaml`). */
  hooks: HNode | undefined
  /** True when the `hooks` value holds a node of kind `unseen` (see `holdsUnseen`). JSON gives
   *  false. */
  partial: boolean
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

/** The platforms that a rule with the option `platforms` knows. Claude Code runs a hook in PowerShell by
 *  default on `windows-no-git-bash`, and in Bash on the others (the hooks reference, "Command hook fields"). */
const PLATFORMS = ['windows-git-bash', 'windows-no-git-bash', 'macos', 'linux', 'wsl'] as const

/** The schema of the option `platforms`. A rule that depends on the platform of a team takes it, and
 *  makes no report without it. */
export const PLATFORMS_SCHEMA = {
  type: 'object',
  properties: {
    platforms: {
      description: 'The platforms where the team runs Claude Code.',
      type: 'array',
      items: { enum: PLATFORMS },
      uniqueItems: true,
    },
  },
  additionalProperties: false,
} as const

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

/** The string items of the `args` of the handler `node`, or undefined when `args` is no array (shell form). An item
 *  that is no string is left out. */
export function argsOf(node: HObject): string[] | undefined {
  const args = memberOf(node, 'args')?.value
  return args?.kind === 'array'
    ? args.items.flatMap((item) => (item.kind === 'string' ? [item.value] : []))
    : undefined
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

/** The node that `alias` names: the last node with its anchor before it in `marks`, as
 *  `Alias.resolve` finds it. `Alias.resolve` with no context reads the whole document for each
 *  alias, so a long list of aliases is slow. `marks` is the list that the listener finds once. */
function targetOf(alias: Alias, marks: readonly Node[]): Node | undefined {
  let target: Node | undefined
  for (const mark of marks) {
    if (mark === alias) {
      break
    }
    if (mark.anchor === alias.source) {
      target = mark
    }
  }
  return target
}

/** The state of one `fromYaml` walk. `marks` holds each alias and each node with an anchor, in
 *  document order. `path` holds the nodes that the walk is inside. `aliases` holds the count of
 *  aliases that the walk can still read. All copies of the context share one `aliases` object, so
 *  the count applies to the full walk. */
interface YamlContext {
  at: At
  marks: readonly Node[]
  path: readonly unknown[]
  aliases: { left: number }
}

/** The count of aliases that one `hooks` value can read. The parser stops a file that uses an
 *  anchor more than 100 times, but it counts no alias to an empty list. A nest of such aliases
 *  multiplies its size at each level, so this limit stops it. An alias to an ancestor uses no
 *  count. */
const MAX_ALIASES = 1000

/** True when `node` is of kind `unseen`, or holds a node of that kind at any depth. */
export function holdsUnseen(node: HNode): boolean {
  if (node.kind === 'object') {
    return node.members.some(({ value }) => holdsUnseen(value))
  }
  if (node.kind === 'array') {
    return node.items.some(holdsUnseen)
  }
  return node.kind === 'unseen'
}

/** The node for a YAML node, or undefined when the walk goes over the alias limit. A null node has
 *  no range, so it takes `fallback`. Any other node has a range.
 *
 *  An alias reads as the node that it names. That node takes the location of the alias (`place`). A
 *  node inside it keeps its own location. An alias that names an ancestor is kind `other`.
 *
 *  No page of the Claude Code docs says what Claude Code does with a merge key (`<<`). So a map that
 *  holds one is a node of kind `unseen`, and the walk does not read into it. Its siblings and the
 *  nodes around it stay readable. The unseen map can hide a thing whose absence a rule reports.
 *  Such a rule reads `holdsUnseen`. A rule that counts needs no check, because a hidden thing can
 *  only remove a report.
 *
 *  An alias over the limit is undefined. An undefined node makes each object and list around it
 *  undefined, up to the whole `hooks` value. */
function fromYaml(
  node: unknown,
  context: YamlContext,
  fallback: Loc,
  place?: Loc,
): HNode | undefined {
  // A flow-map entry with a key and no value, such as `{ Stop }`, has a null value node.
  if (node === null) {
    return { kind: 'null', loc: fallback }
  }
  const { at, path } = context
  const [start, end] = (node as { range: [number, number, number] }).range
  const loc = place ?? at(start, end)
  if (isAlias(node)) {
    const target = targetOf(node, context.marks)
    if (path.includes(target)) {
      return { kind: 'other', loc }
    }
    // The type of `target` includes undefined. `readFrontmatter` gives no result for an alias with
    // no anchor before it, so this walk does not see one.
    return target === undefined || context.aliases.left-- <= 0
      ? undefined
      : fromYaml(target, context, fallback, loc)
  }
  const inside = { ...context, path: [...path, node] }
  if (isMap(node)) {
    // A quoted `<<` is an ordinary key, and not a merge key.
    const merge = node.items.some(
      ({ key }) => isScalar(key) && key.type === 'PLAIN' && key.value === '<<',
    )
    if (merge) {
      return { kind: 'unseen', loc }
    }
    const members: HMember[] = []
    for (const pair of node.items) {
      // An alias key reads as the string that it names, at the location of the alias.
      const key = isAlias(pair.key) ? targetOf(pair.key, context.marks) : pair.key
      if (!isScalar(key) || typeof key.value !== 'string') {
        continue
      }
      const [keyStart, keyEnd] = (pair.key as Node).range as [number, number, number]
      const keyLoc = at(keyStart, keyEnd)
      const value = fromYaml(pair.value, inside, keyLoc)
      if (value === undefined) {
        return undefined
      }
      members.push({ key: key.value, keyLoc, value })
    }
    return { kind: 'object', loc, members }
  }
  if (isSeq(node)) {
    const items: HNode[] = []
    for (const item of node.items) {
      const value = fromYaml(item, inside, loc)
      if (value === undefined) {
        return undefined
      }
      items.push(value)
    }
    return { kind: 'array', loc, items }
  }
  const value = (node as Scalar).value
  if (typeof value === 'string') {
    return { kind: 'string', loc, value }
  }
  if (typeof value === 'number') {
    return { kind: 'number', loc, value }
  }
  // The core schema of the parser reads a scalar as a string, a number, a Boolean or null.
  return typeof value === 'boolean' ? { kind: 'boolean', loc, value } : { kind: 'null', loc }
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
          check({ kind: 'plugin', hooks, partial: false, file })
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
        partial: false,
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
      const doc = parseDocument(node.value)
      const value = (doc.contents as YAMLMap).get('hooks', true)
      const marks: Node[] = []
      visit(doc, {
        Node: (_key, mark) => {
          if (isAlias(mark) || mark.anchor !== undefined) {
            marks.push(mark)
          }
        },
      })
      const walk = { at: fm.at, marks, path: [], aliases: { left: MAX_ALIASES } }
      const hooks = value === undefined ? undefined : fromYaml(value, walk, fm.at(0, 0))
      check({ kind, hooks, partial: hooks !== undefined && holdsUnseen(hooks), file: undefined })
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
 *  `hooks` array is still a group, with no handlers. `hooks-config-schema` reports these. An
 *  event or a group of kind `unseen` adds none too, and no rule reports it. An `unseen` matcher
 *  gives `matcher: undefined`, as an omitted matcher does. So a rule reads the `matcher` member
 *  before it reads undefined as "every tool". `handlers` leaves out each handler that holds an
 *  `unseen` node. A rule cannot know how Claude Code runs it. */
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
              ? inner.items.filter(
                  (item): item is HObject => item.kind === 'object' && !holdsUnseen(item),
                )
              : [],
        },
      ]
    })
  })
}

/** The handlers of the source, in file order. A value of the wrong shape adds none:
 *  an event whose value is not an array, a group that is not an object or that has no
 *  `hooks` array, and a handler that is not an object. `hooks-config-schema` reports these. A handler may still lack a `type` or hold a field of the wrong type.
 *  A handler that holds a node of kind `unseen` adds none (see `groupsOf`). */
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

/** True when the command handler `node` runs in the background: `async` or `asyncRewake` is `true`. A background
 *  hook cannot block or decide (the hooks reference, "Run hooks in the background"). */
export function inBackground(node: HObject): boolean {
  return isTrue(node, 'async') || isTrue(node, 'asyncRewake')
}

/** What a rule needs to read the output of the handler `node`: the place to report and the texts that it
 *  runs. The result is undefined for a handler that is not a command, and for shell form with
 *  `shell: "powershell"`, which no rule reads as shell text. The docs say `shell` is ignored when `args` is set. */
export function commandOutput(
  node: HObject,
  folders: PlaceholderFolders,
): { loc: Loc; texts: HandlerText[] } | undefined {
  const line = memberOf(node, 'command')?.value
  const args = argsOf(node)
  if (
    stringOf(node, 'type') !== 'command' ||
    line?.kind !== 'string' ||
    (stringOf(node, 'shell') === 'powershell' && args === undefined)
  ) {
    return undefined
  }
  return { loc: line.loc, texts: handlerTexts(line.value, args, folders) }
}

/** A JSON object that a hook prints. */
export type Json = Record<string, unknown>

/** The JSON objects that the command handler texts `texts` print to standard output as literals. */
export function printedJson(texts: HandlerText[]): Json[] {
  return texts.flatMap(({ commands }) =>
    printedBy(commands).flatMap(({ json }) => (json === undefined ? [] : [json])),
  )
}

/** The value of `key` in `json` when it is a JSON object, or undefined. An array is no object. */
export function objectField(json: Json, key: string): Json | undefined {
  const value = json[key]
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : undefined
}

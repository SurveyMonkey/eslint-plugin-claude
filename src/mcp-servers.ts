// The reader that the `.mcp.json` rules share. A rule asks where the file is, and gets
// the server entries of its map. The map is the `mcpServers` object. A plugin `.mcp.json`
// may omit that wrapper, so its map is the top-level object. The module also holds the reader of
// the servers that a plugin declares, the reader of a JSON file as an AST, and the policy key
// reader of the approval and allow lists.
// (https://code.claude.com/docs/en/plugins/components#mcp-servers)
import path from 'node:path'
import json from '@eslint/json'
import { keyOf, lastMember, type MemberNode, type ValueNode } from './marketplace-json.ts'
import { isPluginRoot } from './plugin-root.ts'
import { pathFault } from './rules/marketplace-relative-source-format.ts'
import { isInside, readJson, realOf, repositoryRoot, UNREADABLE } from './skill-tree.ts'

/** The `type` values of a server that connects over the network. A `url` belongs to these. */
export const REMOTE_SERVER_TYPES: readonly string[] = ['http', 'streamable-http', 'sse', 'ws']

/** The `type` values that an entry of `managedMcpServers` may have. `streamable-http` is an alias
 *  of `http`. The other remote types are not valid there.
 *  (https://code.claude.com/docs/en/managed-mcp#what-an-entry-can-contain) */
export const MANAGED_SERVER_TYPES: readonly string[] = ['http', 'streamable-http', 'sse']

/** A server name that Claude Code accepts in `managedMcpServers` and in an allowlist
 *  `serverName`: letters, numbers, hyphens and underscores.
 *  (https://code.claude.com/docs/en/managed-mcp#how-servername-entries-match) */
export const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]+$/

/** Where a `.mcp.json` sits: in a project, or at the root of a plugin. */
export type McpFileKind = 'project' | 'plugin'

// The paths under `.claude/` that people try. The ends of the paths are listed here.
// Claude Code reads none of them. It reads `<project>/.mcp.json` and `~/.claude.json`.
// (https://code.claude.com/docs/en/mcp-quickstart#troubleshooting)
const UNREAD_PATHS: readonly (readonly string[])[] = [
  ['.claude', '.mcp.json'],
  ['.claude', 'mcp.json'],
  ['.claude', 'config', 'mcp.json'],
]

/** True when `filename` is an MCP config path under `.claude/`, which Claude Code never reads. */
export function isUnreadMcpPath(filename: string): boolean {
  const parts = path.resolve(filename).split(path.sep)
  return UNREAD_PATHS.some((tail) => tail.every((part, i) => parts.at(i - tail.length) === part))
}

/** The kind of the `.mcp.json` at `filename`. The result is null when no report can rest on
 *  the file. This is true for a path that Claude Code never reads. It is also true for a
 *  directory that the plugin-root check cannot read (ADR 001, Decision 14). */
export function mcpFileKind(filename: string): McpFileKind | null {
  if (isUnreadMcpPath(filename)) {
    return null
  }
  const plugin = isPluginRoot(path.dirname(path.resolve(filename)))
  if (plugin === UNREADABLE) {
    return null
  }
  return plugin ? 'plugin' : 'project'
}

/** The members of the server map of a file whose top-level value is `body`: the members of the
 *  `mcpServers` object. A plugin file with no `mcpServers` member has no wrapper, so its map is
 *  the top-level object. The result is empty when there is no map to read.
 *  Of two members with one name, only the last stays, as `JSON.parse` keeps the last. */
export function serverMembers(body: ValueNode, kind: McpFileKind): MemberNode[] {
  if (body.type !== 'Object') {
    return []
  }
  const wrapper = lastMember(body, 'mcpServers')
  let members: MemberNode[] = []
  if (wrapper === undefined) {
    members = kind === 'plugin' ? body.members : []
  } else if (wrapper.value.type === 'Object') {
    members = wrapper.value.members
  }
  return lastMembers(members)
}

/** The members of `members` that stay when two members have one name: the last of each name,
 *  in file order, as `JSON.parse` keeps it. */
export function lastMembers(members: readonly MemberNode[]): MemberNode[] {
  const last = new Map<string, MemberNode>()
  for (const member of members) {
    last.set(keyOf(member.name), member)
  }
  return members.filter((member) => last.get(keyOf(member.name)) === member)
}

/** The string declarations in the `mcpServers` member of a `plugin.json` whose top-level value is
 *  `manifest`: the value when it is a string, and each string item when it is an array. The docs
 *  give a path to a `.json` file, a path or URL of an MCP bundle, and an inline map, and an array
 *  can mix them. An inline map is not a string, so it is not in the result. Of two `mcpServers`
 *  members, only the last counts, as `JSON.parse` keeps the last.
 *  (https://code.claude.com/docs/en/plugins/manifest-reference#mcpservers) */
export function declaredMcpStrings(manifest: ValueNode): Extract<ValueNode, { type: 'String' }>[] {
  const declared = lastMember(manifest, 'mcpServers')?.value
  if (declared === undefined) {
    return []
  }
  const items = declared.type === 'Array' ? declared.elements.map(({ value }) => value) : [declared]
  return items.filter(
    (item): item is Extract<ValueNode, { type: 'String' }> => item.type === 'String',
  )
}

/** The top-level value of the JSON file `file`, read as an AST so that the readers of this file
 *  and of `lsp-servers.ts` serve a file on disk as they serve a linted file. The result is null
 *  when the rule cannot see the file: it is not there, it fails to read, its real path is out of
 *  `bound`, or it does not parse (ADR 001, Decision 14). The AST comes from the parsed value, so
 *  the positions in it are not the positions in the file. A report uses them in no case. */
export function readJsonBody(file: string, bound: string): ValueNode | null {
  const parsed = readJson(file, bound)
  if (parsed === null || parsed === UNREADABLE || parsed.data === undefined) {
    return null
  }
  // A value nested deeper than the stringifier or the parser accepts is a file that the rule
  // cannot see. A failed parse has no `ast`, so the read of it throws and ends here too.
  try {
    const result = json.languages.json.parse(
      { body: JSON.stringify(parsed.data), path: file, physicalPath: file, bom: false },
      { languageOptions: {} },
    )
    return (result as { ast: { body: ValueNode } }).ast.body
  } catch {
    return null
  }
}

/** The file and the real path of the `.json` file that a plugin manifest names with `declared`.
 *  The result is null when the path is not a plain `./` path to a `.json` file, and when the
 *  file is not there. A link to a file out of the plugin directory is not read, as Claude Code
 *  loads no path that leaves the plugin.
 *  (https://code.claude.com/docs/en/plugins/manifest-reference#path-rules) */
function declaredFile(root: string, declared: string): { file: string; real: string } | null {
  if (
    pathFault(declared) !== undefined ||
    declared.includes('\\') ||
    !declared.startsWith('./') ||
    !declared.endsWith('.json')
  ) {
    return null
  }
  const realRoot = realOf(root)
  const file = path.resolve(root, declared)
  const real = realOf(file)
  if (typeof realRoot !== 'string' || typeof real !== 'string' || !isInside(real, realRoot)) {
    return null
  }
  return { file, real }
}

/** One server that a plugin declares. `member` holds the name and the config. `node` is where a
 *  report goes: the name in the manifest for an inline server, the path for a server of a
 *  declared file, and the name in the file for a server of the root file. `from` tells where the
 *  server is declared, for a message. */
export interface Declaration {
  readonly name: string
  readonly member: MemberNode
  readonly node: ValueNode | MemberNode['name']
  readonly from: string
}

/** What differs between the server kinds of a plugin: the manifest key, the file at the plugin
 *  root, and the members of the map in a file. */
export interface DeclarationKind {
  readonly key: 'mcpServers' | 'lspServers'
  readonly rootFile: string
  readonly fileMembers: (body: ValueNode) => MemberNode[]
  /** The members of the map in the file at the plugin root. */
  readonly rootMembers: (body: ValueNode) => MemberNode[]
}

/** The servers that the plugin at `root` declares, in the order that Claude Code loads them: the
 *  file at the plugin root, then each value of the manifest key. A value is a `.json` path, or an
 *  inline map, and an array mixes them. A bundle, a URL and a file that the rule cannot read add
 *  nothing, so a report rests on the files that read. A name that one source repeats is one
 *  server, as `JSON.parse` keeps the last. `manifest` is the top-level value of `plugin.json`,
 *  or null for a plugin with no manifest.
 *  (https://code.claude.com/docs/en/plugins/manifest-reference#mcpservers) */
export function pluginDeclarations(
  root: string,
  manifest: ValueNode | null,
  kind: DeclarationKind,
): Declaration[] {
  const declarations: Declaration[] = []
  const add = (members: MemberNode[], from: string, at?: ValueNode) => {
    for (const member of members) {
      declarations.push({ name: keyOf(member.name), member, node: at ?? member.name, from })
    }
  }
  const body = readJsonBody(path.join(root, kind.rootFile), repositoryRoot(root))
  add(body === null ? [] : kind.rootMembers(body), kind.rootFile)
  // The rule reads a file once, also when the manifest names it twice, with the path of the root
  // file, or through a link. Only a path that the rule accepts counts as read.
  const read = new Set<string>()
  const rootReal = realOf(path.join(root, kind.rootFile))
  if (typeof rootReal === 'string') {
    read.add(rootReal)
  }
  const declared = manifest === null ? undefined : lastMember(manifest, kind.key)?.value
  const items =
    declared?.type === 'Array' ? declared.elements.map(({ value }) => value) : [declared]
  for (const item of items) {
    if (item?.type === 'String') {
      const target = declaredFile(root, item.value)
      if (target === null || read.has(target.real)) {
        continue
      }
      read.add(target.real)
      const file = readJsonBody(target.file, repositoryRoot(root))
      add(file === null ? [] : kind.fileMembers(file), item.value, item)
    } else if (item?.type === 'Object') {
      add(lastMembers(item.members), 'an inline map')
    }
  }
  return declarations
}

const MCP_KIND: DeclarationKind = {
  key: 'mcpServers',
  rootFile: '.mcp.json',
  fileMembers: (body) => serverMembers(body, 'plugin'),
  rootMembers: (body) => serverMembers(body, 'plugin'),
}

/** The MCP servers that the plugin at `root` declares, in load order. */
export const pluginMcpDeclarations = (root: string, manifest: ValueNode | null): Declaration[] =>
  pluginDeclarations(root, manifest, MCP_KIND)

/** One server of a file that a rule lints. `member` holds the name and the config. `pinned` is
 *  the node that takes every report for a server of a declared file: the path in the manifest.
 *  It is undefined when the node of the server can take the report. */
export interface LintedServer {
  readonly name: string
  readonly member: MemberNode
  readonly pinned?: ValueNode | MemberNode['name']
}

/** The servers of the file `filename`, whose top-level value is `body`. A `.mcp.json` gives the
 *  members of its map. A `plugin.json` gives the servers that it declares, inline or in a `.json`
 *  file. It leaves out the `.mcp.json` at the plugin root. That file has its own lint run, so no
 *  server gets two reports. A `.mcp.json` path that Claude Code never reads gives an empty result.
 *  A source that the rule cannot read gives none too (ADR 001, Decision 14). */
export function lintedServers(filename: string, body: ValueNode): LintedServer[] {
  if (path.basename(filename) === 'plugin.json') {
    const root = path.dirname(path.dirname(path.resolve(filename)))
    return pluginMcpDeclarations(root, body)
      .filter(({ from }) => from !== MCP_KIND.rootFile)
      .map(({ name, member, node }) => ({
        name,
        member,
        pinned: node === member.name ? undefined : node,
      }))
  }
  const kind = mcpFileKind(filename)
  return kind === null
    ? []
    : serverMembers(body, kind).map((member) => ({ name: keyOf(member.name), member }))
}

/** The declarations that repeat a name which an earlier source declares, each with the `from` of
 *  the first declaration of that name. */
export function repeatedDeclarations(
  declarations: readonly Declaration[],
): { declaration: Declaration; earlier: string }[] {
  const first = new Map<string, string>()
  return declarations.flatMap((declaration) => {
    const earlier = first.get(declaration.name)
    if (earlier === undefined) {
      first.set(declaration.name, declaration.from)
      return []
    }
    return [{ declaration, earlier }]
  })
}

/** The parsed value of the string, array or object `node`. Another value is undefined, because
 *  the policy and approval lists hold strings, arrays and objects only. Of two members with one
 *  name, the last stays, as `JSON.parse` keeps it. */
export function plainOf(node: ValueNode): unknown {
  if (node.type === 'String') {
    return node.value
  }
  if (node.type === 'Array') {
    return node.elements.map(({ value }) => plainOf(value))
  }
  if (node.type === 'Object') {
    return Object.fromEntries(
      lastMembers(node.members).map((m) => [keyOf(m.name), plainOf(m.value)]),
    )
  }
  return undefined
}

/** A key that tells one valid policy entry from another, or undefined for an entry that Claude
 *  Code strips. A valid entry is an object with one key: `serverName` with a string that matches
 *  the allowlist pattern, `serverUrl` with a string, or `serverCommand` with an array of strings.
 *  A name that the pattern rejects is no allowlist entry, so it cannot overlap with a denylist
 *  entry. `mcp-policy-entry-schema` reports it.
 *  (https://code.claude.com/docs/en/settings-reference#allowedmcpservers) */
export function policyKey(entry: unknown): string | undefined {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    return undefined
  }
  const [pair, ...others] = Object.entries(entry)
  if (pair === undefined || others.length > 0) {
    return undefined
  }
  const [key, value] = pair
  if (key === 'serverUrl' && typeof value === 'string') {
    return `url:${value}`
  }
  if (
    key === 'serverCommand' &&
    Array.isArray(value) &&
    value.every((v) => typeof v === 'string')
  ) {
    return `command:${JSON.stringify(value)}`
  }
  return key === 'serverName' && typeof value === 'string' && SERVER_NAME_PATTERN.test(value)
    ? `name:${value}`
    : undefined
}

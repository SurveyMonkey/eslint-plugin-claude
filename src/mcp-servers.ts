// The reader that the `.mcp.json` rules share. A rule asks where the file is, and gets
// the server entries of its map. The map is the `mcpServers` object. A plugin `.mcp.json`
// may omit that wrapper, so its map is the top-level object.
// (https://code.claude.com/docs/en/plugins/components#mcp-servers)
import path from 'node:path'
import { keyOf, lastMember, type MemberNode, type ValueNode } from './marketplace-json.ts'
import { isPluginRoot } from './plugin-root.ts'
import { UNREADABLE } from './skill-tree.ts'

/** The `type` values of a server that connects over the network. A `url` belongs to these. */
export const REMOTE_SERVER_TYPES: readonly string[] = ['http', 'streamable-http', 'sse', 'ws']

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

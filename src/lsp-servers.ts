// The reader that the LSP rules share. A rule asks for the server configs of a file, and gets
// the members of its map: a server name and its config. Claude Code reads LSP servers from
// `.lsp.json` at the plugin root, and from the `lspServers` key of `plugin.json`. The key takes
// an inline map, a path to a `.json` file, or an array of those. A path is not read here.
// (https://code.claude.com/docs/en/plugins-reference#lspservers)
import path from 'node:path'
import { lastMember, type MemberNode, type ValueNode } from './marketplace-json.ts'
import { lastMembers } from './mcp-servers.ts'
import { isPluginRoot } from './plugin-root.ts'

/** The members of an inline map of server name to config. The result is empty for a value
 *  that is not an object. */
const mapMembers = (value: ValueNode): MemberNode[] =>
  value.type === 'Object' ? lastMembers(value.members) : []

/** True when the file `filename` sits at a plugin root. The result is false when the
 *  plugin-root check cannot read the directory (ADR 001, Decision 14). */
export const atPluginRoot = (filename: string): boolean =>
  isPluginRoot(path.dirname(path.resolve(filename))) === true

/** The server members of the file `filename`, whose top-level value is `body`. For a
 *  `.lsp.json`, the members of the top-level object, and only when the file sits at a plugin
 *  root. For a `plugin.json`, the members of the inline maps of `lspServers`. */
export function lspServerMembers(body: ValueNode, filename: string): MemberNode[] {
  if (path.basename(filename) === 'plugin.json') {
    const declared = lastMember(body, 'lspServers')?.value
    if (declared === undefined) {
      return []
    }
    return declared.type === 'Array'
      ? declared.elements.flatMap(({ value }) => mapMembers(value))
      : mapMembers(declared)
  }
  return atPluginRoot(filename) ? mapMembers(body) : []
}

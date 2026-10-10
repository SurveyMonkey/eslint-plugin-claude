// Where an MCP server rule runs: a project `.mcp.json`, a plugin `.mcp.json`, and the manifest of
// a plugin. The files are on disk, so the helpers use `Linter` and a repository with `.git`.
import path from 'node:path'
import { repo } from './agent-settings.test-support.ts'
import { lintJson } from './rule-tester.test-support.ts'

/** The message ids of `messages`. */
export const ids = (messages: { messageId?: string | null }[]) => messages.map((m) => m.messageId)

/** Lint `code` as the `.mcp.json` of a project, or as the file at `at` in the project. */
export function lintProject(name: string, code: string, at = '.mcp.json') {
  return lintJson(name, code, path.join(repo({}), at))
}

/** Lint `code` as the `.mcp.json` at the root of a plugin. */
export function lintPluginFile(name: string, code: string) {
  const root = repo({ 'p/.claude-plugin/plugin.json': '{}' })
  return lintJson(name, code, path.join(root, 'p', '.mcp.json'))
}

/** Lint `code` as the manifest of the plugin `p`, in a repository with `files`. */
export function lintManifest(name: string, code: string, files: Record<string, string> = {}) {
  const root = repo(files)
  return lintJson(name, code, path.join(root, 'p', '.claude-plugin', 'plugin.json'))
}

/** The text of a server map that holds `servers`, with the `mcpServers` wrapper. */
export const mapOf = (servers: unknown) => JSON.stringify({ mcpServers: servers })

// A repository with a local agent scope, a plugin with the default `agents/` folder, and a plugin
// whose manifest key `agents` names its files. The three rules of the description layer lint the
// same three places, so the places are in one file.
import path from 'node:path'
import { lintAgent } from './agent-rules.test-support.ts'
import { repo } from './agent-settings.test-support.ts'

/** The plugin `p` has the default `agents/` folder. The plugin `q` names `custom/a.md`. */
const PLUGINS = {
  'plugins/p/.claude-plugin/plugin.json': '{"name":"p"}',
  'plugins/q/.claude-plugin/plugin.json': JSON.stringify({ name: 'q', agents: ['./custom/a.md'] }),
}

/** The places of an agent file in a repository that holds `PLUGINS`. */
export const PLACES = {
  local: '.claude/agents/a.md',
  subfolder: '.claude/agents/team/a.md',
  plugin: 'plugins/p/agents/a.md',
  manifest: 'plugins/q/custom/a.md',
} as const

/** The messages of the rule `name` for `code` at `place` of a new repository with `files`. */
export function lintAt(
  name: string,
  code: string,
  place: string = PLACES.local,
  files: Record<string, string> = {},
  options: unknown[] = [],
) {
  const root = repo({ ...PLUGINS, ...files })
  return lintAgent(name, code, path.join(root, place), options)
}

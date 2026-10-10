// A hook that names a tool, a subagent or an MCP server that does not exist never fires, and Claude Code does
// not warn (docs/rules/hooks-matcher-name-unresolved.md). The rule checks three names:
// - a value of a tool-event matcher, against the tools of the tools reference;
// - a value of a `SubagentStart` or `SubagentStop` matcher, against the built-in agents and the agent files of the
//   repository;
// - the `server` of an `mcp_tool` handler, against the `.mcp.json` files of the repository.
// The agent and server checks rest on an absence, so they read inside the repository only (ADR 001, Decision 14).
// They report nothing for a kind of name when a sibling cannot be read, or when the repository holds no source of
// that kind of name. The `allow` option names what lives outside the repository, such as a user-level agent.
import path from 'node:path'
import type { Rule } from 'eslint'
import { TOOL_EVENTS } from '../data/hook-events.ts'
import {
  BUILT_IN_AGENTS,
  MCP_PREFIX,
  OTHER_RULE_TOOL_NAMES,
  TOOL_NAMES,
} from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import {
  exactValues,
  groupsOf,
  HOOKS_TARGET,
  hooksListener,
  memberOf,
  stringOf,
} from '../hooks-config.ts'
import { kindOf } from '../settings-files.ts'
import {
  danglingOf,
  entriesOf,
  frontmatterOfFile,
  isInside,
  markdownFiles,
  readJson,
  realDirectory,
  realOf,
  repositoryRoot,
  UNREADABLE,
} from '../skill-tree.ts'

const name = 'hooks-matcher-name-unresolved' as const

const SUBAGENT_EVENTS = ['SubagentStart', 'SubagentStop']

interface Options {
  allow: string[]
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** `dir` and each directory above it, up to `top`. The walk goes up the path as given, and compares the real path
 *  of each directory with `top`, so that a project directory that is a link does not hide `top`. */
function ancestors(dir: string, top: string): string[] {
  const parent = path.dirname(dir)
  return realDirectory(dir) === top || parent === dir ? [dir] : [dir, ...ancestors(parent, top)]
}

/** The directories that hold no agent file and can be very large. */
const SKIPPED = new Set(['.git', 'node_modules'])

/** True when `entry` is a link with no target. */
const isDangling = (entry: string) => realOf(entry) === null && danglingOf(entry) === UNREADABLE

/** True when `dir` holds, at any depth, a link with no target. The scan of the agents folder skips such a link
 *  without a flag, and the link can hold any agent: a file link or a folder link, with any name. */
function hasDanglingLink(dir: string, bound: string, seen = new Set<string>()): boolean {
  const real = realOf(dir)
  const entries =
    typeof real === 'string' && !seen.has(real) && isInside(real, bound) ? entriesOf(dir) : null
  if (typeof real === 'string') {
    seen.add(real)
  }
  return (
    Array.isArray(entries) &&
    entries
      .filter((entry) => !SKIPPED.has(entry.name))
      .some((entry) => {
        const full = path.join(dir, entry.name)
        return (
          isDangling(full) ||
          ((entry.isDirectory() || entry.isSymbolicLink()) && hasDanglingLink(full, bound, seen))
        )
      })
  )
}

/** True when an agent could hide behind a link with no target in the agents folder of `dir`: the link is
 *  `.claude`, `.claude/agents`, or an entry below. */
function agentsHidden(dir: string, bound: string): boolean {
  const claude = path.join(dir, '.claude')
  const agents = path.join(claude, 'agents')
  return isDangling(claude) || isDangling(agents) || hasDanglingLink(agents, bound)
}

/** Claude Code skips an agent file with no `name`, a `name` that starts with `-`, holds `:` or is longer than 256
 *  characters, or no `description`, and a file whose YAML does not parse (sub-agents, "Subagent files Claude Code
 *  skips"). Such a file defines no agent. */
function agentNameOf(fields: Record<string, unknown> | null): string | undefined {
  const agent = fields?.name
  return typeof agent === 'string' &&
    typeof fields?.description === 'string' &&
    !agent.startsWith('-') &&
    !agent.includes(':') &&
    agent.length <= 256
    ? agent
    : undefined
}

/** The `name` of each agent file in `.claude/agents/` of `project` and of each folder above it. The result is
 *  undefined when a path cannot be read, when a link with no target can hide an agent, or when no agent file
 *  exists. */
function agentNames(project: string, claude: string): string[] | undefined {
  const top = repositoryRoot(project)
  const bound = repositoryRoot(claude)
  const names: string[] = []
  for (const dir of ancestors(project, top)) {
    const scan = markdownFiles(path.join(dir, '.claude', 'agents'), bound)
    if (scan.outside || scan.unreadable || agentsHidden(dir, bound)) {
      return undefined
    }
    for (const file of scan.files) {
      const fields = frontmatterOfFile(file)
      if (fields === UNREADABLE) {
        return undefined
      }
      const agent = agentNameOf(fields)
      if (agent !== undefined) {
        names.push(agent)
      }
    }
  }
  return names.length > 0 ? names : undefined
}

/** The server names in the `.mcp.json` file of `project` and of each folder above it. The result is undefined when
 *  a file cannot be read or has an unexpected shape, or when no folder holds the file. */
function serverNames(project: string, claude: string): string[] | undefined {
  const top = repositoryRoot(project)
  const bound = repositoryRoot(claude)
  const names: string[] = []
  let found = false
  for (const dir of ancestors(project, top)) {
    const parsed = readJson(path.join(dir, '.mcp.json'), bound)
    if (parsed === null) {
      continue
    }
    const data = parsed === UNREADABLE ? undefined : parsed.data
    if (!isObject(data) || (data.mcpServers !== undefined && !isObject(data.mcpServers))) {
      return undefined
    }
    names.push(...Object.keys(data.mcpServers ?? {}))
    found = true
  }
  return found ? names : undefined
}

/** A function that calls `read` on the first call, and gives its result on each call. */
function lazy<T>(read: () => T): () => T {
  let value: { result: T } | undefined
  return () => {
    value ??= { result: read() }
    return value.result
  }
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Name a tool, a subagent and an MCP server that exist in a hook',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: [] }],
    messages: {
      tool: 'The matcher value "{{segment}}" is not the name of a tool that Claude Code knows, so it matches no tool.',
      agent:
        'No file in ".claude/agents/" defines an agent named "{{segment}}", and it is no built-in agent. The matcher matches no subagent.',
      server:
        '".mcp.json" defines no MCP server named "{{segment}}", so this hook has no server to call.',
    },
  },
  create(context) {
    const [{ allow }] = context.options as [Options]
    const file = path.resolve(context.filename)
    const claude = path.dirname(file)
    const project = path.dirname(claude)
    // Only a project settings file has a project folder, with a `.claude/agents/` folder and a `.mcp.json` to read.
    const readsRepository = kindOf(file) !== 'managed' && path.basename(claude) === '.claude'
    const folded = (names: readonly string[]) => [...names, ...allow].map((n) => n.toLowerCase())
    const tools = folded([...TOOL_NAMES, ...OTHER_RULE_TOOL_NAMES, 'advisor'])

    return hooksListener(context, (source) => {
      const inRepository = source.kind === 'settings' && readsRepository
      const agents = lazy(() => agentNames(project, claude))
      const servers = lazy(() => serverNames(project, claude))

      for (const { event, matcher, handlers } of groupsOf(source)) {
        // A value with another character is a regular expression, which no check reads.
        const segments =
          matcher === undefined
            ? []
            : (exactValues(matcher.value, false) ?? []).map((segment) => ({
                segment,
                loc: matcher.loc,
              }))
        for (const { segment, loc } of segments) {
          // A case variant and the advisor tool are for `hooks-matcher-never-matches`. A server name is for
          // `hooks-matcher-mcp-name`.
          if (
            TOOL_EVENTS.includes(event) &&
            !tools.includes(segment.toLowerCase()) &&
            !segment.startsWith(MCP_PREFIX)
          ) {
            context.report({ loc, messageId: 'tool', data: { segment } })
          }
          if (inRepository && SUBAGENT_EVENTS.includes(event)) {
            const known = agents()
            if (
              known !== undefined &&
              !folded([...BUILT_IN_AGENTS, ...known]).includes(segment.toLowerCase())
            ) {
              context.report({ loc, messageId: 'agent', data: { segment } })
            }
          }
        }
        for (const handler of inRepository ? handlers : []) {
          const value = memberOf(handler, 'server')?.value
          if (stringOf(handler, 'type') !== 'mcp_tool' || value?.kind !== 'string') {
            continue
          }
          const known = servers()
          // A plugin-scoped name, `plugin:<plugin>:<server>`, is not a name of the repository.
          if (
            known !== undefined &&
            !value.value.includes(':') &&
            ![...known, ...allow].includes(value.value)
          ) {
            context.report({ loc: value.loc, messageId: 'server', data: { segment: value.value } })
          }
        }
      }
    })
  },
}

export default { name, ...HOOKS_TARGET, rule }

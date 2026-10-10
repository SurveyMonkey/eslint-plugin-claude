// The number of servers with `alwaysLoad: true` (docs/rules/mcp-always-load-count.md). Each loads
// all its tools upfront. Startup can wait for it for up to five seconds by default. The MCP page
// says to use it for "a small number of tools" and gives no number. So the option `max` has the
// default 2 of the inventory row, and the message names the configured limit.
// A plugin declares servers in `.mcp.json`, in `.json` files that the manifest names and inline,
// and the sources add up. A source that the rule cannot read can replace a server of an earlier
// source (the last name wins). So the rule is silent when it cannot read a source that it would
// count (ADR 001, Decision 14). The message says "At least", as the row states: a server of
// another scope can add to the count. The report is on an `alwaysLoad: true` of the linted file.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type ValueNode } from '../marketplace-json.ts'
import {
  jsonBodyState,
  type LintedServer,
  lintedServers,
  mcpFileKind,
  pluginMcpSources,
} from '../mcp-servers.ts'
import { repositoryRoot, UNREADABLE } from '../skill-tree.ts'

const name = 'mcp-always-load-count' as const

// The default of `max`. The docs give no number.
const DEFAULT_MAX = 2

type Options = [{ max: number }]

/** The `alwaysLoad` value of the server entry `entry` when it is the Boolean `true`. */
const flagOf = (entry: ValueNode) => {
  const flag = lastMember(entry, 'alwaysLoad')?.value
  return flag?.type === 'Boolean' && flag.value ? flag : undefined
}

/** A server that loads with the linted file, and whether the linted file holds it. */
type Source = LintedServer & { own: boolean }

/** The servers that load with the linted file `filename`, in load order, and whether the rule
 *  read every source that it would count. A project file stands alone. A plugin file adds the
 *  other sources of its plugin. The linted `.mcp.json` is read from its text, and not from disk. */
function serversOf(filename: string, body: ValueNode): { servers: Source[]; complete: boolean } {
  const own = lintedServers(filename, body).map((server) => ({ ...server, own: true }))
  const manifestFile = path.basename(filename) === 'plugin.json'
  if (!manifestFile && mcpFileKind(filename) !== 'plugin') {
    return { servers: own, complete: true }
  }
  const root = manifestFile
    ? path.dirname(path.dirname(path.resolve(filename)))
    : path.dirname(path.resolve(filename))
  const manifest = manifestFile
    ? body
    : jsonBodyState(path.join(root, '.claude-plugin', 'plugin.json'), repositoryRoot(root))
  if (manifest === UNREADABLE) {
    return { servers: own, complete: false }
  }
  // The linted file stands for its own sources. The others come from disk.
  const sources = pluginMcpSources(root, manifest)
  const others = sources.declarations
    .filter(({ from }) => manifestFile === (from === '.mcp.json'))
    .map(({ name: server, member }) => ({ name: server, member, own: false }))
  // The file at the plugin root loads first.
  return {
    servers: manifestFile ? [...others, ...own] : [...own, ...others],
    complete: sources.complete,
  }
}

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: 'tooMany' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Limit the MCP servers that load all their tools upfront with alwaysLoad',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { max: { type: 'integer', minimum: 0 } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ max: DEFAULT_MAX }],
    messages: {
      tooMany:
        'At least {{count}} servers set `alwaysLoad: true` in the configs that the rule read. The configured limit is {{max}}. Each of these servers loads all its tools upfront, and startup can wait for it for up to 5 seconds by default.',
    },
  },
  create(context) {
    const [{ max }] = context.options
    return {
      Document(node) {
        // Of two servers with one name, the last counts, as Claude Code replaces the earlier one.
        const effective = new Map<string, Source>()
        const { servers, complete } = serversOf(context.filename, node.body)
        // A source that the rule cannot read can replace a flagged server by its name, so the
        // readable sources do not prove a count.
        if (!complete) {
          return
        }
        for (const server of servers) {
          effective.set(server.name, server)
        }
        const flagged = [...effective.values()].flatMap((server) => {
          const flag = flagOf(server.member.value)
          return flag === undefined ? [] : [{ server, flag }]
        })
        const first = flagged.find(({ server }) => server.own)
        if (flagged.length > max && first !== undefined) {
          context.report({
            node: first.server.pinned ?? first.flag,
            messageId: 'tooMany',
            data: { count: String(flagged.length), max: String(max) },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.mcp.json', '**/.claude-plugin/plugin.json'],
  rule,
}

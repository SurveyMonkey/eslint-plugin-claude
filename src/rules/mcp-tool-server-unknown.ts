// A tool reference `mcp__<server>` that names a server which the repository does not declare
// (docs/rules/mcp-tool-server-unknown.md). The permissions page says that an MCP rule uses the
// server name as configured. The rule reads the permission rules of the project settings files,
// and the `allowed-tools` and `disallowed-tools` of skills and commands. A project file uses the
// servers of the `.mcp.json` beside `.claude/` and the inline servers of the local agents. A file
// of a plugin uses the scoped names of its own plugin (`mcp__plugin_<plugin>_<server>`), as the MCP
// page gives them. The rule rests on an absence, so it makes no report when a source cannot be
// read. A user-scope server and a connector are not in the repository, so the rule is a
// heuristic: it reports no connector name and no name of another plugin (ADR 001, Decision 14).
import path from 'node:path'
import type { Rule } from 'eslint'
import {
  MCP_CONNECTOR_PREFIX,
  MCP_COWORK_SERVER,
  MCP_PLUGIN_PREFIX,
  MCP_PREFIX,
  MCP_SEPARATOR,
} from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { jsonBodyState, pluginMcpSources, sanitizeName, serverMembers } from '../mcp-servers.ts'
import { parsedEntries } from '../permission-entries.ts'
import { permissionListener, SETTINGS_FILES, SKILL_TARGET } from '../permission-listener.ts'
import { kindOf } from '../settings-files.ts'
import { classifySkillFile } from '../skill-files.ts'
import {
  frontmatterOfFile,
  markdownFiles,
  repositoryRoot,
  scopeRoot,
  UNREADABLE,
} from '../skill-tree.ts'

const name = 'mcp-tool-server-unknown' as const

/** The server names that a scope declares, and where the rule read them. The names are the
 *  forms that a tool reference can hold. */
interface Known {
  forms: Set<string>
  where: string
  /** The start of the server names that this scope owns. It is empty for a project, which owns
   *  every name but a plugin name. */
  prefix: string
  scoped: boolean
}

/** The inline servers in the `mcpServers` list of a local agent file. A string in the list
 *  refers to another server, so it declares none. */
function inlineNames(fields: Record<string, unknown>): string[] {
  const list = fields.mcpServers
  return Array.isArray(list)
    ? list.flatMap((item) =>
        item !== null && typeof item === 'object' && !Array.isArray(item) ? Object.keys(item) : [],
      )
    : []
}

/** The servers of the project at `project`: the `mcpServers` of its `.mcp.json`, and the inline
 *  servers of the agent files in `.claude/agents`. The result is null when a source cannot be
 *  read, or when there is no `.mcp.json` with an `mcpServers` object to rest on. A file that
 *  fails to parse as frontmatter declares none. */
function projectServers(project: string): Known | null {
  const bound = repositoryRoot(project)
  const body = jsonBodyState(path.join(project, '.mcp.json'), bound)
  if (
    body === null ||
    body === UNREADABLE ||
    lastMember(body, 'mcpServers')?.value.type !== 'Object'
  ) {
    return null
  }
  const names = serverMembers(body, 'project').map(({ name: key }) => keyOf(key))
  const scan = markdownFiles(path.join(project, '.claude', 'agents'), bound)
  if (scan.unreadable || scan.outside) {
    return null
  }
  for (const file of scan.files) {
    const fields = frontmatterOfFile(file)
    if (fields === UNREADABLE) {
      return null
    }
    names.push(...inlineNames(fields ?? {}))
  }
  const forms = new Set(names.flatMap((server) => [server, sanitizeName(server)]))
  return { forms, where: 'the .mcp.json of the project', prefix: '', scoped: false }
}

/** The servers of the plugin at `root`, by their scoped names. The result is null when the
 *  manifest has no name that the rule can read, or when a source cannot be read. */
function pluginServers(root: string): Known | null {
  const manifest = jsonBodyState(
    path.join(root, '.claude-plugin', 'plugin.json'),
    repositoryRoot(root),
  )
  if (manifest === null || manifest === UNREADABLE) {
    return null
  }
  const pluginName = lastMember(manifest, 'name')?.value
  if (pluginName?.type !== 'String' || pluginName.value === '') {
    return null
  }
  const sources = pluginMcpSources(root, manifest)
  if (!sources.complete) {
    return null
  }
  const prefix = `${MCP_PLUGIN_PREFIX}${sanitizeName(pluginName.value)}_`
  const forms = new Set(
    sources.declarations.flatMap(({ name: server }) =>
      sanitizeName(server) === '' ? [] : [`${prefix}${sanitizeName(server)}`],
    ),
  )
  return { forms, where: `the plugin "${pluginName.value}"`, prefix, scoped: true }
}

/** The declared servers of the scope of the file `filename`, or null when the file is not in a
 *  scope that the rule reads. */
function scopeOf(filename: string): (() => Known | null) | null {
  if (!filename.endsWith('.md')) {
    // A managed file is for a machine, and not for one project.
    return kindOf(filename) === 'managed'
      ? null
      : () => projectServers(path.dirname(path.dirname(filename)))
  }
  const info = classifySkillFile(filename)
  if (info === null) {
    return null
  }
  const root = scopeRoot(filename, info)
  return info.plugin ? () => pluginServers(root) : () => projectServers(path.dirname(root))
}

/** The server part of the tool name `tool`, or undefined when the reference is not one that this
 *  rule reads: not an MCP name, a name with no server, a glob in the server part, or a server
 *  that no repository file declares (a connector, or Cowork). */
function serverOf(tool: string): string | undefined {
  if (!tool.startsWith(MCP_PREFIX)) {
    return undefined
  }
  const rest = tool.slice(MCP_PREFIX.length)
  const server = rest.split(MCP_SEPARATOR, 1)[0] as string
  const outside =
    server === '' ||
    server.includes('*') ||
    server === MCP_COWORK_SERVER ||
    server.startsWith(MCP_CONNECTOR_PREFIX)
  return outside ? undefined : rest
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Name only declared MCP servers in a tool reference',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unknown:
        'The tool "{{tool}}" names the server "{{server}}", which {{where}} does not declare. If the server comes from user scope or a connector, the rule cannot see it. Otherwise fix the name.',
    },
  },
  create(context) {
    const read = scopeOf(path.resolve(context.filename))
    if (read === null) {
      return {}
    }
    // The sources are read once, and only when the file holds an MCP reference.
    let known: Known | null | undefined
    return permissionListener(context, (entries) => {
      for (const { loc, rule: parsed } of parsedEntries(entries)) {
        const rest = serverOf(parsed.tool)
        if (rest === undefined) {
          continue
        }
        known = known === undefined ? read() : known
        // A project judges no plugin name, and a plugin judges the names of its own plugin only.
        const owned = known?.scoped
          ? rest.startsWith(known.prefix)
          : !rest.startsWith(MCP_PLUGIN_PREFIX)
        if (known === null || !owned) {
          continue
        }
        const declared = [...known.forms].some(
          (form) => rest === form || rest.startsWith(`${form}${MCP_SEPARATOR}`),
        )
        if (!declared) {
          const server = (rest.split(MCP_SEPARATOR, 1)[0] as string).slice(known.prefix.length)
          context.report({
            loc,
            messageId: 'unknown',
            data: { tool: parsed.tool, server, where: known.where },
          })
        }
      }
    })
  },
}

export default {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  // The same rule, for the files that the Markdown language reads.
  also: SKILL_TARGET,
  rule,
}

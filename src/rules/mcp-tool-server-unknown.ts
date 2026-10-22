// A tool reference `mcp__<server>` that names a server which the repository does not declare
// (docs/rules/mcp-tool-server-unknown.md). The permissions page says that an MCP rule names the
// server as its tool names do: a character outside `A-Za-z0-9_-` becomes `_`. The rule reads the permission rules of the project settings files,
// and the `allowed-tools` and `disallowed-tools` of skills and commands. A project file uses the
// servers of the `.mcp.json` beside `.claude/` and the inline servers of the local agents. A file
// of a plugin uses the scoped names of its own plugin (`mcp__plugin_<plugin>_<server>`), as the MCP
// page gives them. The rule rests on an absence, so it makes no report when a source cannot be
// read. A user-scope server and a connector are not in the repository, so the rule is a
// heuristic: it reports no connector name and no name of another plugin (ADR 001, Decision 14).
import { readFileSync } from 'node:fs'
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
 *  forms of the tool names, with `_` for each character outside `A-Za-z0-9_-`. */
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

/** True when the file at `file` starts a frontmatter block. A read that fails counts as true. */
function startsBlock(file: string): boolean {
  try {
    return /^\uFEFF?---[ \t]*\r?\n/.test(readFileSync(file, 'utf8'))
  } catch {
    return true
  }
}

/** The servers of the project at `project`: the `mcpServers` of its `.mcp.json`, and the inline
 *  servers of the agent files in `.claude/agents`. The result is null when a source cannot be
 *  read, or when there is no `.mcp.json` with an `mcpServers` object to rest on. A file with no
 *  frontmatter block declares none. A file that starts a block that gives no fields is skipped by
 *  Claude Code if the YAML does not parse. The YAML parser of the rule can differ from the parser
 *  of Claude Code, so the result is null (ADR 001, Decision 14). */
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
    if (fields === null && startsBlock(file)) {
      return null
    }
    names.push(...inlineNames(fields ?? {}))
  }
  const forms = new Set(names.map(sanitizeName))
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

/** True when the rest `rest` of a tool name, after `mcp__`, matches a name of `forms`. A tool
 *  name and a wildcard match by prefix. Claude Code reads `mcp__reports__v2` as a rule for the
 *  server `reports`. In an allow rule, the bare name of a server matches only when the name has
 *  no `__` and does not end in `_`. In a deny or ask rule, `mcp__reports__v2` and `mcp__reports`
 *  also cover each tool of the server `reports__v2`. */
function matches(rest: string, forms: Set<string>, allowRule: boolean): boolean {
  return [...forms].some((form) =>
    allowRule
      ? rest.startsWith(`${form}${MCP_SEPARATOR}`) ||
        (rest === form && !form.includes(MCP_SEPARATOR) && !form.endsWith('_'))
      : rest === form ||
        rest.startsWith(`${form}${MCP_SEPARATOR}`) ||
        form.startsWith(`${rest}${MCP_SEPARATOR}`),
  )
}

/** The tool name to write in place of `mcp__<rest>`, or undefined when the rule knows none. It
 *  gives the server part with `_` for each character outside `A-Za-z0-9_-`. Else it gives the
 *  wildcard form of a declared name that is that server part, or starts with it and `__`. */
function hintOf(rest: string, forms: Set<string>, allowRule: boolean): string | undefined {
  const server = rest.split(MCP_SEPARATOR, 1)[0] as string
  const fixed = `${sanitizeName(server)}${rest.slice(server.length)}`
  if (fixed !== rest && matches(fixed, forms, allowRule)) {
    return `${MCP_PREFIX}${fixed}`
  }
  const whole = [...forms].find(
    (form) => form === fixed || form.startsWith(`${fixed}${MCP_SEPARATOR}`),
  )
  return whole === undefined ? undefined : `${MCP_PREFIX}${whole}${MCP_SEPARATOR}*`
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
      hint: 'The tool "{{tool}}" names the server "{{server}}", which {{where}} does not declare. Write "{{hint}}" for the declared server.',
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
      for (const { list, loc, rule: parsed } of parsedEntries(entries)) {
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
        const allowRule = list === 'allow'
        if (!matches(rest, known.forms, allowRule)) {
          const server = (rest.split(MCP_SEPARATOR, 1)[0] as string).slice(known.prefix.length)
          const hint = hintOf(rest, known.forms, allowRule)
          const data = { tool: parsed.tool, server, where: known.where }
          context.report(
            hint === undefined
              ? { loc, messageId: 'unknown', data }
              : { loc, messageId: 'hint', data: { ...data, hint } },
          )
        }
      }
    })
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  // The same rule, for the files that the Markdown language reads.
  also: SKILL_TARGET,
}

export default rule

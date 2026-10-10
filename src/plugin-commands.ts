// The commands that a shell runs, in the files of a plugin that a rule can
// lint: the manifest, `hooks/hooks.json`, `.mcp.json` and
// `monitors/monitors.json`. A rule asks here for the shell-form hook commands,
// the monitor commands and the MCP `headersHelper` strings of one file. This
// reader is the small one of the plugin layer. The hooks and MCP layers have
// readers of their own, and a later change can merge them.
//
// A file that the manifest names (`"hooks": "./h.json"`) is not read here. The
// rule that lints that file by its own name reads it. The same holds for the
// monitors file that `experimental.monitors` names.
import path from 'node:path'
import type { DocumentNode, ObjectNode, ValueNode } from './marketplace-json.ts'
import { lastMember } from './marketplace-json.ts'
import { type Plugin, readPluginAt, type StringNode } from './plugin-manifest.ts'

/** What a command is: a shell-form hook `command`, a monitor `command`, or an
 *  MCP `headersHelper`. */
type CommandKind = 'hook' | 'monitor' | 'headersHelper'

export interface PluginCommand {
  readonly kind: CommandKind
  readonly node: StringNode
}

type FileRole = 'manifest' | 'hooks' | 'mcp' | 'monitors'

// The name of each file and its folder. `.mcp.json` sits in the plugin root, so it has no folder.
const FILES: readonly { name: string; folder: string | undefined; role: FileRole }[] = [
  { name: 'plugin.json', folder: '.claude-plugin', role: 'manifest' },
  { name: 'hooks.json', folder: 'hooks', role: 'hooks' },
  { name: '.mcp.json', folder: undefined, role: 'mcp' },
  { name: 'monitors.json', folder: 'monitors', role: 'monitors' },
]

/** The role of `file` and its plugin. The result is undefined when `file` is
 *  none of the four files at the place that the docs give, or when the plugin
 *  is unseen (see `readPluginAt`). */
export function pluginFileOf(file: string): { role: FileRole; plugin: Plugin } | undefined {
  const full = path.resolve(file)
  const dir = path.dirname(full)
  const entry = FILES.find(
    ({ name, folder }) =>
      name === path.basename(full) && (folder === undefined || folder === path.basename(dir)),
  )
  const plugin =
    entry === undefined
      ? undefined
      : readPluginAt(entry.folder === undefined ? dir : path.dirname(dir))
  return entry === undefined || plugin === undefined ? undefined : { role: entry.role, plugin }
}

/** The string commands in a monitors array: the `command` of each object. */
function monitorsOf(value: ValueNode | undefined): PluginCommand[] {
  return value?.type !== 'Array'
    ? []
    : value.elements.flatMap(({ value: entry }) => {
        const command = lastMember(entry, 'command')?.value
        return command?.type === 'String' ? [{ kind: 'monitor' as const, node: command }] : []
      })
}

/** The shell-form command hooks of an event map. A hook is in shell form when it
 *  has no `args` member. */
function hooksOf(value: ValueNode | undefined): PluginCommand[] {
  if (value?.type !== 'Object') {
    return []
  }
  return value.members
    .flatMap((event) => (event.value.type === 'Array' ? event.value.elements : []))
    .flatMap(({ value: group }) => {
      const handlers = lastMember(group, 'hooks')?.value
      return handlers?.type === 'Array' ? handlers.elements : []
    })
    .flatMap(({ value: handler }) => {
      const command = lastMember(handler, 'command')?.value
      const type = lastMember(handler, 'type')?.value
      return type?.type === 'String' &&
        type.value === 'command' &&
        command?.type === 'String' &&
        lastMember(handler, 'args') === undefined
        ? [{ kind: 'hook' as const, node: command }]
        : []
    })
}

/** The `headersHelper` strings of a map of MCP servers. */
function serversOf(value: ValueNode | undefined): PluginCommand[] {
  if (value?.type !== 'Object') {
    return []
  }
  return value.members.flatMap((server) => {
    const helper = lastMember(server.value, 'headersHelper')?.value
    return helper?.type === 'String' ? [{ kind: 'headersHelper' as const, node: helper }] : []
  })
}

/** The objects that a manifest key holds inline: the object itself, or each
 *  object of an array. A string path in an array is a file that the manifest
 *  names. */
function inlineOf(value: ValueNode | undefined): ObjectNode[] {
  if (value?.type === 'Object') {
    return [value]
  }
  return value?.type === 'Array'
    ? value.elements.flatMap(({ value: element }) => (element.type === 'Object' ? [element] : []))
    : []
}

/** True when the manifest `fields` replace `monitors/monitors.json`: a
 *  `monitors` or `experimental.monitors` key that names no path, or a path to
 *  another file. A key that names the default file leaves it in force. */
function replacesMonitorsFile(plugin: Plugin): boolean {
  const experimental = plugin.fields.experimental as { monitors?: unknown } | null | undefined
  const keys = [plugin.fields.monitors, experimental?.monitors]
  const standard = path.join(plugin.root, 'monitors', 'monitors.json')
  return keys.some(
    (key) =>
      key !== undefined &&
      !(typeof key === 'string' && path.resolve(plugin.root, key) === standard),
  )
}

/** The commands of the file with the role `role` and the plugin `plugin`, in
 *  file order for each kind. */
export function commandsOf(
  role: FileRole,
  document: DocumentNode,
  plugin: Plugin,
): PluginCommand[] {
  const body = document.body
  switch (role) {
    case 'manifest': {
      const experimental = lastMember(body, 'experimental')?.value
      return [
        ...inlineOf(lastMember(body, 'hooks')?.value).flatMap(hooksOf),
        ...inlineOf(lastMember(body, 'mcpServers')?.value).flatMap(serversOf),
        ...monitorsOf(lastMember(experimental, 'monitors')?.value),
        ...monitorsOf(lastMember(body, 'monitors')?.value),
      ]
    }
    case 'hooks':
      return hooksOf(lastMember(body, 'hooks')?.value)
    case 'mcp':
      return serversOf(lastMember(body, 'mcpServers')?.value)
    case 'monitors':
      return replacesMonitorsFile(plugin) ? [] : monitorsOf(body)
  }
}

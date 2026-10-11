// A tool reference `mcp__plugin_<plugin>_<server>` names a server that a plugin provides
// (docs/rules/permissions-mcp-server-exists.md). The plugin must be enabled for the server to
// exist, so the rule reads `enabledPlugins` in the two project settings files. The MCP page gives
// the form of the name, and replaces each character outside `A-Z`, `a-z`, `0-9`, `_` and `-` with
// `_`. `mcp-tool-server-unknown` owns every other `mcp__<server>` name of a project file, so this
// rule reads the plugin names that it leaves. The rule is a heuristic: a plugin can be enabled in
// a user or managed file, which the repository does not hold (ADR 001, Decision 14). It makes no
// report when a project file lists no `enabledPlugins`, or when a sibling file cannot be read.
import type { JSONRuleDefinition } from '@eslint/json'
import { MCP_PLUGIN_PREFIX, MCP_PREFIX, MCP_SEPARATOR } from '../data/tool-names.ts'
import { docsUrl } from '../docs-url.ts'
import { sanitizeName } from '../mcp-servers.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { at, isObject, sourceOf } from '../permission-source.ts'
import { kindOf } from '../settings-files.ts'

const name = 'permissions-mcp-server-exists' as const

/** The names of the plugins that `enabledPlugins` of `objects` does not set to `false`, or null
 *  when no file lists `enabledPlugins`. A key is `plugin-name@marketplace-name`. */
function enabledNames(objects: readonly Record<string, unknown>[]): string[] | null {
  const lists = objects.map((object) => at(object, ['enabledPlugins'])).filter(isObject)
  if (lists.length === 0) {
    return null
  }
  return lists.flatMap((list) =>
    Object.entries(list).flatMap(([key, value]) => {
      const plugin = key.includes('@') ? key.slice(0, key.lastIndexOf('@')) : key
      return value === false || plugin === '' ? [] : [sanitizeName(plugin)]
    }),
  )
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'unknown' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Name only servers of enabled plugins in an mcp__plugin_ tool reference',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unknown:
        'The tool "{{tool}}" names the server "{{server}}" of a plugin, and no "enabledPlugins" entry of the two project settings files enables a plugin with a matching name. If the plugin comes from user or managed settings, the rule cannot see it. A plugin with no entry can also be on through "defaultEnabled" in its manifest. Otherwise enable the plugin, or fix the name.',
    },
  },
  create(context) {
    // A managed file is for a machine, and not for one project.
    if (kindOf(context.filename) === 'managed') {
      return {}
    }
    return settingsListener(context, (entries) => {
      const found = entries.flatMap(({ loc, rule: parsed }) => {
        if (!parsed.tool.startsWith(MCP_PREFIX)) {
          return []
        }
        const server = parsed.tool.slice(MCP_PREFIX.length).split(MCP_SEPARATOR, 1)[0] as string
        const isPluginServer =
          server.startsWith(MCP_PLUGIN_PREFIX) &&
          server.length > MCP_PLUGIN_PREFIX.length &&
          !server.includes('*')
        return isPluginServer ? [{ loc, tool: parsed.tool, server }] : []
      })
      if (found.length === 0) {
        return
      }
      const { objects, complete } = sourceOf(context.filename, context.sourceCode.text)
      const enabled = complete ? enabledNames(objects) : null
      if (enabled === null) {
        return
      }
      for (const { loc, tool, server } of found) {
        // The plugin name and the server name can both hold `_`, so one name can be read in more
        // than one way. The rule accepts every plugin name that fits the start.
        const isKnown = enabled.some((plugin) =>
          server.startsWith(`${MCP_PLUGIN_PREFIX}${plugin}_`),
        )
        if (!isKnown) {
          context.report({ loc, messageId: 'unknown', data: { tool, server } })
        }
      }
    })
  },
}

export default {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  rule,
}

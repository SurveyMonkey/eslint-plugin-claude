// On macOS and Linux, Claude Code rejects a component path that has a backslash in it, even when
// the path stays inside the plugin (docs/rules/plugin-path-no-backslash.md). The rule reads each
// component key of `plugin.json` that names paths. It makes no report when it cannot see the
// plugin. `marketplace-entry-component-paths` owns the paths of a marketplace entry.
import type { JSONRuleDefinition } from '@eslint/json'
import { PLUGIN_PATH_KEYS } from '../data/plugin-layout.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type MemberNode, type ValueNode } from '../marketplace-json.ts'
import { pathNodes, readPlugin, type StringNode } from '../plugin-manifest.ts'

const name = 'plugin-path-no-backslash' as const

// The `mcpServers` key also takes the URL of a bundle (manifest reference, "Path rules").
const URL_START = /^https?:\/\//

/** The member at the manifest path `key`, or undefined. The last of two members wins. */
function memberAt(body: ValueNode, key: readonly string[]): MemberNode | undefined {
  let member: MemberNode | undefined
  let value: ValueNode | undefined = body
  for (const part of key) {
    member = lastMember(value, part)
    value = member?.value
  }
  return member
}

/** The strings of a key value that name paths: a string, the strings of an array, and for an
 *  object map the `source` of each entry. An inline object names no path. */
function pathsOf(value: ValueNode, map: boolean): StringNode[] {
  if (value.type === 'Object') {
    return map
      ? value.members.flatMap((entry) => {
          const source = lastMember(entry.value, 'source')?.value
          return source?.type === 'String' ? [source] : []
        })
      : []
  }
  return pathNodes(value)
}

const rule: JSONRuleDefinition<{ MessageIds: 'backslash' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write the component paths of plugin.json with forward slashes',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      backslash:
        'The `{{key}}` path "{{path}}" has a backslash. On macOS and Linux, Claude Code rejects it, so the component loads on Windows only. Write the path with forward slashes, such as ./commands/deploy.md.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        if (plugin === undefined) {
          return
        }
        for (const { key, map } of PLUGIN_PATH_KEYS) {
          const url = key.join('.') === 'mcpServers'
          const value = memberAt(node.body, key)?.value
          for (const entry of value === undefined ? [] : pathsOf(value, map)) {
            if (entry.value.includes('\\') && !(url && URL_START.test(entry.value))) {
              context.report({
                node: entry,
                messageId: 'backslash',
                data: { key: key.join('.'), path: entry.value },
              })
            }
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/plugin.json'],
  rule,
}

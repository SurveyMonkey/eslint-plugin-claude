// A manifest key that replaces a default folder makes Claude Code skip that
// folder, unless a path of the key is inside it
// (docs/rules/plugin-default-dir-shadowed.md). The rule reports such a key when
// the folder is in the plugin. It reads the spelling of each path, as Claude
// Code does for its warning, and makes no report when it cannot see the folder.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { REPLACED_DEFAULTS } from '../data/plugin-layout.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type MemberNode, type ValueNode } from '../marketplace-json.ts'
import { locate, pathNodes, readPlugin } from '../plugin-manifest.ts'
import { entriesOf, isInside } from '../skill-tree.ts'

const name = 'plugin-default-dir-shadowed' as const

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

/** The paths that a key value names: a string, the strings of an array, and the
 *  `source` of each entry of an object map (`commands`). An inline entry, such
 *  as a monitor, or an entry with `content` names no path. */
function pathsOf(value: ValueNode): string[] {
  if (value.type === 'Object') {
    return value.members.flatMap((member) => {
      const source = lastMember(member.value, 'source')?.value
      return source?.type === 'String' ? [source.value] : []
    })
  }
  return pathNodes(value).map((node) => node.value)
}

const SHAPES = new Set<ValueNode['type']>(['String', 'Array', 'Object'])

const rule: JSONRuleDefinition<{ MessageIds: 'shadowed' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Point a manifest key that replaces a default folder at a path inside the folder',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      shadowed:
        '`{{key}}` replaces the default `{{folder}}/` folder, so Claude Code ignores that folder. List a path inside it, or add `./{{folder}}/` to `{{key}}`.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        if (plugin === undefined) {
          return
        }
        for (const { key, folder } of REPLACED_DEFAULTS) {
          const member = memberAt(node.body, key)
          if (member === undefined || !SHAPES.has(member.value.type)) {
            continue
          }
          const root = path.join(plugin.root, folder)
          const inside = pathsOf(member.value).some((text) =>
            isInside(path.resolve(plugin.root, text), root),
          )
          // The folder is in the plugin when `locate` finds it and it lists as a directory.
          const found = locate(plugin, `./${folder}`)
          if (!inside && typeof found === 'string' && Array.isArray(entriesOf(found))) {
            context.report({
              node: member,
              messageId: 'shadowed',
              data: { key: key.join('.'), folder },
            })
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

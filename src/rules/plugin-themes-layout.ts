// A plugin theme is a file `themes/<slug>.json` in the custom theme format (docs/rules/plugin-themes-layout.md).
// The format has three optional fields: `name`, `base` and `overrides`. The rule reads the theme
// files in `themes/` of a plugin. It makes no report when the manifest replaces the folder scan, or
// when it cannot see the plugin.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { THEME_BASES } from '../data/plugin-layout.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { readPluginAt } from '../plugin-manifest.ts'

const name = 'plugin-themes-layout' as const

// The presets as an English list: "dark", "light" and so on, with "or" before the last one.
const QUOTED = THEME_BASES.map((base) => `"${base}"`)
const BASE_LIST = `${QUOTED.slice(0, -1).join(', ')} or ${QUOTED.at(-1)}`

const rule: JSONRuleDefinition<{ MessageIds: 'shape' | 'name' | 'base' | 'overrides' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write a plugin theme file in the custom theme format',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      shape:
        'The theme file must hold a JSON object. Its fields are `name`, `base` and `overrides`, and each is optional.',
      name: 'The theme field `name` must be a string. `/theme` shows it as the label of the theme.',
      base: 'The theme field `base` must be one of {{bases}}. It names the preset that the theme starts from.',
      overrides:
        'The theme field `overrides` must be an object that maps a color token to a color value.',
    },
  },
  create(context) {
    const file = path.resolve(context.filename)
    const folder = path.dirname(file)
    return {
      Document(node) {
        if (path.basename(folder) !== 'themes') {
          return
        }
        const plugin = readPluginAt(path.dirname(folder))
        const experimental = plugin?.fields.experimental as { themes?: unknown } | null | undefined
        // Either key replaces the scan of `themes/`, so a file there may not be a theme.
        if (
          plugin === undefined ||
          plugin.fields.themes !== undefined ||
          experimental?.themes !== undefined
        ) {
          return
        }
        if (node.body.type !== 'Object') {
          context.report({ node: node.body, messageId: 'shape' })
          return
        }
        const theme = node.body
        for (const member of theme.members) {
          const key = keyOf(member.name)
          // The last of two members with one name is the one that JSON.parse keeps.
          if (lastMember(theme, key) !== member) {
            continue
          }
          const { value } = member
          if (key === 'name' && value.type !== 'String') {
            context.report({ node: value, messageId: 'name' })
          } else if (
            key === 'base' &&
            !(value.type === 'String' && THEME_BASES.includes(value.value))
          ) {
            context.report({
              node: value,
              messageId: 'base',
              data: { bases: BASE_LIST },
            })
          } else if (key === 'overrides' && value.type !== 'Object') {
            context.report({ node: value, messageId: 'overrides' })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/themes/*.json'],
  rule,
}

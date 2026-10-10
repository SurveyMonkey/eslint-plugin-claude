// A plugin that a marketplace entry serves from an `npm` source ships `npm-shrinkwrap.json`,
// because npm leaves `package-lock.json` out of a published package
// (docs/rules/plugin-npm-source-shrinkwrap.md). The rule finds the entry by the name of the
// plugin. It makes no report when it cannot see the marketplace or a file of the plugin.
import type { JSONRuleDefinition } from '@eslint/json'
import { PLUGIN_SOURCE_TYPES } from '../data/marketplace-source-types.ts'
import { docsUrl } from '../docs-url.ts'
import { enclosingMarketplace, entriesIn } from '../marketplace-file.ts'
import { lastMember } from '../marketplace-json.ts'
import { isPluginFile, readPlugin } from '../plugin-manifest.ts'

const name = 'plugin-npm-source-shrinkwrap' as const

/** True when `source`, the `source` value of an entry, is an object with the type `npm`. */
const isNpm = (source: unknown) =>
  source !== null &&
  typeof source === 'object' &&
  (source as { source?: unknown }).source === PLUGIN_SOURCE_TYPES.npm

const rule: JSONRuleDefinition<{ MessageIds: 'missing' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ship npm-shrinkwrap.json with a plugin that a marketplace serves from npm',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      missing:
        'The marketplace entry "{{name}}" has an `npm` source, and the plugin has a `package.json` but no `npm-shrinkwrap.json`. npm leaves `package-lock.json` out of a published package, so Claude Code finds no lockfile and skips the dependency install. Add `npm-shrinkwrap.json`.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        const named = lastMember(node.body, 'name')?.value
        if (plugin === undefined || named?.type !== 'String') {
          return
        }
        const marketplace = enclosingMarketplace(plugin)
        if (marketplace === undefined) {
          return
        }
        const entries = entriesIn(marketplace)
        if (
          entries === undefined ||
          !entries.some((e) => e.name === named.value && isNpm(e.source))
        ) {
          return
        }
        // A plugin with no `package.json` has no packages to lock.
        // A file that the rule cannot see could be the shrinkwrap.
        if (
          isPluginFile(plugin, 'package.json') === true &&
          isPluginFile(plugin, 'npm-shrinkwrap.json') === false &&
          // Claude Code reads a `bun.lock`. The rule trusts it and does not check its version.
          isPluginFile(plugin, 'bun.lock') === false
        ) {
          context.report({ node: named, messageId: 'missing', data: { name: named.value } })
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

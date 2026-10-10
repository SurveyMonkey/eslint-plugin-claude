// A dependency of a plugin resolves in the marketplace of the plugin, or in another
// marketplace that the root marketplace allows (docs/rules/plugin-dependencies-resolve.md). The
// rule reads the `plugin.json` dependencies and the `marketplace.json` that encloses the plugin.
// It makes no report when it cannot see the plugin or that file.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { enclosingMarketplace, entriesIn } from '../marketplace-file.ts'
import { lastMember, type ValueNode } from '../marketplace-json.ts'
import { readPlugin } from '../plugin-manifest.ts'

const name = 'plugin-dependencies-resolve' as const

/** The plugin `name` of a dependency, and the `marketplace` it names. A
 *  string is `name` or `name@marketplace`. An object has `name` and
 *  `marketplace` members. The result is undefined for a value that is neither,
 *  and for an object with a `name` or `marketplace` that is not a string. */
function dependencyOf(
  value: ValueNode,
): { name: string; marketplace: string | undefined } | undefined {
  if (value.type === 'String') {
    const at = value.value.indexOf('@')
    return at > 0
      ? { name: value.value.slice(0, at), marketplace: value.value.slice(at + 1) }
      : { name: value.value, marketplace: undefined }
  }
  const named = lastMember(value, 'name')?.value
  const market = lastMember(value, 'marketplace')?.value
  if (named?.type !== 'String' || (market !== undefined && market.type !== 'String')) {
    return undefined
  }
  return { name: named.value, marketplace: market?.value }
}

const rule: JSONRuleDefinition<{ MessageIds: 'missing' | 'refused' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Name only dependencies that the marketplace of the plugin resolves',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      missing:
        'The dependency "{{name}}" is not in "plugins" of the marketplace "{{marketplace}}". Claude Code looks it up there, so it cannot install the dependency.',
      refused:
        'The dependency "{{name}}" is in the marketplace "{{target}}". "allowCrossMarketplaceDependenciesOn" in the marketplace "{{marketplace}}" does not list it, so Claude Code does not install the dependency.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        const dependencies = lastMember(node.body, 'dependencies')?.value
        if (plugin === undefined || dependencies?.type !== 'Array') {
          return
        }
        const marketplace = enclosingMarketplace(plugin)
        if (marketplace === undefined) {
          return
        }
        const entries = entriesIn(marketplace)
        const own = marketplace.name
        // The messages need the name of the marketplace. A missing name is for the marketplace rules.
        if (entries === undefined || typeof own !== 'string') {
          return
        }
        const listed = new Set(entries.map((entry) => entry.name))
        const allowed = marketplace.allowCrossMarketplaceDependenciesOn
        for (const { value } of dependencies.elements) {
          const dependency = dependencyOf(value)
          if (dependency === undefined) {
            continue
          }
          const { name: target, marketplace: market } = dependency
          if (market === undefined || market === own) {
            if (!listed.has(target)) {
              context.report({
                node: value,
                messageId: 'missing',
                data: { name: target, marketplace: own },
              })
            }
            // A list that is not an array is for the marketplace rules.
          } else if (
            allowed === undefined ||
            (Array.isArray(allowed) && !allowed.includes(market))
          ) {
            context.report({
              node: value,
              messageId: 'refused',
              data: { name: target, target: market, marketplace: own },
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

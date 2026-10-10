// Claude Code never installs a dependency with a `command` source, and never runs the
// `headersHelper` of a dependency, so users install such a dependency first
// (docs/rules/plugin-dependencies-not-auto-installed.md). The rule reads the `dependencies` of
// `plugin.json` and the entry of each dependency in the `marketplace.json` that encloses the
// plugin. It reads that marketplace only, so a dependency in another marketplace gives no report.
// It makes no report when it cannot see the plugin or that file.
import type { JSONRuleDefinition } from '@eslint/json'
import { PLUGIN_SOURCE_TYPES } from '../data/marketplace-source-types.ts'
import { docsUrl } from '../docs-url.ts'
import { enclosingMarketplace, entriesIn } from '../marketplace-file.ts'
import { lastMember } from '../marketplace-json.ts'
import { readPlugin } from '../plugin-manifest.ts'
import { dependencyOf } from './plugin-dependencies-resolve.ts'

const name = 'plugin-dependencies-not-auto-installed' as const

const rule: JSONRuleDefinition<{ MessageIds: 'command' | 'headersHelper' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not rely on Claude Code to install a dependency with a command source',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      command:
        'The dependency "{{name}}" has a command source in its marketplace entry. Claude Code never installs it, so users install it first.',
      headersHelper:
        'The marketplace entry of the dependency "{{name}}" sets a "headersHelper". Claude Code never runs it for a dependency, so users install the dependency before they install this plugin.',
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
        const entries = marketplace === undefined ? undefined : entriesIn(marketplace)
        const named = lastMember(node.body, 'name')?.value
        // The rule links a plugin to its entry by name, as `plugin-dependencies-resolve` does.
        // With no such entry, it cannot tell which marketplace serves the plugin.
        if (
          marketplace === undefined ||
          entries === undefined ||
          named?.type !== 'String' ||
          !entries.some((entry) => entry.name === named.value)
        ) {
          return
        }
        for (const { value } of dependencies.elements) {
          const dependency = dependencyOf(value)
          // A dependency in another marketplace has no entry in this repository.
          if (
            dependency === undefined ||
            (dependency.marketplace !== undefined && dependency.marketplace !== marketplace.name)
          ) {
            continue
          }
          const [entry, second] = entries.filter((other) => other.name === dependency.name)
          // With two entries of one name, the rule cannot tell which one counts.
          if (entry === undefined || second !== undefined) {
            continue
          }
          const source = entry.source
          if (
            source !== null &&
            typeof source === 'object' &&
            (source as Record<string, unknown>).source === PLUGIN_SOURCE_TYPES.command
          ) {
            context.report({ node: value, messageId: 'command', data: { name: dependency.name } })
          }
          if (typeof entry.headersHelper === 'string' && entry.headersHelper !== '') {
            context.report({
              node: value,
              messageId: 'headersHelper',
              data: { name: dependency.name },
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

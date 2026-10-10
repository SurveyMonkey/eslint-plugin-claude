// Claude Code installs the dependencies of a plugin with `--ignore-scripts`, so the `preinstall`,
// `install` and `postinstall` scripts never run (docs/rules/plugin-package-lifecycle-scripts.md).
// The rule reads the `package.json` at a plugin root. It makes no report for a `package.json` below
// the plugin root, or when it cannot see the plugin.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { readPluginAt } from '../plugin-manifest.ts'

const name = 'plugin-package-lifecycle-scripts' as const

// The scripts that `--ignore-scripts` keeps from running. Source: the loading page, "Limits on the
// dependency install".
const LIFECYCLE = ['preinstall', 'install', 'postinstall']

const rule: JSONRuleDefinition<{ MessageIds: 'ignored' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not rely on a lifecycle script in the package.json of a plugin',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      ignored:
        'Claude Code runs the dependency install of a plugin with `--ignore-scripts`, so the `{{script}}` script never runs. Run the step before you publish the plugin, or from a hook.',
    },
  },
  create(context) {
    const file = path.resolve(context.filename)
    return {
      Document(node) {
        const scripts = lastMember(node.body, 'scripts')?.value
        if (
          scripts?.type !== 'Object' ||
          path.basename(file) !== 'package.json' ||
          readPluginAt(path.dirname(file)) === undefined
        ) {
          return
        }
        for (const member of scripts.members) {
          const script = keyOf(member.name)
          // The last of two members with one name is the one that JSON.parse keeps.
          if (
            LIFECYCLE.includes(script) &&
            member.value.type === 'String' &&
            lastMember(scripts, script) === member
          ) {
            context.report({ node: member.name, messageId: 'ignored', data: { script } })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/package.json'],
  rule,
}

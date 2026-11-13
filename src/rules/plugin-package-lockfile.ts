// Claude Code installs the dependencies of a plugin only when the plugin root
// holds a `package.json` and a lockfile that it reads
// (docs/rules/plugin-package-lockfile.md). The rule reports a plugin that has
// a lockfile that Claude Code skips, and none that it reads. It makes no report
// when it cannot see one of the files.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { isPluginFile, readPlugin } from '../plugin-manifest.ts'

const name = 'plugin-package-lockfile' as const

// The lockfiles that Claude Code reads, and the ones that it skips. Source: the
// loading page, "When the dependency install runs".
export const READ = ['bun.lock', 'npm-shrinkwrap.json', 'package-lock.json']
const SKIPPED_LOCKFILES = ['bun.lockb', 'pnpm-lock.yaml', 'yarn.lock']

const rule: JSONRuleDefinition<{ MessageIds: 'unsupported' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ship a lockfile that Claude Code reads with the package.json of a plugin',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unsupported:
        'The plugin has a `package.json` and {{files}}, but none of `bun.lock`, `npm-shrinkwrap.json` or `package-lock.json`. Claude Code reads only those lockfiles, so it skips the dependency install. Add an npm lockfile.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        if (plugin === undefined || isPluginFile(plugin, 'package.json') !== true) {
          return
        }
        // A lockfile that the rule cannot see could be one that Claude Code reads.
        if (READ.some((file) => isPluginFile(plugin, file) !== false)) {
          return
        }
        const found = SKIPPED_LOCKFILES.filter((file) => isPluginFile(plugin, file) === true)
        if (found.length > 0) {
          context.report({
            node,
            messageId: 'unsupported',
            data: { files: found.map((file) => `\`${file}\``).join(', ') },
          })
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/plugin.json'],
}

export default rule

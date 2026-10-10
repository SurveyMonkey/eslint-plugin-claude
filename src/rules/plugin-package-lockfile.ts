// Claude Code installs the dependencies of a plugin only when the plugin root
// holds a `package.json` and a lockfile that it reads
// (docs/rules/plugin-package-lockfile.md). The rule reports a plugin that has
// a lockfile that Claude Code skips, and none that it reads. It makes no report
// when it cannot see one of the files.
import { Stats } from 'node:fs'
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { realSource } from '../marketplace-source.ts'
import { type Plugin, readPlugin } from '../plugin-manifest.ts'
import { statOf } from '../skill-tree.ts'

const name = 'plugin-package-lockfile' as const

// The lockfiles that Claude Code reads, and the ones that it skips. Source: the
// loading page, "When the dependency install runs".
const READ = ['bun.lock', 'npm-shrinkwrap.json', 'package-lock.json']
const SKIPPED_LOCKFILES = ['bun.lockb', 'pnpm-lock.yaml', 'yarn.lock']

/** True when `file` at the plugin root is a file, false when it is not there or
 *  is another kind of entry, and undefined when the rule cannot see it. A part
 *  of the path can be a link with no target, or have a real path out of the
 *  repository. */
function isFile(plugin: Plugin, file: string): boolean | undefined {
  const real = realSource(plugin.root, plugin.realRoot, plugin.bound, path.join(plugin.root, file))
  if (typeof real !== 'string') {
    return real.kind === 'missing' ? false : undefined
  }
  const stat = statOf(real)
  return stat instanceof Stats && stat.isFile()
}

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
        if (plugin === undefined || isFile(plugin, 'package.json') !== true) {
          return
        }
        // A lockfile that the rule cannot see could be one that Claude Code reads.
        if (READ.some((file) => isFile(plugin, file) !== false)) {
          return
        }
        const found = SKIPPED_LOCKFILES.filter((file) => isFile(plugin, file) === true)
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

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/plugin.json'],
  rule,
}

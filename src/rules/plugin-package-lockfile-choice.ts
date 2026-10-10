// Claude Code reads one lockfile of a plugin: the first match in the order of `READ`. It runs the
// package manager of that lockfile, and does not run another one when that manager is missing
// (docs/rules/plugin-package-lockfile-choice.md). The rule reports a plugin with more than one
// lockfile that Claude Code reads, and a plugin with `bun.lock` and no npm lockfile. It makes no
// report when it cannot see one of the files, because the first match could be the unseen one.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { isPluginFile, readPlugin } from '../plugin-manifest.ts'
import { READ } from './plugin-package-lockfile.ts'

const name = 'plugin-package-lockfile-choice' as const

const BUN = 'bun.lock'

/** The names in `files` in code font, joined as an English list. */
function listOf(files: string[]): string {
  const quoted = files.map((file) => `\`${file}\``)
  return quoted.length > 2
    ? `${quoted.slice(0, -1).join(', ')} and ${quoted.at(-1)}`
    : quoted.join(' and ')
}

const rule: JSONRuleDefinition<{ MessageIds: 'several' | 'bunOnly' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Ship one lockfile with the package.json of a plugin, and prefer an npm lockfile',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      several:
        'The plugin has {{files}}. Claude Code reads only the first match, `{{first}}`, and ignores the others. Keep one lockfile, and prefer an npm lockfile.',
      bunOnly:
        'The plugin has `bun.lock` and no npm lockfile. Claude Code runs Bun for it, and does not run npm when Bun is missing. Add `package-lock.json` or `npm-shrinkwrap.json` to reach the most users.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        if (plugin === undefined) {
          return
        }
        const seen = new Map(
          ['package.json', ...READ].map((file) => [file, isPluginFile(plugin, file)]),
        )
        // A file that the rule cannot see could be the first match, or an npm lockfile.
        if (seen.get('package.json') !== true || [...seen.values()].includes(undefined)) {
          return
        }
        const found = READ.filter((file) => seen.get(file) === true)
        if (found.length > 1) {
          context.report({
            node,
            messageId: 'several',
            data: { files: listOf(found), first: found[0] },
          })
        } else if (found[0] === BUN) {
          context.report({ node, messageId: 'bunOnly' })
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

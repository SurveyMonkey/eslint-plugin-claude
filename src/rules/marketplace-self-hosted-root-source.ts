// A `marketplace.json` that sits beside a `plugin.json` publishes the plugin of
// its own repository. The docs say it has one entry whose `source` is the
// repository root (docs/rules/marketplace-self-hosted-root-source.md). The rule
// reads the `plugin.json` beside the file through `readManifest`, and makes no
// report when it cannot read it.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, pluginEntries, type ValueNode } from '../marketplace-json.ts'
import { readManifest, repositoryRoot, UNREADABLE } from '../skill-tree.ts'
import { pathFault } from './marketplace-relative-source-format.ts'

const name = 'marketplace-self-hosted-root-source' as const

/** True when `source` is a string that names the marketplace root: `"./"`,
 *  `"."` and their plain spellings. A path with a fault, or no text, is not
 *  the root. */
function isRoot(source: ValueNode | undefined): boolean {
  if (source?.type !== 'String') {
    return false
  }
  const text = source.value
  if (text === '' || pathFault(text) !== undefined) {
    return false
  }
  const plain = path.posix.normalize(text)
  return plain === '.' || plain === './'
}

const rule: JSONRuleDefinition<{ MessageIds: 'noRootEntry' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Give a marketplace beside a plugin.json an entry for the repository root',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      noRootEntry:
        'This marketplace.json sits beside a plugin.json, and no entry has the "source" "./". Add an entry for the plugin with the "source" "./" and the name from plugin.json.',
    },
  },
  create(context) {
    return {
      Document(node) {
        // A `plugins` value that is not an array is for `marketplace-schema`.
        const plugins = lastMember(node.body, 'plugins')?.value
        if (plugins?.type !== 'Array') {
          return
        }
        const root = path.dirname(path.dirname(path.resolve(context.filename)))
        const manifest = readManifest(root, repositoryRoot(root))
        // No `plugin.json`, or one that the rule cannot read: the file is not a self-hosted one.
        if (manifest === null || manifest === UNREADABLE) {
          return
        }
        if (!pluginEntries(node).some((entry) => isRoot(lastMember(entry, 'source')?.value))) {
          context.report({ node: plugins, messageId: 'noRootEntry' })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/marketplace.json'],
  rule,
}

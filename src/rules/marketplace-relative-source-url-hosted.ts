// A marketplace that users add as a bare `marketplace.json` URL gives Claude
// Code that file only. A relative `source` then fails at install
// (docs/rules/marketplace-relative-source-url-hosted.md). The rule finds the
// registration in the project settings files beside the marketplace root,
// through `declaredType`. It makes no report when it cannot read them.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { MARKETPLACE_SOURCE_TYPES } from '../data/marketplace-source-types.ts'
import { docsUrl } from '../docs-url.ts'
import { declaredType } from '../marketplace-file.ts'
import { lastMember, pluginEntries } from '../marketplace-json.ts'

const name = 'marketplace-relative-source-url-hosted' as const

const rule: JSONRuleDefinition<{ MessageIds: 'relativeInUrl' }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Give an entry of a URL-hosted marketplace a source that needs no marketplace files',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      relativeInUrl:
        'The "source" "{{path}}" is a relative path, and the settings register this marketplace as a "url" source. Claude Code downloads only marketplace.json, so the install fails. Use a "github" or "git-subdir" source.',
    },
  },
  create(context) {
    return {
      Document(node) {
        const market = lastMember(node.body, 'name')?.value
        if (market?.type !== 'String') {
          return
        }
        const root = path.dirname(path.dirname(path.resolve(context.filename)))
        if (declaredType(root, market.value) !== MARKETPLACE_SOURCE_TYPES.url) {
          return
        }
        for (const entry of pluginEntries(node)) {
          const source = lastMember(entry, 'source')?.value
          if (source?.type === 'String') {
            context.report({
              node: source,
              messageId: 'relativeInUrl',
              data: { path: source.value },
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
  files: ['**/.claude-plugin/marketplace.json'],
  rule,
}

// A `url` marketplace source with a `headersHelper` needs an `https://` URL.
// Claude Code does not run the command for another URL
// (docs/rules/settings-marketplace-headers-helper-https.md). The rule counts a
// `headersHelper` as set for any value. A `url` that is not a string is for
// `settings-extra-known-marketplaces-schema`.
import type { JSONRuleDefinition } from '@eslint/json'
import { MARKETPLACE_SOURCE_TYPES } from '../data/marketplace-source-types.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'

const name = 'settings-marketplace-headers-helper-https' as const

// A URL scheme is not case sensitive.
const HTTPS_URL = /^https:\/\//i

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'notHttps' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Give a url marketplace source that has a headersHelper an https:// URL',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notHttps:
        'The "url" of this marketplace source does not start with "https://", so Claude Code does not run its "headersHelper" command. Requests carry only the "headers".',
    },
  },
  create(context) {
    return {
      Document(node) {
        const marketplaces = lastMember(node.body, 'extraKnownMarketplaces')?.value
        if (marketplaces?.type !== 'Object') {
          return
        }
        for (const member of marketplaces.members) {
          // Two members with one name read as the last, as `JSON.parse` does.
          if (lastMember(marketplaces, keyOf(member.name)) !== member) {
            continue
          }
          const source = lastMember(member.value, 'source')?.value
          const type = lastMember(source, 'source')?.value
          const url = lastMember(source, 'url')?.value
          if (
            type?.type === 'String' &&
            type.value === MARKETPLACE_SOURCE_TYPES.url &&
            lastMember(source, 'headersHelper') !== undefined &&
            url?.type === 'String' &&
            !HTTPS_URL.test(url.value)
          ) {
            context.report({ node: url, messageId: 'notHttps' })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  rule,
}

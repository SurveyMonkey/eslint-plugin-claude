// A domain list that holds an entry twice has a redundant entry. An entry with a final dot, as
// `example.com.`, blocks the same connections as the one without it
// (docs/rules/sandbox-domain-duplicate.md). The rule reads one file, and each list alone.
// `sandbox-domain-overlap` owns a domain that both lists hold.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { domainParts, stringEntries, valueAt } from '../permission-sandbox.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'sandbox-domain-duplicate' as const

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'duplicate' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Write each domain once in an allowedDomains or deniedDomains list',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      duplicate: '`{{entry}}` repeats `{{first}}` in "{{list}}". Remove one of the two.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        for (const list of ['allowedDomains', 'deniedDomains']) {
          const seen = new Map<string, string>()
          for (const entry of stringEntries(valueAt(node, ['sandbox', 'network', list]))) {
            const { host, port } = domainParts(entry.value)
            const first = seen.get(`${host}${port}`)
            if (first === undefined) {
              seen.set(`${host}${port}`, entry.value)
            } else {
              context.report({
                node: entry,
                messageId: 'duplicate',
                data: { entry: entry.value, first, list },
              })
            }
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}

// A domain in `sandbox.network.deniedDomains` stays blocked although an `allowedDomains` entry
// matches it too, so that allowed entry never applies
// (https://code.claude.com/docs/en/settings-reference#sandbox-network-denieddomains). The rule
// adds up the lists of one source (`src/permission-source.ts`). It reads an equal host, with a
// denied entry that has no port or the same port (docs/rules/sandbox-domain-overlap.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { stringEntries, valueAt } from '../permission-sandbox.ts'
import { sourceOf, stringsAt } from '../permission-source.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'sandbox-domain-overlap' as const

/** The host and the port of a domain entry. The host is in lower case, with no trailing dot. */
function parts(entry: string): { host: string; port: string } {
  const match = /^(.*?)(:\d+)?$/.exec(entry) as RegExpExecArray
  return { host: (match[1] as string).replace(/\.$/, '').toLowerCase(), port: match[2] ?? '' }
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'overlap' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not allow a sandbox domain that deniedDomains also holds',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      overlap:
        '`{{entry}}` is in "deniedDomains" too. A denied domain stays blocked, so this allowed entry never applies.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const allowed = stringEntries(valueAt(node, ['sandbox', 'network', 'allowedDomains']))
        if (allowed.length === 0) {
          return
        }
        const objects = sourceOf(context.filename, context.sourceCode.text)
        const denied = stringsAt(objects, ['sandbox', 'network', 'deniedDomains']).map(parts)
        for (const entry of allowed) {
          const { host, port } = parts(entry.value)
          if (denied.some((d) => d.host === host && (d.port === '' || d.port === port))) {
            context.report({ node: entry, messageId: 'overlap', data: { entry: entry.value } })
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

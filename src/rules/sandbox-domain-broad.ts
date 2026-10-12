// An `allowedDomains` entry that allows every host (`*`) or a whole top-level domain (`*.com`)
// (docs/rules/sandbox-domain-broad.md). The security limitations warn that a broad allowed domain
// opens a path for exfiltration and domain fronting
// (https://code.claude.com/docs/en/sandboxing#security-limitations). That warning names
// `github.com`, and two docs examples use it, so the option `broad` lists the other hosts to
// report. `sandbox-domain-syntax` owns an entry with a scheme or a path: such an entry does not
// match the two forms below. A wildcard with a bad numeric port still reports here too.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { domainParts, stringEntries, valueAt } from '../permission-sandbox.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'sandbox-domain-broad' as const

type MessageId = 'wildcard' | 'listed'
type Options = [{ broad: string[] }]

/** A wildcard on one label: `*.com`. A name such as `*.co.uk` needs the public suffix list, and
 *  the docs give no rule for it, so it is not read. */
const TOP_LEVEL_WILDCARD = /^\*\.[^.*:/]+$/

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: MessageId }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not allow every host, or a whole top-level domain, in the sandbox',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          broad: {
            description: 'More hosts to report as broad.',
            type: 'array',
            items: { type: 'string', minLength: 1 },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ broad: [] }],
    messages: {
      wildcard:
        '`{{entry}}` allows a whole range of hosts. The proxy decides from the hostname the client gives, so code in the sandbox can use domain fronting to reach hosts that are not on the list. Allow the hosts that a tool needs.',
      listed:
        '`{{entry}}` is a host that the option "broad" marks as broad. The docs warn that a broad domain can open a path for data exfiltration through domain fronting. Allow a narrower host, or remove it from the option.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const [{ broad }] = context.options
    const listed = new Set(broad.map((entry) => domainParts(entry).host))
    return {
      Document(node) {
        for (const entry of stringEntries(
          valueAt(node, ['sandbox', 'network', 'allowedDomains']),
        )) {
          const { host } = domainParts(entry.value)
          if (host === '*' || TOP_LEVEL_WILDCARD.test(host)) {
            context.report({ node: entry, messageId: 'wildcard', data: { entry: entry.value } })
          } else if (listed.has(host)) {
            context.report({ node: entry, messageId: 'listed', data: { entry: entry.value } })
          }
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
}

export default rule

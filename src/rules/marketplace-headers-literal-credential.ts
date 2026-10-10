// A file in the repository must not hold a literal credential in the HTTP
// `headers` of a download (docs/rules/marketplace-headers-literal-credential.md).
// The rule reads the `headers` of an entry in `marketplace.json`. It also
// reads the `headers` of a `url` source in a project settings file. A message names the header, and never gives its value.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { MARKETPLACE_SOURCE_TYPES } from '../data/marketplace-source-types.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, pluginEntries, type ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'

const name = 'marketplace-headers-literal-credential' as const

// A header name that carries a credential. The docs name `Authorization`.
const CREDENTIAL_NAME = /auth|token|secret|key|passw|cred/i
// An authentication scheme and a token, as `Bearer abc`.
const SCHEME_TOKEN = /^(?:Bearer|Basic|Token|Digest)\s+\S/i
// An empty value, or a scheme word with no token.
const NO_TOKEN = /^(?:Bearer|Basic|Token|Digest)?\s*$/i
// A `${NAME}` reference, as the docs write `Bearer ${TOKEN}`.
const REFERENCE = /\$\{[^}]*\}/g

/** True when the header `header` has the literal credential `value`. A value
 *  with a `${NAME}` reference is not literal, unless a scheme and a token
 *  stay when the references go. A value with no token is not literal. */
function literal(header: string, value: string): boolean {
  if (NO_TOKEN.test(value)) {
    return false
  }
  const rest = value.replace(REFERENCE, '')
  if (rest !== value) {
    return SCHEME_TOKEN.test(rest)
  }
  return SCHEME_TOKEN.test(value) || CREDENTIAL_NAME.test(header)
}

const rule: JSONRuleDefinition<{ MessageIds: 'literal' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep a literal credential out of the headers of a marketplace download',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      literal: `The header "{{header}}" holds a literal credential, and anyone who reads this file can use it. Use a "headersHelper" command instead.`,
    },
  },
  create(context) {
    /** Report each header of `headers` that holds a literal credential. */
    function check(headers: ValueNode | undefined): void {
      // A `headers` value that is not an object is for the schema rules.
      if (headers?.type !== 'Object') {
        return
      }
      for (const member of headers.members) {
        const header = keyOf(member.name)
        // Two members with one name read as the last, as `JSON.parse` does.
        if (lastMember(headers, header) !== member) {
          continue
        }
        const value = member.value
        if (value.type === 'String' && literal(header, value.value)) {
          context.report({ node: value, messageId: 'literal', data: { header } })
        }
      }
    }
    return {
      Document(node) {
        if (path.basename(context.filename) === 'marketplace.json') {
          for (const entry of pluginEntries(node)) {
            check(lastMember(entry, 'headers')?.value)
          }
          return
        }
        const marketplaces = lastMember(node.body, 'extraKnownMarketplaces')?.value
        if (marketplaces?.type !== 'Object') {
          return
        }
        for (const member of marketplaces.members) {
          if (lastMember(marketplaces, keyOf(member.name)) !== member) {
            continue
          }
          const source = lastMember(member.value, 'source')?.value
          const type = lastMember(source, 'source')?.value
          if (type?.type === 'String' && type.value === MARKETPLACE_SOURCE_TYPES.url) {
            check(lastMember(source, 'headers')?.value)
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/marketplace.json', ...SETTINGS_FILES],
  rule,
}

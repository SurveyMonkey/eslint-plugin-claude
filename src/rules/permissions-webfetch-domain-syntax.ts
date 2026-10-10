// A `WebFetch` specifier is `domain:<host>`. Claude Code matches the hostname of the requested
// URL, so a scheme, a path or a port has no place in it
// (docs/rules/permissions-webfetch-domain-syntax.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { parameterOf } from '../permission-entries.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-webfetch-domain-syntax' as const

type MessageId = 'missingPrefix' | 'scheme' | 'path' | 'port' | 'notHost'

const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//
const DOMAIN_PREFIX = /^\s*domain\s*:/
const IPV6_LITERAL = /^\[[0-9A-Fa-f:.]+\]$/

/** The fault of `host`, the text after `domain:`, or null. The first fault in the order of the
 *  checks is the one that the rule reports. A wildcard is valid in any position, and
 *  `permissions-webfetch-mid-wildcard` reads where it stands. */
function hostFault(host: string): MessageId | null {
  if (SCHEME.test(host)) {
    return 'scheme'
  }
  if (/[/?#]/.test(host)) {
    return 'path'
  }
  if (IPV6_LITERAL.test(host)) {
    return null
  }
  if (/:\d+$/.test(host)) {
    return 'port'
  }
  return host === '' || /[\s@:\\]/.test(host) ? 'notHost' : null
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write a WebFetch rule as domain:<host>, with a hostname or wildcard only',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      missingPrefix:
        '`{{text}}` has no `domain:` prefix. Write `WebFetch(domain:<host>)`. Claude Code matches the hostname of the URL.',
      scheme:
        '`{{text}}` has a URL scheme. Write the hostname only, as `domain:example.com`. Claude Code matches the hostname of the URL.',
      path: '`{{text}}` has a path, a query or a fragment. Write the hostname only. Claude Code matches the hostname of the URL.',
      port: '`{{text}}` has a port. Write the hostname only. Claude Code matches the hostname of the URL.',
      notHost:
        '`{{text}}` is not a hostname or a wildcard pattern. Claude Code matches the hostname of the URL.',
    },
  },
  create(context) {
    return settingsListener(context, (entries) => {
      for (const entry of entries) {
        const { tool, specifier } = entry.rule
        if (tool !== 'WebFetch' || specifier === null) {
          continue
        }
        const prefix = DOMAIN_PREFIX.exec(specifier)
        let text = specifier.trim()
        let messageId: MessageId | null
        if (prefix !== null) {
          text = specifier.slice(prefix[0].length).trim()
          messageId = hostFault(text)
        } else if (SCHEME.test(text)) {
          messageId = 'scheme'
        } else {
          // A deny or ask rule can name another parameter, as `prompt:*`. That is a parameter
          // rule, and `permissions-param-rule` reads it.
          messageId = parameterOf(entry) === null ? 'missingPrefix' : null
        }
        if (messageId !== null) {
          context.report({ loc: entry.loc, messageId, data: { text } })
        }
      }
    })
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}

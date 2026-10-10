// An entry of `sandbox.network.allowedDomains` or `deniedDomains` is a domain, a wildcard
// pattern or an IP literal, with an optional `:port` suffix. A person writes an IPv6 address in
// brackets (docs/rules/sandbox-domain-syntax.md). The checks of the host name are in
// `src/permission-host.ts`, which the `WebFetch` rule shares.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { isIpv6Literal, isPlainHost, leadingFault } from '../permission-host.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { stringEntries, valueAt, withheldNote } from '../permission-sandbox.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'sandbox-domain-syntax' as const

type MessageId = 'scheme' | 'path' | 'port' | 'unbracketedIpv6' | 'notHost'

const LISTS = ['allowedDomains', 'deniedDomains']
const BRACKETED = /^(\[[^\]]*\])(?::(.*))?$/
const ADDRESS = /^[0-9A-Fa-f:.]+$/
const PORT = /^[1-9][0-9]{0,4}$/

/** True when `text` is a TCP port: whole digits that do not start with 0, from 1 to 65535. */
const isPort = (text: string) => PORT.test(text) && Number(text) <= 65535

/** The fault of `entry`, or null. The first fault in the order of the checks is the one that the
 *  rule reports. The host part is read before the port. A wildcard is valid in any position. This
 *  rule does not read where it stands. */
function fault(entry: string): MessageId | null {
  const leading = leadingFault(entry)
  if (leading !== null) {
    return leading
  }
  let host = entry
  let port: string | undefined
  if (entry.startsWith('[')) {
    const bracketed = BRACKETED.exec(entry)
    if (bracketed === null || !isIpv6Literal(bracketed[1] as string)) {
      return 'notHost'
    }
    host = bracketed[1] as string
    port = bracketed[2]
  } else {
    const colons = entry.split(':').length - 1
    if (colons > 1) {
      return ADDRESS.test(entry) ? 'unbracketedIpv6' : 'notHost'
    }
    if (colons === 1) {
      port = entry.slice(entry.indexOf(':') + 1)
      host = entry.slice(0, entry.indexOf(':'))
    }
    if (!isPlainHost(host)) {
      return 'notHost'
    }
  }
  return port === undefined || isPort(port) ? null : 'port'
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Write each sandbox domain as a host with an optional port, in the form of the docs',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      scheme:
        '`{{entry}}` has a URL scheme. Write the host only, as `example.com`, with an optional `:port`.{{note}}',
      path: '`{{entry}}` has a path, a query or a fragment. Write the host only, with an optional `:port`.{{note}}',
      port: '`{{entry}}` has a port that is not valid. A port is a whole number from 1 to 65535 with no leading zero.{{note}}',
      unbracketedIpv6:
        '`{{entry}}` is an IPv6 address with no brackets, and Claude Code cannot tell it from a host and a port. Write `[::1]` for every port or `[::1]:443` for one port.{{note}}',
      notHost:
        '`{{entry}}` is not a hostname, a wildcard pattern or an IP literal. An IPv6 address holds hex digits in brackets, with no wildcard inside.{{note}}',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const isManaged = kindOf(context.filename) === 'managed'
    return {
      Document(node) {
        for (const list of LISTS) {
          const key = `sandbox.network.${list}`
          const note = isManaged ? withheldNote(key) : ''
          for (const entry of stringEntries(valueAt(node, ['sandbox', 'network', list]))) {
            const messageId = fault(entry.value)
            if (messageId !== null) {
              context.report({ node: entry, messageId, data: { entry: entry.value, note } })
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

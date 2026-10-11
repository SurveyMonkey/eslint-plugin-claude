// The checks of a host name that two places share. A `WebFetch(domain:<host>)` rule and an entry of
// `sandbox.network.allowedDomains` or `deniedDomains` both name a host, with a wildcard, an IP
// literal or a hostname. They differ in the port: a `WebFetch` rule has none, and a sandbox entry
// can end in `:<port>`. Each caller handles the port, and uses these checks for the rest
// (https://code.claude.com/docs/en/permissions#webfetch and
// https://code.claude.com/docs/en/sandboxing#ipv6-addresses-in-domain-lists).

const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//
const IPV6_LITERAL = /^\[[0-9A-Fa-f:.]+\]$/

/** True when `host` starts with a URL scheme, as `https://`. */
export const hasScheme = (host: string) => SCHEME.test(host)

/** The first fault of `host` that has nothing to do with a port: a URL scheme, or a path, a query
 *  or a fragment. */
export function leadingFault(host: string): 'scheme' | 'path' | null {
  if (hasScheme(host)) {
    return 'scheme'
  }
  return /[/?#]/.test(host) ? 'path' : null
}

/** True when `host` is an IPv6 address in brackets, such as `[::1]`. A wildcard has no place
 *  inside the brackets. */
export const isIpv6Literal = (host: string) => IPV6_LITERAL.test(host)

/** True when `host` can be a hostname or a wildcard pattern: it is not empty, and it holds no
 *  white space, `@`, `:` or backslash. A wildcard is valid in any position. This check does not
 *  read where it stands. */
export const isPlainHost = (host: string) => host !== '' && !/[\s@:\\]/.test(host)

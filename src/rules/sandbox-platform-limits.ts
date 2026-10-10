// Four limits of the sandbox depend on the platform or on the Claude Code version
// (docs/rules/sandbox-platform-limits.md). No file shows the platform of a team or the oldest
// client that reads it. So each part has an option, and a part with no option makes no report:
// `platforms` for the three platform parts, and `minVersion` for the two version parts.
//   - Linux and WSL2 skip an `allowWrite` or `denyWrite` entry with `*`, `?` or `[`, and the
//     `Edit` permission rules that feed those lists. They ignore `allowUnixSockets`.
//   - Before v2.1.224, a trailing `/` on a `denyRead` or `denyWrite` entry went to the sandbox.
//   - Before v2.1.229, a bracketed IPv6 entry of a domain list or a `WebFetch` rule is not read.
//   - `failIfUnavailable: true` stops Claude Code at startup on native Windows.
// The part for WSL1 is not checked: the value `wsl` of `platforms` means WSL2, the only WSL
// that the sandbox supports.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type ValueNode } from '../marketplace-json.ts'
import { fetchHost } from '../permission-host.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { isOn, stringEntries, valueAt } from '../permission-sandbox.ts'
import { isDeadAllow, sourceOf } from '../permission-source.ts'
import { kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'sandbox-platform-limits' as const

type MessageId =
  | 'writeWildcard'
  | 'editWildcard'
  | 'unixSockets'
  | 'trailingSlash'
  | 'ipv6'
  | 'failIfUnavailable'

/** The platforms that the option names. */
const PLATFORMS = ['windows-git-bash', 'windows-no-git-bash', 'macos', 'linux', 'wsl'] as const
const LINUX_LIKE = ['linux', 'wsl']
const WINDOWS = ['windows-git-bash', 'windows-no-git-bash']

interface Options {
  platforms?: string[]
  minVersion?: string
}

/** True when version `a` is lower than version `b`. Both are `major.minor.patch`. */
function isBelow(a: string, b: string): boolean {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  const at = left.findIndex((part, index) => part !== right[index])
  return at !== -1 && (left[at] as number) < (right[at] as number)
}

/** True when `path` holds a character that the Linux and WSL2 sandbox does not mount, once
 *  Claude Code has removed a trailing `/**`. */
const hasWildcard = (path: string) => /[*?[]/.test(path.replace(/\/\*\*$/, ''))

/** True when `host` is an IPv6 address in brackets, with an optional port. A bracket that does not
 *  close, or that holds nothing, is not that form. */
const isBracketed = (host: string) => /^\[[^\]]+\](?::\d+)?$/.test(host)

const rule: JSONRuleDefinition<{ RuleOptions: [Options]; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not rely on a sandbox setting that the platform or version does not honor',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: {
          platforms: { type: 'array', items: { enum: PLATFORMS }, uniqueItems: true },
          minVersion: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{}],
    messages: {
      writeWildcard:
        'On Linux and WSL2 the sandbox mounts concrete paths, so Claude Code skips this entry and it has no effect. Name the directory in full.',
      editWildcard:
        'On Linux and WSL2 Claude Code adds the path of an `Edit` rule to the sandbox write lists, and skips a path with `*`, `?` or `[`. The sandbox ignores this rule. Name the directory in full.',
      unixSockets:
        'Claude Code ignores "allowUnixSockets" on Linux and WSL2, because the seccomp filter cannot inspect socket paths. "allowAllUnixSockets" is the only way to permit Unix sockets there.',
      trailingSlash:
        'Before Claude Code v2.1.224, a trailing `/` on a "denyRead" or "denyWrite" entry went to the sandbox, and Claude could still read or write paths under the entry. Your minVersion is {{minVersion}}. Remove the `/`.',
      ipv6: 'A bracketed IPv6 entry needs Claude Code v2.1.229 or later, and your minVersion is {{minVersion}}. Raise the minimum version, or remove the entry.',
      failIfUnavailable:
        'The sandbox does not run on native Windows, so Claude Code exits at startup with "failIfUnavailable" on. Deliver this setting to macOS, Linux and WSL2 machines only.',
    },
  },
  create(context) {
    const [{ platforms = [], minVersion }] = context.options
    const onPlatform = (names: readonly string[]) =>
      platforms.some((entry) => names.includes(entry))
    const linux = onPlatform(LINUX_LIKE)
    const windows = onPlatform(WINDOWS)
    const olderThan = (version: string) => minVersion !== undefined && isBelow(minVersion, version)
    const slash = olderThan('2.1.224')
    const ipv6 = olderThan('2.1.229')
    if (!linux && !windows && !slash && !ipv6) {
      return {}
    }
    const isManaged = kindOf(context.filename) === 'managed'
    return settingsListener(context, (entries, document) => {
      const list = (path: readonly string[]) => stringEntries(valueAt(document, path))
      if (linux) {
        for (const key of ['allowWrite', 'denyWrite']) {
          for (const entry of list(['sandbox', 'filesystem', key])) {
            if (hasWildcard(entry.value)) {
              context.report({ node: entry, messageId: 'writeWildcard' })
            }
          }
        }
        const sockets = lastMember(valueAt(document, ['sandbox', 'network']), 'allowUnixSockets')
        if (sockets?.value.type === 'Array' && sockets.value.elements.length > 0) {
          context.report({ node: sockets.name, messageId: 'unixSockets' })
        }
        if (isOn(valueAt(document, ['sandbox', 'enabled']), isManaged)) {
          const { objects } = sourceOf(context.filename, context.sourceCode.text)
          for (const { list: kind, loc, rule: parsed } of entries) {
            // `permissions-dead-allow` reports an allow rule that a deny or ask rule covers.
            if (
              parsed.tool === 'Edit' &&
              kind !== 'ask' &&
              parsed.specifier !== null &&
              hasWildcard(parsed.specifier) &&
              !(kind === 'allow' && isDeadAllow(objects, parsed))
            ) {
              context.report({ loc, messageId: 'editWildcard' })
            }
          }
        }
      }
      if (slash) {
        for (const key of ['denyRead', 'denyWrite']) {
          for (const entry of list(['sandbox', 'filesystem', key])) {
            if (entry.value.endsWith('/')) {
              context.report({ node: entry, messageId: 'trailingSlash', data: { minVersion } })
            }
          }
        }
      }
      if (ipv6) {
        for (const key of ['allowedDomains', 'deniedDomains']) {
          for (const entry of list(['sandbox', 'network', key])) {
            if (isBracketed(entry.value)) {
              context.report({ node: entry, messageId: 'ipv6', data: { minVersion } })
            }
          }
        }
        for (const { list: kind, loc, rule: parsed } of entries) {
          if (
            kind !== 'ask' &&
            parsed.tool === 'WebFetch' &&
            isBracketed(fetchHost(parsed.specifier) ?? '')
          ) {
            context.report({ loc, messageId: 'ipv6', data: { minVersion } })
          }
        }
      }
      const fail = valueAt(document, ['sandbox', 'failIfUnavailable'])
      if (windows && isOn(fail, isManaged)) {
        context.report({ node: fail as ValueNode, messageId: 'failIfUnavailable' })
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

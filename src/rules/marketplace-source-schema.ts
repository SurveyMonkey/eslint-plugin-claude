// The fields of an object plugin source in a marketplace entry. The docs name
// the fields of each source type and some limits on their values
// (docs/rules/marketplace-source-schema.md). The docs fix 500 as the most
// characters of a `command`, and no Claude Code setting moves it, so the
// schema sets 500 as the maximum of the option `max`.
import type { JSONRuleDefinition } from '@eslint/json'
import { PLUGIN_SOURCE_TYPES } from '../data/marketplace-source-types.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type ObjectNode, pluginEntries, type ValueNode } from '../marketplace-json.ts'

const name = 'marketplace-source-schema' as const

// The limit in the docs, and the default of `max`.
const COMMAND_MAX = 500

type Options = [{ max: number }]
type SourceType = (typeof PLUGIN_SOURCE_TYPES)[keyof typeof PLUGIN_SOURCE_TYPES]

const TYPES: readonly string[] = Object.values(PLUGIN_SOURCE_TYPES)
const TYPE_LIST = TYPES.join(', ')

/** The fields that each source type reads as a string, as the docs list them.
 *  The fields `timeout` and `mode` of a `command` source have their own checks. */
const FIELDS: Record<SourceType, { required: string[]; optional: string[] }> = {
  github: { required: ['repo'], optional: ['ref', 'sha'] },
  url: { required: ['url'], optional: ['ref', 'sha'] },
  'git-subdir': { required: ['url', 'path'], optional: ['ref', 'sha'] },
  npm: { required: ['package'], optional: ['version', 'registry'] },
  archive: { required: ['url'], optional: ['sha256'] },
  command: { required: ['command'], optional: [] },
}

// `owner/repo`: one slash, and no white space or second slash.
const REPO = /^[^/\s]+\/[^/\s]+$/
const GIT_URL = /^(?:https?:\/\/|file:\/\/|git@)/i
const HTTPS_URL = /^https:\/\//i
const FULL_SHA = /^[0-9a-f]{40}$/
const SHA256 = /^[0-9a-fA-F]{64}$/
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/
const SPACE_RUN = / {4}/
const IPV4_LOOPBACK = /^127(?:\.\d{1,3}){3}$/
const IPV4_LINK_LOCAL = /^169\.254(?:\.\d{1,3}){2}$/
// The first 10 bits of an IPv6 link-local address are fe80::/10. A host of the URL parser has brackets.
const IPV6_LINK_LOCAL = /^\[fe[89ab]/
// The metadata hosts of the large clouds. The docs name the kind and give no list.
const METADATA_HOSTS = new Set([
  'metadata.google.internal',
  '169.254.169.254',
  '100.100.100.200',
  '[fd00:ec2::254]',
])

// The `timeout` range of a `command` source, in seconds.
const TIMEOUT_MIN = 1
const TIMEOUT_MAX = 600

/** The host of `url` and its kind, when the docs bar the kind. Text that the URL
 *  parser refuses has no host, so it gives nothing. */
function barredHost(url: string): { host: string; kind: string } | undefined {
  let host: string
  try {
    host = new URL(url).hostname.replace(/\.$/, '')
  } catch {
    return undefined
  }
  if (METADATA_HOSTS.has(host)) {
    return { host, kind: 'cloud-metadata' }
  }
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '[::1]' ||
    IPV4_LOOPBACK.test(host)
  ) {
    return { host, kind: 'loopback' }
  }
  return IPV4_LINK_LOCAL.test(host) || IPV6_LINK_LOCAL.test(host)
    ? { host, kind: 'link-local' }
    : undefined
}

type MessageIds =
  | 'typeMissing'
  | 'typeNotString'
  | 'typeUnknown'
  | 'typeUnsupported'
  | 'missingField'
  | 'notString'
  | 'repoFormat'
  | 'urlScheme'
  | 'shaFormat'
  | 'npmParent'
  | 'archiveScheme'
  | 'archiveHost'
  | 'sha256Format'
  | 'commandNotPrintable'
  | 'commandTooLong'
  | 'commandOverConfiguredLimit'
  | 'commandSpaceRun'
  | 'timeout'
  | 'mode'

const rule: JSONRuleDefinition<{
  RuleOptions: Options
  MessageIds: MessageIds
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write the object source of a marketplace entry as the docs require',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { max: { type: 'integer', minimum: 1, maximum: COMMAND_MAX } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ max: COMMAND_MAX }],
    messages: {
      typeMissing:
        'The source object has no "source" key. Set it to one of these types: {{types}}.',
      typeNotString:
        'The "source" key of the source object must be a string. Set it to one of these types: {{types}}.',
      typeUnknown: '"{{type}}" is not a plugin source type. Use one of these types: {{types}}.',
      typeUnsupported:
        '"unsupported" is a placeholder that Claude Code sets at parse time. Do not write it. Use one of these types: {{types}}.',
      missingField: 'A "{{type}}" source needs the field "{{field}}".',
      notString: 'The "{{field}}" of a "{{type}}" source must be a string.',
      repoFormat: 'The "repo" of a "github" source must be "owner/repo", and "{{value}}" is not.',
      urlScheme:
        'The "url" of a "url" source must start with "https://", "http://", "file://" or "git@".',
      shaFormat:
        'The "sha" of a "{{type}}" source must be a full 40-character lowercase commit SHA.',
      npmParent: 'The "package" of an "npm" source must not contain "..".',
      archiveScheme: 'The "url" of an "archive" source must start with "https://".',
      archiveHost:
        'The "url" of an "archive" source names the host "{{host}}", a {{kind}} host. The docs do not allow it.',
      sha256Format: 'The "sha256" of an "archive" source must be 64 hex characters.',
      commandNotPrintable:
        'The "command" of a "command" source must be printable ASCII, and it has another character.',
      commandTooLong:
        'The "command" of a "command" source has {{length}} characters. The docs allow at most {{max}}.',
      commandOverConfiguredLimit:
        'The "command" of a "command" source has {{length}} characters. The configured limit is {{max}}.',
      commandSpaceRun: 'The "command" of a "command" source has a run of four or more spaces.',
      timeout:
        'The "timeout" of a "command" source must be a whole number of seconds from 1 to 600.',
      mode: 'The "mode" of a "command" source must be "copy" or "link".',
    },
  },
  create(context) {
    const [{ max }] = context.options
    const report = (
      node: ObjectNode | ValueNode,
      messageId: MessageIds,
      data: Record<string, string> = {},
    ) => context.report({ node, messageId, data })

    /** The checks of one string field of a source of `type`. */
    function checkText(type: SourceType, field: string, value: ValueNode & { type: 'String' }) {
      const text = value.value
      if (field === 'repo' && !REPO.test(text)) {
        report(value, 'repoFormat', { value: text })
      } else if (field === 'url' && type === PLUGIN_SOURCE_TYPES.url && !GIT_URL.test(text)) {
        report(value, 'urlScheme')
      } else if (field === 'url' && type === PLUGIN_SOURCE_TYPES.archive) {
        if (!HTTPS_URL.test(text)) {
          report(value, 'archiveScheme')
        } else {
          const barred = barredHost(text)
          if (barred !== undefined) {
            report(value, 'archiveHost', barred)
          }
        }
      } else if (field === 'sha' && !FULL_SHA.test(text)) {
        report(value, 'shaFormat', { type })
      } else if (field === 'package' && text.includes('..')) {
        report(value, 'npmParent')
      } else if (field === 'sha256' && !SHA256.test(text)) {
        report(value, 'sha256Format')
      } else if (field === 'command') {
        checkCommand(value, text)
      }
    }

    /** The text rules of a `command`. Each fault is its own report. */
    function checkCommand(value: ValueNode, text: string) {
      const length = String(text.length)
      if (!PRINTABLE_ASCII.test(text)) {
        report(value, 'commandNotPrintable')
      }
      if (text.length > max) {
        // At another value, the message names the configured limit and claims no docs limit.
        report(value, max === COMMAND_MAX ? 'commandTooLong' : 'commandOverConfiguredLimit', {
          length,
          max: String(max),
        })
      }
      if (SPACE_RUN.test(text)) {
        report(value, 'commandSpaceRun')
      }
    }

    /** The `timeout` and `mode` of a `command` source. */
    function checkCommandOptions(source: ObjectNode) {
      const timeout = lastMember(source, 'timeout')?.value
      if (
        timeout !== undefined &&
        !(
          timeout.type === 'Number' &&
          Number.isInteger(timeout.value) &&
          timeout.value >= TIMEOUT_MIN &&
          timeout.value <= TIMEOUT_MAX
        )
      ) {
        report(timeout, 'timeout')
      }
      const mode = lastMember(source, 'mode')?.value
      if (
        mode !== undefined &&
        !(mode.type === 'String' && ['copy', 'link'].includes(mode.value))
      ) {
        report(mode, 'mode')
      }
    }

    /** The fields of `source`, a source of the known `type`. */
    function checkFields(source: ObjectNode, type: SourceType) {
      const { required, optional } = FIELDS[type]
      for (const field of [...required, ...optional]) {
        const value = lastMember(source, field)?.value
        if (value === undefined) {
          if (required.includes(field)) {
            report(source, 'missingField', { type, field })
          }
        } else if (value.type === 'String') {
          checkText(type, field, value)
        } else {
          report(value, 'notString', { type, field })
        }
      }
      if (type === PLUGIN_SOURCE_TYPES.command) {
        checkCommandOptions(source)
      }
    }

    return {
      Document(node) {
        for (const entry of pluginEntries(node)) {
          // A `source` that is not an object is for `marketplace-relative-source-format`
          // and `marketplace-schema`.
          const source = lastMember(entry, 'source')?.value
          if (source?.type !== 'Object') {
            continue
          }
          const type = lastMember(source, 'source')?.value
          const data = { types: TYPE_LIST }
          if (type === undefined) {
            report(source, 'typeMissing', data)
          } else if (type.type !== 'String') {
            report(type, 'typeNotString', data)
          } else if (!TYPES.includes(type.value)) {
            report(type, type.value === 'unsupported' ? 'typeUnsupported' : 'typeUnknown', {
              ...data,
              type: type.value,
            })
          } else {
            checkFields(source, type.value as SourceType)
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

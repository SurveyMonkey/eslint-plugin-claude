// The rules between the fields of an entry of `sandbox.credentials.files` and `envVars`
// (docs/rules/sandbox-credentials-mask.md). `sandbox-schema` owns the type of each field, and
// `sandbox-scope` owns a `mask` entry in a project or local file, where Claude Code drops it. So
// the rule reads the `mask` entries of a managed source only, and the `deny` entries of every file.
// A source is the managed files that `src/permission-source.ts` adds up.
import type { JSONRuleDefinition } from '@eslint/json'
import { MASK_FIELDS } from '../data/sandbox-keys.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember, type MemberNode, type ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { stringEntries } from '../permission-sandbox.ts'
import { at, isObject, objectEntries, type SettingsObject, sourceOf } from '../permission-source.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'sandbox-credentials-mask' as const

type MessageId =
  | 'denyFields'
  | 'noTls'
  | 'claimsNeedDecode'
  | 'emptyClaims'
  | 'duplicatesNeedExtract'
  | 'extractAndDecode'
  | 'decodeWarnOnly'
  | 'injectIpv6'
  | 'denyWins'

/** The fields that only a `mask` entry uses. `maskDuplicates` is a field of a file entry. */
const MASK_ONLY = Object.keys(MASK_FIELDS).filter((field) => field !== 'mode')

/** True when `host` is an IPv6 address that an `injectHosts` entry can never match: a bracketed
 *  address or an address with a zone ID. */
const isUnmatchable = (host: string) =>
  host.startsWith('[') || (host.includes(':') && host.includes('%'))

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Give each mask entry of sandbox.credentials fields that agree',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      denyFields:
        'A "deny" entry ignores {{fields}}. Claude Code accepts them and does nothing. Remove them, or use "mask".',
      noTls:
        'A "mask" entry needs "sandbox.network.tlsTerminate", or "sandbox.credentials.allowPlaintextInject" for plain HTTP, in this managed source. Without one, the proxy sends the placeholder to the server and authentication fails.',
      claimsNeedDecode:
        '"maskClaims" needs "decode": "jwt". Claude Code ignores it without "decode".',
      emptyClaims: '"maskClaims" needs at least one claim name.',
      duplicatesNeedExtract:
        '"maskDuplicates" has an effect only when "extract" or "decode" is set. Claude Code ignores it here.',
      extractAndDecode:
        '"extract" and "decode" cannot be on the same environment variable entry. Remove one.',
      decodeWarnOnly:
        'An entry with "decode" accepts "onExtractNoMatch": "warn" only. `{{value}}` is not valid here.',
      injectIpv6:
        '`{{host}}` can never match a destination. Write an IPv6 address in "injectHosts" bare and compressed, as `::1`, with no brackets and no zone ID.',
      denyWins:
        '"{{name}}" has a "deny" entry in this managed source too. Claude Code applies "deny", so this "mask" entry never applies.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const isManaged = kindOf(context.filename) === 'managed'
    return {
      Document(document) {
        const objects = sourceOf(context.filename, context.sourceCode.text)
        const own = objects[0] as SettingsObject
        const hasTls = objects.some(
          (object) =>
            isObject(at(object, ['sandbox', 'network', 'tlsTerminate'])) ||
            at(object, ['sandbox', 'credentials', 'allowPlaintextInject']) === true,
        )
        const denied = new Set(
          objects.flatMap((object) => {
            const list = at(object, ['sandbox', 'credentials', 'envVars'])
            return Array.isArray(list)
              ? list.flatMap((item) => (isObject(item) && item.mode === 'deny' ? [item.name] : []))
              : []
          }),
        )
        for (const kind of ['files', 'envVars'] as const) {
          for (const { entry, node } of objectEntries(document, own, [
            'sandbox',
            'credentials',
            kind,
          ])) {
            const mode = lastMember(node, 'mode')
            const member = (key: string) => lastMember(node, key)
            if (entry.mode === 'deny') {
              const fields = [...MASK_ONLY, ...(kind === 'files' ? ['maskDuplicates'] : [])].filter(
                (field) => field in entry,
              )
              if (fields.length > 0) {
                context.report({
                  node: mode?.value as ValueNode,
                  messageId: 'denyFields',
                  data: { fields: fields.map((field) => `"${field}"`).join(', ') },
                })
              }
              continue
            }
            if (!isManaged || entry.mode !== 'mask') {
              continue
            }
            const modeNode = mode?.value as ValueNode
            if (!hasTls) {
              context.report({ node: modeNode, messageId: 'noTls' })
            }
            if (kind === 'envVars' && denied.has(entry.name)) {
              context.report({
                node: modeNode,
                messageId: 'denyWins',
                data: { name: String(entry.name) },
              })
            }
            const claims = member('maskClaims')
            if (claims !== undefined && entry.decode !== 'jwt') {
              context.report({ node: claims.name, messageId: 'claimsNeedDecode' })
            } else if (Array.isArray(entry.maskClaims) && entry.maskClaims.length === 0) {
              context.report({ node: claims?.value as ValueNode, messageId: 'emptyClaims' })
            }
            if (
              kind === 'files' &&
              entry.maskDuplicates !== undefined &&
              entry.extract === undefined &&
              entry.decode === undefined
            ) {
              context.report({
                node: member('maskDuplicates')?.name as MemberNode['name'],
                messageId: 'duplicatesNeedExtract',
              })
            }
            if (kind === 'envVars' && entry.extract !== undefined && entry.decode !== undefined) {
              context.report({
                node: member('decode')?.name as MemberNode['name'],
                messageId: 'extractAndDecode',
              })
            }
            if (
              kind === 'envVars' &&
              entry.decode !== undefined &&
              (entry.onExtractNoMatch === 'deny' || entry.onExtractNoMatch === 'error')
            ) {
              context.report({
                node: member('onExtractNoMatch')?.value as ValueNode,
                messageId: 'decodeWarnOnly',
                data: { value: String(entry.onExtractNoMatch) },
              })
            }
            for (const host of stringEntries(member('injectHosts')?.value)) {
              if (isUnmatchable(host.value)) {
                context.report({ node: host, messageId: 'injectIpv6', data: { host: host.value } })
              }
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

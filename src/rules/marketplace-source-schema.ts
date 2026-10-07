// The fields of an object plugin source in a marketplace entry. The docs name
// the fields of each source type and some limits on their values
// (docs/rules/marketplace-source-schema.md). The docs fix 500 as the most
// characters of a `command`, and no Claude Code setting moves it, so the
// schema sets 500 as the maximum of the option `max`.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'

const name = 'marketplace-source-schema' as const

// The limit in the docs, and the default of `max`.
const COMMAND_MAX = 500

type Options = [{ max: number }]

const rule: JSONRuleDefinition<{
  RuleOptions: Options
  MessageIds:
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
  create() {
    return {}
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/marketplace.json'],
  rule,
}

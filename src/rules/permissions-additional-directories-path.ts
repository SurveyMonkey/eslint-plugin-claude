// Claude Code refuses a network path as a working directory, and skips an entry with a NUL byte.
// The rule reads the text of each `additionalDirectories` entry. It reads no directory out of the
// repository (docs/rules/permissions-additional-directories-path.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-additional-directories-path' as const

type MessageId = 'networkPath' | 'nulByte'

/** A UNC share, as `\\server\share`. The docs say that a `\\wsl$` path is not a network path. A
 *  `\\wsl.localhost` path is the other name of the WSL share, and `\\?\` and `\\.\` start a
 *  Windows device path. The docs name none of these three as a network path. */
const UNC = /^\\\\(?!(?:wsl\$|wsl\.localhost|[?.])\\)/i

/** An automount path, as `/net/<host>`. */
const AUTOMOUNT = /^\/net\/[^/]+/

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write each additionalDirectories entry as a local path',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      networkPath:
        '`{{path}}` is a network path. Claude Code does not add a network path as a working directory. Use a local path.',
      nulByte: 'This entry has a NUL byte. Claude Code skips it.',
    },
  },
  create(context) {
    return settingsListener(context, (_entries, document) => {
      const permissions = lastMember(document.body, 'permissions')?.value
      const directories = lastMember(permissions, 'additionalDirectories')?.value
      for (const { value } of directories?.type === 'Array' ? directories.elements : []) {
        if (value.type !== 'String') {
          continue
        }
        const path = value.value
        if (path.includes('\0')) {
          context.report({ loc: value.loc, messageId: 'nulByte' })
        } else if (UNC.test(path) || AUTOMOUNT.test(path)) {
          context.report({ loc: value.loc, messageId: 'networkPath', data: { path } })
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

// `autoMemoryDirectory` in a project settings file
// (docs/rules/memory-auto-memory-directory-committed.md). The docs say that any settings scope
// can set the key. For `.claude/settings.json` and `.claude/settings.local.json`, Claude Code
// honors it under the same workspace trust rule as hooks in settings files. While
// `permissions.blockReadsOutsideWorkingDirectories` is on, it loads no auto memory from a
// directory that such a file chooses. The rule reads the two project files. A managed file is
// policy, and not repository-supplied, so the rule leaves it. A value of `null` reads as unset.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { kindOf } from '../settings-files.ts'

const name = 'memory-auto-memory-directory-committed' as const

const rule: JSONRuleDefinition<{ MessageIds: 'committed' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not set autoMemoryDirectory in a project settings file',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      committed:
        '`autoMemoryDirectory` in `{{file}}` is a repository-supplied path. Claude Code honors it only after workspace trust, and loads no auto memory from it while `permissions.blockReadsOutsideWorkingDirectories` is on. Set it in your user settings.',
    },
  },
  create(context) {
    const kind = kindOf(context.filename)
    if (kind === 'managed') {
      return {}
    }
    const file = kind === 'local' ? 'settings.local.json' : 'settings.json'
    return {
      Document(node) {
        const member = lastMember(node.body, 'autoMemoryDirectory')
        if (member !== undefined && member.value.type !== 'Null') {
          context.report({
            node: member,
            messageId: 'committed',
            data: { file: `.claude/${file}` },
          })
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  rule,
}

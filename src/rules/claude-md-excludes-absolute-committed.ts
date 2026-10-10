// A `claudeMdExcludes` pattern with the path of one machine in the committed project file
// (docs/rules/claude-md-excludes-absolute-committed.md). Claude Code matches the patterns against
// absolute file paths. The docs put such a pattern in `.claude/settings.local.json`, so that the
// exclusion stays on one machine. A committed pattern with a folder name that the clones do not
// share matches nothing for the others. The rule reads `.claude/settings.json` only.
// `claude-md-excludes-pattern` owns the patterns that do not start at the root.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'

const name = 'claude-md-excludes-absolute-committed' as const

// The committed project file, and the end of its path.
const PROJECT_FILE = '**/.claude/settings.json'
const SUFFIX = '/.claude/settings.json'

// A Windows drive (`C:\` or `C:/`), or a Windows share (`\\server`).
const WINDOWS = /^(?:[A-Za-z]:[\\/]|\\\\)/
// A Unix path whose first folder name is a literal name, with no glob character.
const UNIX = /^\/[^/*?[\]{}]+(?:\/|$)/

/** True when `pattern` starts with the path of one machine. */
const isMachinePath = (pattern: string) => WINDOWS.test(pattern) || UNIX.test(pattern)

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'absolute' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Keep a machine-specific claudeMdExcludes path out of the committed settings',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      absolute:
        'The pattern "{{pattern}}" names a folder of one machine, and every clone shares this file. Put the pattern in `.claude/settings.local.json`, or start it with `**/`.',
    },
  },
  create(context) {
    const file = path.resolve(context.filename).split(path.sep).join('/')
    if (!file.endsWith(SUFFIX)) {
      return {}
    }
    return {
      Document(node) {
        const list = lastMember(node.body, 'claudeMdExcludes')?.value
        if (list?.type !== 'Array') {
          return
        }
        for (const { value } of list.elements) {
          if (value.type === 'String' && isMachinePath(value.value)) {
            context.report({ node: value, messageId: 'absolute', data: { pattern: value.value } })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: [PROJECT_FILE],
  rule,
}

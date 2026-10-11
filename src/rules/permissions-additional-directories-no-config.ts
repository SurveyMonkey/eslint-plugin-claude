// A directory in `permissions.additionalDirectories` grants file access only. Claude Code loads no
// CLAUDE.md, rules, skills, commands or agents from it, even with
// `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD`
// (docs/rules/permissions-additional-directories-no-config.md). The rule reads the directories of
// the repository, and makes no report for a path that it cannot see or that leaves the repository
// (ADR 001, Decision 14). A relative entry resolves from the directory where Claude starts. That
// is the project directory for the shared file. The local file loads from the repository root
// whatever the start directory, so the rule reads absolute entries only there. A managed file
// applies to every project on a machine, so the rule does not check it.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { stringEntries, valueAt } from '../permission-sandbox.ts'
import { kindOf } from '../settings-files.ts'
import {
  danglingOf,
  isInside,
  realDirectory,
  realOf,
  repositoryRoot,
  UNREADABLE,
} from '../skill-tree.ts'

const name = 'permissions-additional-directories-no-config' as const

/** The configuration that a directory added with the setting does not load, as the table of the
 *  permissions page lists it (https://code.claude.com/docs/en/permissions#additional-directories-grant-file-access-not-configuration).
 *  Settings files are not here: a directory added with the flag loads two of their keys only,
 *  so no advice fits. */
const HELD = [
  'CLAUDE.md',
  'CLAUDE.local.md',
  '.claude/CLAUDE.md',
  '.claude/rules',
  '.claude/skills',
  '.claude/commands',
  '.claude/agents',
]

/** The items of `HELD` that `directory` holds, or null when the rule cannot see one of them: a
 *  path that does not read, a link with no target, or a link that leaves `bound`. */
function heldIn(directory: string, bound: string): string[] | null {
  const held: string[] = []
  for (const item of HELD) {
    const entry = path.join(directory, item)
    const real = realOf(entry)
    if (real === null) {
      if (danglingOf(entry) !== null) {
        return null
      }
    } else if (real === UNREADABLE || !isInside(real, bound)) {
      return null
    } else {
      held.push(item)
    }
  }
  return held
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'noConfig' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Do not list a directory with Claude configuration in additionalDirectories, which loads none of it',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      noConfig:
        '"{{directory}}" holds {{items}}. Claude Code loads none of it from a directory in "additionalDirectories", which grants file access only. Add the directory with --add-dir to load skills, commands and agents. CLAUDE.md and rules also need CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1. Or start Claude Code in that directory.',
    },
  },
  create(context) {
    const kind = kindOf(context.filename)
    if (kind === 'managed') {
      return {}
    }
    const project = realDirectory(path.dirname(path.dirname(path.resolve(context.filename))))
    const bound = repositoryRoot(project)
    return settingsListener(context, (_entries, document) => {
      const list = valueAt(document, ['permissions', 'additionalDirectories'])
      for (const node of stringEntries(list)) {
        const entry = node.value
        // A home path, a variable and a NUL byte need no check here. `~` and `$` start a name
        // below the project, which the rule skips, and a NUL byte makes the read fail.
        const isAbsolute = path.isAbsolute(entry)
        if (!isAbsolute && kind === 'local') {
          continue
        }
        const target = path.resolve(project, entry)
        // The lexical path decides first, so that no call reaches a path above the repository.
        if (!isInside(target, bound)) {
          continue
        }
        const real = realOf(target)
        if (typeof real !== 'string' || !isInside(real, bound)) {
          continue
        }
        // The project directory, a directory above it and one below it load their configuration
        // as part of the project.
        if (isInside(real, project) || isInside(project, real)) {
          continue
        }
        const held = heldIn(real, bound)
        if (held !== null && held.length > 0) {
          context.report({
            loc: node.loc,
            messageId: 'noConfig',
            data: { directory: entry, items: held.map((item) => `\`${item}\``).join(', ') },
          })
        }
      }
    })
  },
}

export default {
  name,
  language: 'json' as const,
  files: SETTINGS_FILES,
  rule,
}

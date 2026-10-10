// Three allow forms that Claude Code never honors (docs/rules/permissions-protected-path-allow.md):
// an `Edit` rule for a protected path, an `allowWrite` entry for a protected path of the sandbox,
// and a `Bash` rule for `rm` or `rmdir` on a critical path.
import type { JSONRuleDefinition } from '@eslint/json'
import {
  CLAUDE_DIRECTORY_EXCEPTIONS,
  PROTECTED_DIRECTORIES,
  PROTECTED_FILES,
  SANDBOX_PROTECTED_PATHS,
} from '../data/protected-paths.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { commandWords } from '../permission-command.ts'
import { SETTINGS_FILES, settingsListener } from '../permission-listener.ts'
import { kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'permissions-protected-path-allow' as const

type MessageId = 'protectedEdit' | 'protectedSandbox' | 'criticalRemoval'

/** The segments of a path, with no empty segment and no `.` segment. */
const segmentsOf = (path: string) => path.split('/').filter((s) => s !== '' && s !== '.')

/** True when `segments` starts with `path`. */
const startsWith = (segments: readonly string[], path: readonly string[]) =>
  path.every((segment, i) => segments[i] === segment)

/** The protected path that the pattern of an `Edit` rule is at or under, or
 *  null. The pattern must start at the protected path, after the anchor and
 *  any `**` at the start. A pattern that starts at a `//` root with no `**` names
 *  a directory outside the project, so the rule cannot tell. A pattern above a
 *  protected path, such as `**`, also covers paths that Claude Code can
 *  pre-approve, so it is no fault. */
function protectedEditPath(specifier: string): string | null {
  const isAbsolute = specifier.startsWith('//')
  const anchored = isAbsolute || specifier.startsWith('~/') ? specifier.slice(2) : specifier
  const all = segmentsOf(anchored)
  const start = all.findIndex((segment) => segment !== '**')
  if (start === -1 || (isAbsolute && start === 0)) {
    return null
  }
  const segments = all.slice(start)
  const directory = PROTECTED_DIRECTORIES.find((path) => startsWith(segments, path))
  if (directory !== undefined) {
    const next = segments[directory.length]
    const isException =
      directory[0] === '.claude' && next !== undefined && CLAUDE_DIRECTORY_EXCEPTIONS.includes(next)
    return isException ? null : directory.join('/')
  }
  return segments.length === 1
    ? (PROTECTED_FILES.find((file) => file === segments[0]) ?? null)
    : null
}

/** The protected path of the sandbox that the `allowWrite` entry is at or
 *  under, or null. The rule reads an entry that is relative to the project. A
 *  path with a `/` at the start, and a `~/` path, have other first segments
 *  than a protected path. An entry with a wildcard is skipped, because the
 *  sandbox skips it on Linux. */
function protectedSandboxPath(entry: string): string | null {
  if (entry.startsWith('/')) {
    return null
  }
  const trimmed = entry.endsWith('/**') ? entry.slice(0, -3) : entry
  if (/[*?[]/.test(trimmed)) {
    return null
  }
  const segments = segmentsOf(trimmed)
  return SANDBOX_PROTECTED_PATHS.find((path) => startsWith(segments, path))?.join('/') ?? null
}

/** A target that the docs name as a critical path: the root, a direct child
 *  of the root, the home directory, the working directory and its parent. */
const CRITICAL_TARGET = /^(?:\/|~\/?|\$HOME\/?|\$\{HOME\}\/?|\.{1,2}\/?|\/[^/]+\/?)$/

/** The first target of an `rm` or `rmdir` rule that is a critical path, or
 *  null. A rule with a wildcard also approves other targets, so it is no
 *  fault. */
function criticalTarget(specifier: string): string | null {
  const [program, ...rest] = commandWords(specifier)
  if ((program !== 'rm' && program !== 'rmdir') || specifier.includes('*')) {
    return null
  }
  const targets = rest.map((word) => word.replace(/^(["'])(.*)\1$/, '$2'))
  return targets.find((target) => CRITICAL_TARGET.test(target)) ?? null
}

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not allow a write to a protected path or the removal of a critical path',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      protectedEdit:
        '`{{rule}}` does not pre-approve writes to `{{path}}`, a protected path. Claude Code runs the protected-path check before it reads allow rules from settings. Remove the rule.',
      protectedSandbox:
        '`{{entry}}` is at or under `{{path}}`, a protected path of the sandbox. An `allowWrite` entry cannot lift that protection. Remove the entry.',
      criticalRemoval:
        '`{{rule}}` never approves the command: Claude Code does not let an allow rule approve `rm` or `rmdir` on a critical path such as `{{target}}`. Remove the rule.',
    },
  },
  create(context) {
    const isManaged = kindOf(context.filename) === 'managed'
    return settingsListener(context, (entries, document) => {
      for (const { list, loc, rule: parsed } of entries) {
        const { tool, specifier } = parsed
        if (list !== 'allow' || specifier === null) {
          continue
        }
        const text = `${tool}(${specifier})`
        const path = tool === 'Edit' ? protectedEditPath(specifier) : null
        const target = tool === 'Bash' ? criticalTarget(specifier) : null
        if (path !== null) {
          context.report({ loc, messageId: 'protectedEdit', data: { rule: text, path } })
        } else if (target !== null) {
          context.report({ loc, messageId: 'criticalRemoval', data: { rule: text, target } })
        }
      }
      // The docs say that a relative path in `allowWrite` is relative to the project root
      // for project settings. They do not say what it is relative to in a managed file.
      if (isManaged) {
        return
      }
      const sandbox = lastMember(document.body, 'sandbox')?.value
      const filesystem = lastMember(sandbox, 'filesystem')?.value
      const allowWrite = lastMember(filesystem, 'allowWrite')?.value
      for (const { value } of allowWrite?.type === 'Array' ? allowWrite.elements : []) {
        const path = value.type === 'String' ? protectedSandboxPath(value.value) : null
        if (value.type === 'String' && path !== null) {
          context.report({
            loc: value.loc,
            messageId: 'protectedSandbox',
            data: { entry: value.value, path },
          })
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

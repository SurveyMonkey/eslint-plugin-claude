// Helpers for the tests of the hooks output rules. These rules read a command that a hook runs, and the
// repository script that it names. A case builds a repository on disk, and each unreadable script is a case
// in which a rule must stay silent (ADR 001, Decision 14).
import { execFileSync } from 'node:child_process'
import { mkdirSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import { repo } from './agent-settings.test-support.ts'
import { command, hooks, settings } from './hooks.test-support.ts'
import { lintJson } from './rule-tester.test-support.ts'

export const P = `\${CLAUDE_PROJECT_DIR}`

/** The system tool that makes a FIFO. Node has no call for it. */
const MAKE_FIFO = 'mkfifo'

export interface Case {
  event: string
  matcher?: unknown
  /** More fields of the handler. The default `command` runs `hooks/s.sh`. */
  fields?: Record<string, unknown>
  options?: unknown[]
  /** The whole text of the settings file, for a case with more than one handler. */
  text?: string
}

/** The settings text of the case: one handler that runs `hooks/s.sh`, unless the case gives the text. */
const textOf = (found: Case) =>
  found.text ??
  settings(
    hooks(found.event, [command({ command: `${P}/hooks/s.sh`, ...found.fields })], found.matcher),
  )

/** The message ids of the rule `name` for one handler of the case, in a repository with `files`. */
export function lintScript(name: string, files: Record<string, string>, found: Case) {
  const text = textOf(found)
  const root = repo({ ...files, '.claude/settings.json': text })
  return lintJson(name, text, path.join(root, '.claude/settings.json'), found.options).map(
    (message) => message.messageId,
  )
}

/** The message ids of the rule `name` for one inline handler. */
export function lintInline(name: string, found: Case, line: string) {
  return lintJson(
    name,
    settings(hooks(found.event, [command({ command: line, ...found.fields })], found.matcher)),
    '/repo/.claude/settings.json',
    found.options,
  ).map((message) => message.messageId)
}

/** The message ids for the script text `body` in each way that a script can be unreadable: it is missing, a
 *  folder, a FIFO, a link out of the repository, a link with no target, a file over one megabyte, or a binary
 *  file. */
export function unreadable(
  name: string,
  body: string,
  found: Case,
): [string, (string | undefined)[]][] {
  const text = textOf(found)
  const settingsFile = '.claude/settings.json'
  const lint = (root: string) =>
    lintJson(name, text, path.join(root, settingsFile), found.options).map(
      (message) => message.messageId,
    )
  const cases: [string, (string | undefined)[]][] = [
    ['missing', lint(repo({ [settingsFile]: text }))],
    ['folder', lint(repo({ [settingsFile]: text, 'hooks/s.sh/keep': '' }))],
    [
      'large',
      lint(repo({ [settingsFile]: text, 'hooks/s.sh': `${body}\n#${'x'.repeat(1_000_001)}` })),
    ],
    ['binary', lint(repo({ [settingsFile]: text, 'hooks/s.sh': `${body}\n\0` }))],
  ]
  const outside = repo({ 'x/s.sh': body })
  const linked = repo({ [settingsFile]: text })
  mkdirSync(path.join(linked, 'hooks'))
  symlinkSync(path.join(outside, 'x/s.sh'), path.join(linked, 'hooks/s.sh'))
  cases.push(['link out', lint(linked)])
  const dangling = repo({ [settingsFile]: text })
  mkdirSync(path.join(dangling, 'hooks'))
  symlinkSync(path.join(dangling, 'gone.sh'), path.join(dangling, 'hooks/s.sh'))
  cases.push(['dangling link', lint(dangling)])
  if (process.platform !== 'win32') {
    const fifo = repo({ [settingsFile]: text })
    mkdirSync(path.join(fifo, 'hooks'))
    execFileSync(MAKE_FIFO, [path.join(fifo, 'hooks/s.sh')])
    cases.push(['fifo', lint(fifo)])
  }
  return cases
}

// An `allowWrite` entry that lets a sandboxed command write a shell startup file, a system
// configuration directory or a directory of executables (docs/rules/sandbox-allow-write-escalation.md).
// The security limitations warn that "directories containing executables in `$PATH`, system
// configuration directories, or user shell configuration files such as `.bashrc` or `.zshrc`" can
// lead to code execution in other contexts
// (https://code.claude.com/docs/en/sandboxing#security-limitations). The rule cannot read
// `$PATH`, so it uses the usual directories. Both examples of the docs, `~/.kube` and
// `/tmp/build`, stay silent. A project path is relative, and the sandbox already protects a
// startup file of the working directory, so those get no report. The prefix table of the docs has
// no `$HOME` form, so `$HOME/.zshrc` is a path relative to the project.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { sandboxPath, stringEntries, valueAt } from '../permission-sandbox.ts'
import { isHiddenDropIn, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'sandbox-allow-write-escalation' as const

type MessageId = 'startup' | 'system' | 'executables' | 'broad'

/** A home directory, in the forms of the sandbox path prefixes. */
const HOME = `(?:~|/Users/[^/]+|/home/[^/]+|/root)`
/** The startup files of the usual shells. The docs name `.bashrc` and `.zshrc` and say "such as". */
const STARTUP = new RegExp(
  String.raw`^${HOME}/(?:\.bashrc|\.bash_profile|\.bash_login|\.profile|\.zshrc|\.zshenv|\.zprofile|\.zlogin|\.config/fish/config\.fish)$`,
)
const SYSTEM = /^\/etc(?:\/|$)/
/** The usual directories of executables. A path in one of them counts too. */
const EXECUTABLES = new RegExp(
  String.raw`^(?:/s?bin|/usr/s?bin|/usr/local/s?bin|/opt/homebrew/s?bin|${HOME}/bin|${HOME}/\.local/bin)(?:/|$)`,
)
/** The directories that hold a startup file or a directory of executables. */
const BROAD = new RegExp(`^(?:/|/usr|/usr/local|${HOME})$`)

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Do not let sandboxed commands write shell startup files or executable directories',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      startup:
        '`{{entry}}` lets sandboxed commands write a shell startup file. The shell runs that file in a new session, outside the sandbox. Remove the entry.',
      system:
        '`{{entry}}` lets sandboxed commands write a system configuration directory. Other users and system processes read these files, so this can lead to code execution in another context. Remove the entry.',
      executables:
        '`{{entry}}` lets sandboxed commands write a directory of executables. A command that a person or a process runs later can be one that the sandbox wrote. Remove the entry, or give the tool one path.',
      broad:
        '`{{entry}}` lets sandboxed commands write a directory that holds shell startup files or executables. Overly broad write access can lead to privilege escalation. Name the one path that the tool needs.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        for (const entry of stringEntries(valueAt(node, ['sandbox', 'filesystem', 'allowWrite']))) {
          const path = sandboxPath(entry.value)
          const messageId: MessageId | null = STARTUP.test(path)
            ? 'startup'
            : SYSTEM.test(path)
              ? 'system'
              : EXECUTABLES.test(path)
                ? 'executables'
                : BROAD.test(path)
                  ? 'broad'
                  : null
          if (messageId !== null) {
            context.report({ node: entry, messageId, data: { entry: entry.value } })
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

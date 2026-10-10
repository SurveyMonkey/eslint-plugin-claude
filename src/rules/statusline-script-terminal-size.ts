// A status line script that calls `tput cols` (docs/rules/statusline-script-terminal-size.md).
// The statusline page says that Claude Code captures the output of the script, so `tput cols`
// cannot read the terminal size from inside it. The script must read `COLUMNS` and `LINES`. The
// rule finds the script in the `statusLine` command, reads it from the repository, and looks for
// the call in its text. It reads only a script inside the repository (ADR 001, Decision 14). A
// script that is missing, out of the repository, or unreadable gets no report.
//
// `src/script-refs.ts` on the git execution layer resolves the same script words for
// `statusline-script-exists`. That module is not in this stack. `scriptWord` below is the small
// part of it that this rule needs, and `scriptRefs` replaces it when both layers are in one tree.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { realSource } from '../marketplace-source.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isDropIn, isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'
import { isInside, realDirectory, repositoryRoot } from '../skill-tree.ts'

const name = 'statusline-script-terminal-size' as const

// The programs that run a file, which is their first argument.
const INTERPRETERS = new Set([
  'bash',
  'sh',
  'zsh',
  'node',
  'python',
  'python3',
  'deno',
  'bun',
  'pwsh',
  'powershell',
  'ruby',
  'perl',
])

// One word of a shell command: a quoted string, or characters up to a separator or a quote.
const WORD = /^\s*(?:"([^"]*)"|'([^']*)'|([^\s|&;<>()"']+))/
const PLACEHOLDER = /^\$(?:\{CLAUDE_PROJECT_DIR\}|CLAUDE_PROJECT_DIR)\/(.+)$/
// A path with one of these characters can hold a variable, a substitution, a glob, a brace list, a
// home path, a Windows path, a history mark, a comment or an assignment. The rule cannot resolve it.
const UNRESOLVED = /[$`*?[\]{}\\~:=!#]/

/** The word of `command` that names the script: the program, or the first argument when the
 *  program is an interpreter. `first` is true for the program. */
function scriptWord(command: string): { text: string; first: boolean } | undefined {
  const words: string[] = []
  let rest = command
  while (words.length < 2) {
    const match = WORD.exec(rest)
    if (match === null) {
      break
    }
    words.push(match[1] ?? match[2] ?? (match[3] as string))
    rest = rest.slice(match[0].length)
    if (!INTERPRETERS.has(path.posix.basename(words[0] as string))) {
      break
    }
  }
  const interpreter = INTERPRETERS.has(path.posix.basename(words[0] ?? ''))
  const text = interpreter ? words[1] : words[0]
  return text === undefined ? undefined : { text, first: !interpreter }
}

/** The word that names the script of `command`, and the text of the script. The result is
 *  undefined when the rule cannot see the script. A
 *  project file resolves a path from the project, which holds `.claude/`. A managed file has no
 *  project of its own, so it resolves a project variable from the repository root only. */
function scriptOf(command: string, filename: string): { word: string; text: string } | undefined {
  const word = scriptWord(command)
  if (word === undefined) {
    return undefined
  }
  const file = path.resolve(filename)
  const managed = kindOf(file) === 'managed'
  const dir = managed && !isDropIn(file) ? path.dirname(file) : path.dirname(path.dirname(file))
  const project = realDirectory(dir)
  const bound = repositoryRoot(project)
  const from = managed ? bound : project
  const match = PLACEHOLDER.exec(word.text)
  // A bare relative path names a script only for the program, and only when the file has a project.
  const rest =
    match?.[1] ??
    (word.first && !managed && word.text.includes('/') && !word.text.startsWith('/')
      ? word.text
      : undefined)
  if (rest === undefined || UNRESOLVED.test(rest) || rest.endsWith('/')) {
    return undefined
  }
  const script = path.resolve(from, rest)
  const real = isInside(script, bound) ? realSource(bound, bound, bound, script) : undefined
  if (typeof real !== 'string') {
    return undefined
  }
  try {
    return { word: word.text, text: readFileSync(real, 'utf8') }
  } catch {
    return undefined
  }
}

// A line that starts with `#` is a comment, so `tput cols` in it is not a call.
const calls = (text: string) =>
  text.split('\n').some((line) => !line.trimStart().startsWith('#') && /\btput\s+cols\b/.test(line))

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: 'tput' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Read COLUMNS and LINES in a status line script, not tput cols',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      tput: 'The status line script "{{path}}" calls "tput cols". Claude Code captures the output of the script, so the call cannot read the terminal size. Read the environment variables COLUMNS and LINES.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    return {
      Document(node) {
        const command = lastMember(lastMember(node.body, 'statusLine')?.value, 'command')?.value
        if (command?.type !== 'String') {
          return
        }
        const script = scriptOf(command.value, context.filename)
        if (script !== undefined && calls(script.text)) {
          context.report({ node: command, messageId: 'tput', data: { path: script.word } })
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

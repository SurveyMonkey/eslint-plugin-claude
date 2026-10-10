// An injected command aborts the whole skill invocation when it fails or when no permission rule
// allows it (docs/rules/skill-inject-robustness.md). The rule is a heuristic. It reads the
// commands as text, and it reads no settings file.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { parsedEntries, skillEntries } from '../permission-entries.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-inject-robustness' as const

/** Commands that run without a permission prompt, from the permissions page: "The set includes".
 *  The docs do not list the rest of the set, and the rule treats each name as read-only whatever
 *  its flags. `git` is here whole, because the docs name only "read-only forms of `git`". */
const READ_ONLY = new Set([
  'ls',
  'cat',
  'echo',
  'pwd',
  'head',
  'tail',
  'grep',
  'find',
  'wc',
  'which',
  'diff',
  'stat',
  'du',
  'cd',
  'git',
])

/** The commands that change nothing. `|| true` is the fallback that the docs give. */
const NO_OP = new Set(['true', ':'])

/** The wrappers that Claude Code strips before it matches a rule. The rule does not strip them
 *  and does not judge a command that starts with one. A `NAME=value` at the start is the same. */
const WRAPPERS = new Set(['timeout', 'time', 'nice', 'nohup', 'stdbuf', 'command', 'builtin'])

/** The programs that run a script file given as their first argument. */
const INTERPRETERS = new Set(['bash', 'sh', 'zsh', 'node', 'python', 'python3', 'ruby', 'perl'])

const SCRIPT_EXTENSION = /\.(?:sh|bash|zsh|py|js|mjs|cjs|ts|rb|pl)$/

/** The file name of a script that reports a problem by its exit code. */
const CHECK_NAME = /(?<![a-z])(?:check|lint|verify|validate)(?![a-z])/i

// The parts of a command that hide a separator: a quoted string, and a redirection such as
// `2>&1` or `&>`.
const HIDDEN = /"(?:[^"\\]|\\.)*"|'[^']*'|\d*[<>]&\d*-?|&>>?/gs

// The separators of the permissions page: `&&`, `||`, `;`, `|`, `|&`, `&` and a line break.
const SEPARATOR = /&&|\|\||\|&|[;|&\n]/g

/** The subcommands of `text`. A line break after a backslash does not split. */
function subcommands(text: string): string[] {
  const joined = text.replaceAll('\\\n', ' ')
  const masked = joined.replace(HIDDEN, (part) => 'x'.repeat(part.length))
  const parts: string[] = []
  let from = 0
  for (const match of masked.matchAll(SEPARATOR)) {
    parts.push(joined.slice(from, match.index))
    from = match.index + match[0].length
  }
  parts.push(joined.slice(from))
  return parts.map((part) => part.trim()).filter((part) => part !== '')
}

/** True when the Bash rule `specifier` allows the command `command`. A `*` stands for any text.
 *  A ` *` at the end that is the only `*` also allows the bare command. `:*` at the end is the same
 *  as ` *`. */
function allows(specifier: string | null, command: string): boolean {
  if (specifier === null) {
    return true
  }
  const pattern = specifier.endsWith(':*') ? `${specifier.slice(0, -2)} *` : specifier
  const parts = pattern.split('*')
  const escaped = parts.map((part) => part.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return (
    new RegExp(`^${escaped.join('.*')}$`, 's').test(command) ||
    (parts.length === 2 && pattern.endsWith(' *') && command === pattern.slice(0, -2))
  )
}

/** The first word of a subcommand, with no quote around it. */
function wordsOf(subcommand: string): string[] {
  return subcommand.split(/\s+/).map((word) => word.replaceAll(/^["']|["']$/g, ''))
}

/** True when the subcommand is one that the rule does not judge: a read-only command, a no-op, a
 *  command with a wrapper, or a command that starts with a variable. */
function skipped(subcommand: string): boolean {
  const program = wordsOf(subcommand)[0] as string
  return (
    READ_ONLY.has(program) ||
    NO_OP.has(program) ||
    WRAPPERS.has(program) ||
    /^[A-Za-z_]\w*=/.test(program)
  )
}

/** The script path of a subcommand: its program when that holds a `/`, or the first argument of
 *  an interpreter when that is not a flag and holds a `/` or a script extension. Null otherwise. */
function scriptPath(subcommand: string): string | null {
  const [program, argument] = wordsOf(subcommand) as [string, string | undefined]
  if (INTERPRETERS.has(program)) {
    return argument !== undefined &&
      !argument.startsWith('-') &&
      (argument.includes('/') || SCRIPT_EXTENSION.test(argument))
      ? argument
      : null
  }
  return program.includes('/') ? program : null
}

/** True for a path that depends on the working directory: it does not start with `/`, `~` or `$`. */
function isRelative(file: string): boolean {
  return !/^[/~$]/.test(file)
}

type MessageId = 'unmatched' | 'relativePath' | 'checkExit' | 'nested'

/** The first fault of each kind in one command. `rules` is null when the rule cannot read the
 *  Bash rules of the skill. Then it makes no `unmatched` report. */
function faults(text: string, rules: (string | null)[] | null): [MessageId, string][] {
  const found: [MessageId, string][] = []
  const parts = subcommands(text)
  if (parts.length === 0) {
    return found
  }
  const unmatched =
    rules === null
      ? undefined
      : parts.find((part) => !skipped(part) && !rules.some((rule) => allows(rule, part)))
  if (unmatched !== undefined) {
    found.push(['unmatched', unmatched])
  }
  const relative = parts
    .map(scriptPath)
    .filter((file) => file !== null)
    .find(isRelative)
  if (relative !== undefined) {
    found.push(['relativePath', relative])
  }
  // The exit code of the last subcommand is the exit code of the command.
  const tail = scriptPath(parts.at(-1) as string)
  if (tail !== null && CHECK_NAME.test(tail.split('/').pop() as string)) {
    found.push(['checkExit', tail])
  }
  if (text.includes('!`')) {
    found.push(['nested', '!`'])
  }
  return found
}

const rule: MarkdownRuleDefinition<{ MessageIds: MessageId }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Make the injected commands of a skill robust',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      unmatched:
        'No `allowed-tools` Bash rule matches `{{found}}`. Outside auto mode, Claude Code aborts the skill invocation for a command that no rule allows. Add a `Bash(...)` rule to `allowed-tools`.',
      relativePath:
        '`{{found}}` is a relative path. An injected command runs in the working directory of the session shell, which moves when Claude runs `cd`. Start the path with `{{skillDir}}` or `{{projectDir}}`.',
      checkExit:
        'A non-zero exit code of `{{found}}` aborts the skill invocation. Add `|| true` to a check script that exits 1 when it finds problems.',
      nested:
        'Claude Code does not scan the output of an injected command for another placeholder. A command cannot print `{{found}}` for a later pass to expand.',
    },
  },
  create(context) {
    if (classifySkillFile(context.filename) === null) {
      return {}
    }
    const { sourceCode } = context
    // The Bash rules of `allowed-tools`. Null when the rule cannot read them. A skill with no
    // frontmatter has none.
    let rules: (string | null)[] | null = []
    const commands: { text: string; loc: ReturnType<typeof sourceCode.getLoc> }[] = []
    return {
      yaml(node) {
        const fm = readFrontmatter(sourceCode, node)
        // A bad block hides the rules. A `powershell` shell needs `PowerShell` rules instead.
        if (fm === null || fm.data.shell === 'powershell') {
          rules = null
          return
        }
        rules = parsedEntries(skillEntries(fm, node.value)).flatMap(({ list, rule: entry }) =>
          list === 'allow' && entry.tool === 'Bash' ? [entry.specifier] : [],
        )
      },
      // The inline form: `!` at the start of a line or after whitespace, then a code span.
      inlineCode(node) {
        const [start] = sourceCode.getRange(node)
        const before = sourceCode.text.slice(Math.max(0, start - 2), start)
        if (before === '!' || /^\s!$/.test(before)) {
          commands.push({ text: node.value, loc: sourceCode.getLoc(node) })
        }
      },
      // The block form: a fence with the info string `!`.
      code(node) {
        if (node.lang === '!') {
          commands.push({ text: node.value, loc: sourceCode.getLoc(node) })
        }
      },
      'root:exit'() {
        for (const { text, loc } of commands) {
          for (const [messageId, found] of faults(text, rules)) {
            context.report({
              loc,
              messageId,
              data: {
                found,
                skillDir: `\${CLAUDE_SKILL_DIR}`,
                projectDir: `\${CLAUDE_PROJECT_DIR}`,
              },
            })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/SKILL.md', '**/commands/**/*.md'],
  rule,
}

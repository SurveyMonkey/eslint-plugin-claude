// A skill with side effects sets `disable-model-invocation: true`, so that only the user starts it
// (docs/rules/skill-side-effects-manual-only.md). The rule is a heuristic. It reads the `Bash`
// rules of `allowed-tools` and the injected commands as text. It looks for the words of a
// pattern.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import type { AST } from 'eslint'
import { docsUrl } from '../docs-url.ts'
import { readBoolean } from '../frontmatter-boolean.ts'
import { parsedEntries, skillEntries } from '../permission-entries.ts'
import { followsBang, READ_ONLY, subcommands, wordsOf } from '../shell-split.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-side-effects-manual-only' as const

/** The patterns that the rule looks for. The option `patterns` adds to them. The skills page
 *  names `/commit`, `/deploy` and `/send-slack-message` as skills with side effects. */
const DEFAULT_PATTERNS = ['git push', 'git commit', 'deploy', 'send message']

// The parts of a command that split it into words: white space, a path separator, and the
// characters that join a name, such as `deploy.sh`, `send_message` and `NAME=value`.
const WORD_BREAK = /[\s/:=._]+/

// A quoted string is text, not a command, so the rule does not read it.
const QUOTED = /"(?:[^"\\]|\\.)*"|'[^']*'/g

/** The lowercase words of `text`, with no quoted string. */
function wordsIn(text: string): string[] {
  return text
    .replace(QUOTED, ' ')
    .toLowerCase()
    .split(WORD_BREAK)
    .filter((word) => word !== '')
}

/** True when `words` holds `pattern` as a run of words next to each other. */
function holdsRun(words: string[], pattern: string[]): boolean {
  return words.some((_, from) => pattern.every((word, at) => words[from + at] === word))
}

interface Pattern {
  text: string
  words: string[]
}

/** The first pattern that `text` holds, or undefined. */
function match(text: string, patterns: Pattern[]): string | undefined {
  const words = wordsIn(text)
  return patterns.find((pattern) => holdsRun(words, pattern.words))?.text
}

/** True for an injected command that only prints or reads, such as `echo deploy`. `git` is in the
 *  set because its read-only forms need no prompt, but `git push` is a side effect. */
function readsOnly(subcommand: string): boolean {
  const program = wordsOf(subcommand)[0] as string
  return program !== 'git' && READ_ONLY.has(program)
}

type Options = [{ patterns: string[] }]

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'sideEffect' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Let only the user invoke a skill that has side effects',
      url: docsUrl(name),
    },
    // Each item needs a letter or a digit. A quoted item can still give no word, so `create`
    // drops it.
    schema: [
      {
        type: 'object',
        properties: {
          patterns: {
            type: 'array',
            items: { type: 'string', pattern: '[A-Za-z0-9]' },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ patterns: [] }],
    messages: {
      sideEffect:
        '`{{found}}` is a side effect, and Claude can invoke this skill on its own. Set `disable-model-invocation: true`, so that only the user starts it.',
    },
  },
  create(context) {
    if (classifySkillFile(context.filename) === null) {
      return {}
    }
    const { sourceCode } = context
    const [{ patterns: extra }] = context.options
    const patterns = [...DEFAULT_PATTERNS, ...extra]
      .map((text) => ({ text, words: wordsIn(text) }))
      .filter((pattern) => pattern.words.length > 0)
    // True when the skill cannot be invoked by Claude, or when the rule cannot read the block.
    let exempt = false
    // The evidence in file order: a rule of `allowed-tools` first, then an injected command.
    const found: { pattern: string; loc: AST.SourceLocation }[] = []
    const scan = (text: string, loc: AST.SourceLocation) => {
      const pattern = subcommands(text)
        .filter((part) => !readsOnly(part))
        .map((part) => match(part, patterns))
        .find((hit) => hit !== undefined)
      if (pattern !== undefined) {
        found.push({ pattern, loc })
      }
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(sourceCode, node)
        // A block that does not parse hides the fields. Claude Code may skip it.
        if (
          fm === null ||
          readBoolean(fm.data['disable-model-invocation']) === true ||
          readBoolean(fm.data['user-invocable']) === false
        ) {
          exempt = true
          return
        }
        for (const { list, loc, rule: entry } of parsedEntries(skillEntries(fm, node.value))) {
          const pattern =
            list === 'allow' && entry.tool === 'Bash' && entry.specifier !== null
              ? match(entry.specifier, patterns)
              : undefined
          if (pattern !== undefined) {
            found.push({ pattern, loc })
          }
        }
      },
      // The inline form: `!` at the start of a line or after whitespace, then a code span.
      inlineCode(node) {
        if (followsBang(sourceCode.text, sourceCode.getRange(node)[0])) {
          scan(node.value, sourceCode.getLoc(node))
        }
      },
      // The block form: a fence with the info string `!`.
      code(node) {
        if (node.lang === '!') {
          scan(node.value, sourceCode.getLoc(node))
        }
      },
      'root:exit'() {
        const first = found[0]
        if (!exempt && first !== undefined) {
          context.report({
            loc: first.loc,
            messageId: 'sideEffect',
            data: { found: first.pattern },
          })
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

// Commit and pull request rules in a CLAUDE.md or a rule file, with the built-in git instructions
// still on (docs/rules/claude-md-git-instructions.md). Claude Code adds its own commit and pull
// request instructions. The docs say that when a CLAUDE.md sets such rules, you turn the built-in
// ones off with the setting `includeGitInstructions`, or with the variable
// `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS`, which takes precedence. The rule reads the project
// settings file `.claude/settings.json` of the folder of the instruction file, and of each folder
// above it, up to the repository root: the setting, and the variable in `env` with the value `1`.
// It reads no file out of the repository. It makes no report when it
// cannot read a settings file (ADR 001, Decision 14). A user or local settings file can also set
// the key, and the rule does not read them, so it is a heuristic. The text check is a heuristic
// too: a sentence that names a commit or pull request topic and has an instruction cue.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile, type MemoryFileKind } from '../memory-files.ts'
import { gitTop } from '../memory-imports.ts'
import { readJson, repositoryRoot, UNREADABLE } from '../skill-tree.ts'

const name = 'claude-md-git-instructions' as const

// A sentence names a commit or pull request topic.
const TOPIC =
  /\b(?:commit (?:messages?|styles?|formats?|conventions?|bod(?:y|ies)|titles?|subjects?|prefix(?:es)?)|conventional commits?|pull requests?|PR (?:titles?|descriptions?|bod(?:y|ies)|templates?)|gh pr create|git commit|co-authored-by|signed-off-by|squash)\b/i
// A sentence has an instruction cue.
const CUE =
  /\b(?:must|should|always|never|do not|don't|use|write|follow|include|keep|add|prefix|start|format|sign|limit|end|avoid|open|create|rebase|link|reference|run)\b/i
// A sentence ends at `.`, `!` or `?` with a space or the end of the block after it, or at a line end.
const SENTENCE = /(?:[^.!?\n]|[.!?](?!\s|$))+[.!?]?/g

// The variable that removes the built-in git instructions. It takes precedence over the setting.
const DISABLE_VARIABLE = 'CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS'

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** The folder that holds the `.claude` folder of the instruction file `file`, or the folder of the
 *  file. A rule file is below `.claude/rules/`, at any depth. */
function homeOf(file: string, kind: MemoryFileKind): string {
  let dir = path.dirname(file)
  if (kind === 'rule') {
    while (path.basename(dir) !== 'rules' || path.basename(path.dirname(dir)) !== '.claude') {
      dir = path.dirname(dir)
    }
    return path.dirname(path.dirname(dir))
  }
  return path.basename(dir) === '.claude' ? path.dirname(dir) : dir
}

/** True when a project settings file of `home`, or of a folder above it up to the repository
 *  root, sets `includeGitInstructions` to `false`, or `env.CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS`
 *  to `1`. It is also true when a settings file cannot be read, because that file can hold the
 *  key. */
function turnedOff(home: string): boolean {
  const bound = repositoryRoot(home)
  const top = gitTop(home) ?? home
  for (let dir = home; ; dir = path.dirname(dir)) {
    const parsed = readJson(path.join(dir, '.claude', 'settings.json'), bound)
    if (parsed === UNREADABLE) {
      return true
    }
    if (parsed !== null) {
      // A file that does not parse, or is not an object, can hold any key.
      if (!isObject(parsed.data) || parsed.data.includeGitInstructions === false) {
        return true
      }
      // The env variable takes precedence over the setting. The docs give the value `1`.
      const { env } = parsed.data
      if (isObject(env) && String(env[DISABLE_VARIABLE]) === '1') {
        return true
      }
    }
    if (dir === top) {
      return false
    }
  }
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'gitInstructions' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Turn off the built-in git instructions when CLAUDE.md sets git rules',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      gitInstructions:
        'This file sets commit or pull request rules, and the project settings do not set `includeGitInstructions` to `false`. Claude Code adds its own git instructions, which compete with these rules. Set the key to `false` in `.claude/settings.json`.',
    },
  },
  create(context) {
    const kind = classifyMemoryFile(context.filename)
    if (kind !== 'claude-md' && kind !== 'rule') {
      return {}
    }
    const { sourceCode } = context
    const home = homeOf(path.resolve(context.filename), kind)
    let reported = false
    return {
      'paragraph, heading'(node) {
        if (reported) {
          return
        }
        const from = sourceCode.getRange(node)[0]
        for (const sentence of sourceCode.getText(node).matchAll(SENTENCE)) {
          const text = sentence[0].trim()
          if (TOPIC.test(text) && CUE.test(text)) {
            reported = true
            // The settings are read only for a file that sets git rules.
            if (!turnedOff(home)) {
              const start = from + sentence.index + sentence[0].indexOf(text)
              context.report({
                loc: {
                  start: sourceCode.getLocFromIndex(start),
                  end: sourceCode.getLocFromIndex(start + text.length),
                },
                messageId: 'gitInstructions',
              })
            }
            return
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/CLAUDE.md', '**/.claude/rules/**/*.md'],
  rule,
}

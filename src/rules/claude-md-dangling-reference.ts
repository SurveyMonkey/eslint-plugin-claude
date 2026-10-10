// A path or a slash command in a code span that points to nothing
// (docs/rules/claude-md-dangling-reference.md). The docs tell you to write instructions that are
// concrete enough to verify, and give a path as the example. A path that is not there misleads
// Claude. The rule reads the code spans of the syntax tree, so a path in a code block, an HTML
// comment or plain text is not read.
// - A path has a slash, no character that a glob or a placeholder uses, and one of these: an
//   extension, a slash at the end, a start with a dot, or three parts. So `and/or` is not a path.
//   The rule looks for it in the folder of the file and in the repository root.
// - A command is `/name`, with arguments or without. The rule looks for a skill folder or a
//   command file of that name in the `.claude` folders from the folder of the file up to the
//   repository root. The stack has no list of the bundled commands, so the option `allow` names the
//   commands and paths from outside the repository.
// The rule reads no file out of the repository, and makes no report when it cannot see a part of
// the tree: a path out of the repository, a link that leads nowhere, a folder it cannot read
// (ADR 001, Decision 14).
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifyMemoryFile } from '../memory-files.ts'
import { findImport, gitTop, locate } from '../memory-imports.ts'
import { markdownFiles, repositoryRoot, UNREADABLE } from '../skill-tree.ts'

const name = 'claude-md-dangling-reference' as const

type Options = [{ allow: string[] }]

// A path has no space, no glob mark, no placeholder mark and no `@`, `~`, `$` or `:`.
const PATH_CHARACTERS = /^[\w.\-/]+$/
// A line suffix, as in `src/a.ts:12:3`.
const LINE_SUFFIX = /:\d+(?::\d+)?$/
// A command starts with a slash and a name, and goes on with arguments, or ends.
const COMMAND = /^\/([A-Za-z0-9][\w-]*)(?:\s|$)/

/** The path that a code span names, or null when the span is not a path to check. */
function pathOf(value: string): string | null {
  const text = value.replace(LINE_SUFFIX, '')
  if (!PATH_CHARACTERS.test(text) || text.startsWith('/') || text.startsWith('-')) {
    return null
  }
  const parts = text.split('/').filter((part) => part !== '')
  const last = parts[parts.length - 1] as string
  const shaped =
    text.endsWith('/') || text.startsWith('.') || /\.\w+$/.test(last) || parts.length >= 3
  return text.includes('/') && shaped ? text : null
}

type Found = 'found' | 'missing' | typeof UNREADABLE

const rule: MarkdownRuleDefinition<{
  RuleOptions: Options
  MessageIds: 'path' | 'command'
}> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Point only to paths and slash commands that exist in the repository',
      url: docsUrl(name),
    },
    schema: [
      {
        type: 'object',
        properties: { allow: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allow: [] }],
    messages: {
      path: 'The path `{{ref}}` is not in the repository. It is not in the folder of this file or in the repository root. Fix the path, or remove the reference.',
      command:
        'The command `{{ref}}` is not a skill or a command file of this repository. No `.claude/skills/{{name}}/SKILL.md` or `.claude/commands/{{name}}.md` is there. Fix the name, or add it to the `allow` option if it comes from outside the repository.',
    },
  },
  create(context) {
    const kind = classifyMemoryFile(context.filename)
    if (kind !== 'claude-md' && kind !== 'claude-local' && kind !== 'rule') {
      return {}
    }
    const [{ allow }] = context.options
    const allowed = new Set(allow)
    const folder = path.dirname(path.resolve(context.filename))
    const bound = repositoryRoot(folder)
    const top = gitTop(folder) ?? folder
    const folders: string[] = []
    for (let dir = folder; ; dir = path.dirname(dir)) {
      folders.push(dir)
      if (dir === top) {
        break
      }
    }

    /** Look for a path in the folder of the file and in the repository root. */
    function findPath(ref: string): Found {
      const results = [...new Set([folder, top])].map((dir) => findImport(dir, [ref], bound))
      if (results.some((found) => typeof found === 'object')) {
        return 'found'
      }
      return results.includes(UNREADABLE) ? UNREADABLE : 'missing'
    }

    /** Look for a skill folder or a command file named `command` in the `.claude` folders. */
    function findCommand(command: string): Found {
      let result: Found = 'missing'
      for (const dir of folders) {
        const base = path.join(dir, '.claude')
        const commands = path.join(base, 'commands')
        for (const target of [
          path.join(base, 'skills', command, 'SKILL.md'),
          path.join(commands, `${command}.md`),
        ]) {
          const found = locate(target, bound)
          if (typeof found === 'object') {
            return 'found'
          }
          if (found === UNREADABLE) {
            result = UNREADABLE
          }
        }
        // A command in a subfolder of `commands` has the name of its file.
        const scan = markdownFiles(commands, bound)
        if (scan.files.some((file) => path.basename(file, '.md') === command)) {
          return 'found'
        }
        if (scan.unreadable || scan.outside) {
          result = UNREADABLE
        }
      }
      return result
    }

    return {
      inlineCode(node) {
        const command = COMMAND.exec(node.value)?.[1]
        if (command !== undefined) {
          if (
            !allowed.has(`/${command}`) &&
            !allowed.has(command) &&
            findCommand(command) === 'missing'
          ) {
            context.report({
              node,
              messageId: 'command',
              data: { ref: `/${command}`, name: command },
            })
          }
          return
        }
        const ref = pathOf(node.value)
        if (ref !== null && !allowed.has(ref) && findPath(ref) === 'missing') {
          context.report({ node, messageId: 'path', data: { ref } })
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/CLAUDE.md', '**/CLAUDE.local.md', '**/.claude/rules/**/*.md'],
  rule,
}

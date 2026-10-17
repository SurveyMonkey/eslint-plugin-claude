// A skill or command name with a character that Claude Code refuses, or with
// more than 256 characters (docs/rules/skill-name-characters.md). A refused
// folder or file name stops the load. A refused frontmatter `name` is not in the `/` menu. A folder in a
// plugin `skills/` directory is out of scope: Claude Code changes the
// characters to hyphens there.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-name-characters' as const

/** The most characters that Claude Code takes in a name (errors, "Skill or command
 *  name refused"; checked 2026-10-16). No setting moves it. The rule counts code points. */
const NAME_LIMIT = 256

/** The length of `text` in characters when it is over the limit, or null. */
function overLimit(text: string): number | null {
  const length = [...text].length
  return length > NAME_LIMIT ? length : null
}

/** Each class of characters in the docs, with the text of the message.
 *  U+FEFF has the Unicode name ZERO WIDTH NO-BREAK SPACE, so the rule counts it
 *  as a zero-width space. `kindAt` checks a plain space before it reads the classes. */
const CLASSES: [RegExp, string][] = [
  [/[\u{200B}\u{FEFF}]/u, 'a zero-width space'],
  [/\p{Cc}/u, 'a control character'],
  [/\p{Co}/u, 'a private-use character'],
  [/\p{Cn}/u, 'an unassigned character'],
  [/\p{Bidi_Control}/u, 'a character that changes the text direction'],
  [/\p{Z}/u, 'a blank that is not a plain space'],
  [/[<>]/u, 'an angle bracket'],
]

/** The text of the class of the character at `index` of `chars`, or
 *  undefined when Claude Code takes the character. A plain space is a fault
 *  at the start or the end, or before another space. */
function kindAt(chars: string[], index: number): string | undefined {
  const char = chars[index] as string
  if (char !== ' ') {
    return CLASSES.find(([pattern]) => pattern.test(char))?.[1]
  }
  return index === 0 || index === chars.length - 1 || chars[index + 1] === ' '
    ? 'a space at the start or end, or next to another space'
    : undefined
}

/** The first character of `text` that Claude Code refuses, as its code point
 *  and the text of its class, or null. */
function firstFault(text: string): { code: string; kind: string } | null {
  const chars = [...text]
  for (const [index, char] of chars.entries()) {
    const kind = kindAt(chars, index)
    if (kind !== undefined) {
      const point = (char.codePointAt(0) as number).toString(16).toUpperCase()
      return { code: `U+${point.padStart(4, '0')}`, kind }
    }
  }
  return null
}

const rule: MarkdownRuleDefinition<{
  MessageIds: 'folder' | 'command' | 'name' | 'commandLength' | 'nameLength'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not put a character that Claude Code refuses in a skill or command name',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      folder:
        '`{{name}}` holds {{kind}} ({{code}}). Claude Code does not load this skill. Rename the folder.',
      command:
        '`{{name}}` holds {{kind}} ({{code}}). Claude Code does not load this command. Rename the file or folder.',
      commandLength:
        'The command name has {{length}} characters. Claude Code refuses a name over {{limit}} characters, and does not load this command. Rename the file or folder.',
      nameLength:
        'The `name` has {{length}} characters. Claude Code refuses a name over {{limit}} characters. The `/` menu does not show this name, and the name does not invoke the skill. Edit the `name` field.',
      name: '`{{name}}` holds {{kind}} ({{code}}). The `/` menu does not show this name, and the name does not invoke the skill. Edit the `name` field.',
    },
  },
  create(context) {
    const file = classifySkillFile(context.filename)
    if (file === null) {
      return {}
    }
    const first = { line: 1, column: 1 }
    return {
      root() {
        // A plugin `skills/` folder name loads with hyphens in place of the characters.
        if (file.kind === 'skill' && file.plugin) {
          return
        }
        const messageId = file.kind === 'skill' ? 'folder' : 'command'
        for (const part of file.names) {
          const fault = firstFault(part)
          if (fault !== null) {
            context.report({
              loc: first,
              messageId,
              data: { name: part, code: fault.code, kind: fault.kind },
            })
          }
        }
        // A command name is its folders and its file name, joined with `:`. A skill folder
        // name is under 256 characters: a name of 256 bytes or more cannot be on disk.
        const length = file.kind === 'command' ? overLimit(file.names.join(':')) : null
        if (length !== null) {
          context.report({
            loc: first,
            messageId: 'commandLength',
            data: { length: String(length), limit: String(NAME_LIMIT) },
          })
        }
      },
      yaml(node) {
        // The docs give the `name` effect for a skill only. A command takes its name
        // from its path (skills.md, "How a skill gets its command name").
        const fm = file.kind === 'skill' ? readFrontmatter(context.sourceCode, node) : null
        const field = fm?.fields.get('name')
        const value = fm?.data.name
        if (!fm || !field || typeof value !== 'string') {
          return
        }
        const fault = firstFault(value)
        if (fault !== null) {
          context.report({
            loc: fm.at(field.valueStart, field.valueEnd),
            messageId: 'name',
            data: { name: value, code: fault.code, kind: fault.kind },
          })
        }
        const length = overLimit(value)
        if (length !== null) {
          context.report({
            loc: fm.at(field.valueStart, field.valueEnd),
            messageId: 'nameLength',
            data: { length: String(length), limit: String(NAME_LIMIT) },
          })
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'markdown' as const,
  files: ['**/SKILL.md', '**/commands/**/*.md'],
}

export default rule

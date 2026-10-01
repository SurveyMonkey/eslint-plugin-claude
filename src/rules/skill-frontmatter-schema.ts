// The frontmatter fields of a skill or command file, with their types and
// values. The source is the Frontmatter reference of the Claude Code 2.1.286
// docs (docs/rules/skill-frontmatter-schema.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { COMMAND_EXCLUDED, SKILL_FIELDS } from '../data/skill-fields.ts'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'skill-frontmatter-schema' as const

const COMPATIBILITY_MAX = 500

const STRING_FIELDS = ['name', 'description', 'argument-hint']
const STRING_OR_LIST_FIELDS = ['arguments', 'allowed-tools', 'disallowed-tools', 'paths']
const ENUMS: Record<string, string[]> = {
  effort: ['low', 'medium', 'high', 'xhigh', 'max'],
  context: ['fork'],
  shell: ['bash', 'powershell'],
}

/** A key without case, hyphens, underscores and spaces: `allowed_tools` and
 *  `allowed-tools` give the same text. */
function squash(key: string): string {
  return key.toLowerCase().replace(/[-_\s]/g, '')
}

type Problem = {
  messageId: 'wrongType' | 'invalidValue' | 'tooLong'
  data: Record<string, string>
}

/** The fault in the value of the known field `key`, or null. */
function valueProblem(key: string, value: unknown): Problem | null {
  const wrong = (expected: string): Problem => ({ messageId: 'wrongType', data: { key, expected } })
  if (STRING_FIELDS.includes(key)) {
    // The docs show `argument-hint: [issue-number]`, which YAML reads as a list.
    const listAllowed = key === 'argument-hint' && Array.isArray(value)
    return typeof value === 'string' || listAllowed ? null : wrong('a string')
  }
  if (STRING_OR_LIST_FIELDS.includes(key)) {
    return typeof value === 'string' || Array.isArray(value) ? null : wrong('a string or a list')
  }
  if (key === 'model') {
    return typeof value === 'string' && value.trim() !== '' ? null : wrong('a non-empty string')
  }
  if (key === 'metadata') {
    return typeof value === 'object' && !Array.isArray(value) ? null : wrong('a map')
  }
  if (key === 'compatibility') {
    if (typeof value !== 'string') {
      return wrong('a string')
    }
    return value.length > COMPATIBILITY_MAX
      ? {
          messageId: 'tooLong',
          data: { length: String(value.length), max: String(COMPATIBILITY_MAX) },
        }
      : null
  }
  const allowed = ENUMS[key]
  if (allowed !== undefined && !allowed.includes(value as string)) {
    return {
      messageId: 'invalidValue',
      data: { key, allowed: allowed.map((v) => `\`${v}\``).join(', ') },
    }
  }
  return null
}

const rule: MarkdownRuleDefinition<{
  MessageIds:
    | 'unknownKey'
    | 'nearMiss'
    | 'commandField'
    | 'wrongType'
    | 'invalidValue'
    | 'tooLong'
    | 'rename'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use the frontmatter fields of a skill, with the right types and values',
      url: docsUrl(name),
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      unknownKey: '`{{key}}` is not a skill frontmatter field. Claude Code ignores it.',
      nearMiss:
        '`{{key}}` is not a skill frontmatter field. Claude Code ignores it. Use `{{expected}}`.',
      commandField: 'A command file takes no `{{key}}` field. Claude Code ignores it.',
      wrongType: '`{{key}}` must be {{expected}}.',
      invalidValue: '`{{key}}` must be one of {{allowed}}.',
      tooLong: '`compatibility` has {{length}} characters. The limit is {{max}}.',
      rename: 'Rename the key to `{{expected}}`.',
    },
  },
  create(context) {
    const file = classifySkillFile(context.filename)
    if (file === null) {
      return {}
    }
    const known: string[] =
      file.kind === 'command'
        ? SKILL_FIELDS.filter((f) => !COMMAND_EXCLUDED.includes(f))
        : [...SKILL_FIELDS]
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null) {
          return
        }
        for (const field of fm.fields.values()) {
          const { key } = field
          const keyLoc = fm.at(field.keyStart, field.keyEnd)
          if (file.kind === 'command' && COMMAND_EXCLUDED.includes(key)) {
            context.report({ loc: keyLoc, messageId: 'commandField', data: { key } })
            continue
          }
          if (!known.includes(key)) {
            const expected = known.find((k) => squash(k) === squash(key))
            if (expected === undefined) {
              context.report({ loc: keyLoc, messageId: 'unknownKey', data: { key } })
            } else {
              context.report({
                loc: keyLoc,
                messageId: 'nearMiss',
                data: { key, expected },
                suggest: [
                  {
                    messageId: 'rename',
                    data: { expected },
                    fix: (fixer) =>
                      fixer.replaceTextRange(
                        [fm.base + field.keyStart, fm.base + field.keyEnd],
                        expected,
                      ),
                  },
                ],
              })
            }
            continue
          }
          const value = fm.data[key]
          const loc = fm.at(field.valueStart, field.valueEnd)
          // An empty value is the same as an absent field.
          if (value === null || value === undefined) {
            continue
          }
          const problem = valueProblem(key, value)
          if (problem !== null) {
            context.report({ loc, ...problem })
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

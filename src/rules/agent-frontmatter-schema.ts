// The frontmatter fields of a subagent file, with their types and values. The
// source is the Frontmatter reference of the Claude Code docs
// (docs/rules/agent-frontmatter-schema.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { AGENT_ENUMS, AGENT_FIELDS, CACHE_TTL_VALUES } from '../data/agent-fields.ts'
import { docsUrl } from '../docs-url.ts'
import { isBooleanValue, isMap, nearMissOf } from '../frontmatter-values.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-frontmatter-schema' as const

const STRING_FIELDS = ['name', 'description']
const STRING_OR_LIST_FIELDS = ['tools', 'disallowedTools']
const BOOLEAN_FIELDS = ['background', 'omitClaudeMd']

type Problem = {
  messageId: 'wrongType' | 'invalidValue' | 'unknownExperimental'
  data: Record<string, string>
}

const isStringList = (value: unknown): boolean =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const quoted = (values: readonly string[]): string => values.map((v) => `\`${v}\``).join(', ')

/** The fault in the value of the known field `key`, or null. */
function valueProblem(key: string, value: unknown): Problem | null {
  const wrong = (expected: string): Problem => ({ messageId: 'wrongType', data: { key, expected } })
  if (STRING_FIELDS.includes(key)) {
    return typeof value === 'string' ? null : wrong('a string')
  }
  if (STRING_OR_LIST_FIELDS.includes(key)) {
    return typeof value === 'string' || isStringList(value)
      ? null
      : wrong('a comma-separated string or a list of strings')
  }
  if (key === 'model') {
    return typeof value === 'string' && value.trim() !== '' ? null : wrong('a non-empty string')
  }
  if (key === 'maxTurns') {
    return Number.isInteger(value) && (value as number) > 0 ? null : wrong('a positive integer')
  }
  if (key === 'skills') {
    return isStringList(value) ? null : wrong('a list of skill names')
  }
  if (BOOLEAN_FIELDS.includes(key)) {
    return isBooleanValue(value) ? null : wrong('a Boolean')
  }
  if (key === 'experimental') {
    if (!isMap(value)) {
      return wrong('a map')
    }
    const other = Object.keys(value).find((k) => k !== 'cacheTtl')
    if (other !== undefined) {
      return { messageId: 'unknownExperimental', data: { key: other } }
    }
    const ttl = value.cacheTtl
    return ttl === undefined ||
      ttl === null ||
      (CACHE_TTL_VALUES as readonly string[]).includes(ttl as string)
      ? null
      : {
          messageId: 'invalidValue',
          data: { key: 'experimental.cacheTtl', allowed: quoted(CACHE_TTL_VALUES) },
        }
  }
  const allowed = AGENT_ENUMS[key]
  if (allowed !== undefined && !allowed.includes(value as string)) {
    return { messageId: 'invalidValue', data: { key, allowed: quoted(allowed) } }
  }
  return null
}

const rule: MarkdownRuleDefinition<{
  MessageIds:
    | 'unknownKey'
    | 'nearMiss'
    | 'cacheTtlTopLevel'
    | 'wrongType'
    | 'invalidValue'
    | 'unknownExperimental'
    | 'rename'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use the frontmatter fields of a subagent, with the right types and values',
      url: docsUrl(name),
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      unknownKey: '`{{key}}` is not a subagent frontmatter field. Claude Code ignores it.',
      nearMiss:
        '`{{key}}` is not a subagent frontmatter field. Claude Code ignores it. Use `{{expected}}`.',
      cacheTtlTopLevel:
        '`cacheTtl` at the top level is ignored. Write it inside the `experimental` map.',
      wrongType: '`{{key}}` must be {{expected}}.',
      invalidValue: '`{{key}}` must be one of {{allowed}}.',
      unknownExperimental:
        '`{{key}}` is not a documented `experimental` option. The docs name only `cacheTtl`.',
      rename: 'Rename the key to `{{expected}}`.',
    },
  },
  create(context) {
    if (classifyAgentFile(context.filename) === null) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null) {
          return
        }
        for (const field of fm.fields.values()) {
          const { key } = field
          const keyLoc = fm.at(field.keyStart, field.keyEnd)
          if (key === 'cacheTtl') {
            context.report({ loc: keyLoc, messageId: 'cacheTtlTopLevel' })
            continue
          }
          if (!(AGENT_FIELDS as readonly string[]).includes(key)) {
            const expected = nearMissOf(key, AGENT_FIELDS)
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
          // An empty value is the same as an absent field.
          if (value === null || value === undefined) {
            continue
          }
          const problem = valueProblem(key, value)
          if (problem !== null) {
            context.report({ loc: fm.at(field.valueStart, field.valueEnd), ...problem })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/agents/**/*.md'],
  rule,
}

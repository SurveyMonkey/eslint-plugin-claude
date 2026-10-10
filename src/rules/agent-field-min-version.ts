// A few subagent fields need a minimum Claude Code version
// (docs/rules/agent-field-min-version.md). The rule reports each one that the
// option `minVersion` allows. It is inactive until the option is set, because
// the file does not show which versions its users run.
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { isBelow, MIN_VERSION_SCHEMA, type MinVersionOptions } from '../agent-min-version.ts'
import { docsUrl } from '../docs-url.ts'
import { readBoolean } from '../frontmatter-boolean.ts'
import { isMap } from '../frontmatter-values.ts'
import { readFrontmatter, type SkillFrontmatter } from '../skill-frontmatter.ts'

const name = 'agent-field-min-version' as const

// The first Claude Code version for each check. The frontmatter table of the
// sub-agents page gives the first two. The changelog gives the other two: the
// `manual` alias in v2.1.200, and the Boolean forms in v2.1.218.
const OMIT_CLAUDE_MD = '2.1.271'
const CACHE_TTL = '2.1.248'
const MANUAL_ALIAS = '2.1.200'
const BOOLEAN_FORMS = '2.1.218'

// The Boolean fields of a subagent. `agent-frontmatter-schema` holds the same
// list.
const BOOLEAN_FIELDS = ['background', 'omitClaudeMd']

type Loc = ReturnType<SkillFrontmatter['at']>

const isSet = (value: unknown): boolean => value !== undefined && value !== null

/** True when `value` reads as a Boolean in a form other than `true` and
 *  `false`: `yes`, `no`, `on`, `off`, `1` or `0`. */
function isLooseBoolean(value: unknown): boolean {
  return (
    typeof value !== 'boolean' &&
    readBoolean(value) !== null &&
    !['true', 'false'].includes(String(value).toLowerCase())
  )
}

const rule: MarkdownRuleDefinition<{
  RuleOptions: MinVersionOptions
  MessageIds: 'needsVersion' | 'booleanForm'
}> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use only the subagent fields that the oldest Claude Code version supports',
      url: docsUrl(name),
    },
    schema: [MIN_VERSION_SCHEMA],
    defaultOptions: [{}],
    messages: {
      needsVersion:
        '`{{field}}` needs Claude Code v{{required}} or later. The configured minVersion is {{minVersion}}.',
      booleanForm:
        '`{{key}}: {{value}}` is not `true` or `false`. Claude Code before v2.1.218 reads only `true` and `false`. The configured minVersion is {{minVersion}}.',
    },
  },
  create(context) {
    const agent = classifyAgentFile(context.filename)
    const [{ minVersion }] = context.options
    if (agent === null || minVersion === undefined) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        if (fm === null) {
          return
        }
        // Report `field` when `required` is above the configured version.
        const needs = (loc: Loc, field: string, required: string) => {
          if (isBelow(minVersion, required)) {
            context.report({
              loc,
              messageId: 'needsVersion',
              data: { field, required, minVersion },
            })
          }
        }
        for (const { key, keyStart, keyEnd, valueStart, valueEnd } of fm.fields.values()) {
          const value = fm.data[key]
          if (key === 'omitClaudeMd' && isSet(value)) {
            needs(fm.at(keyStart, keyEnd), key, OMIT_CLAUDE_MD)
          }
          if (key === 'experimental' && isMap(value) && isSet(value.cacheTtl)) {
            needs(fm.at(keyStart, keyEnd), 'experimental.cacheTtl', CACHE_TTL)
          }
          // Claude Code ignores `permissionMode` in a plugin agent.
          if (key === 'permissionMode' && value === 'manual' && !agent.plugin) {
            needs(fm.at(valueStart, valueEnd), 'permissionMode: manual', MANUAL_ALIAS)
          }
          if (
            BOOLEAN_FIELDS.includes(key) &&
            isLooseBoolean(value) &&
            isBelow(minVersion, BOOLEAN_FORMS)
          ) {
            context.report({
              loc: fm.at(valueStart, valueEnd),
              messageId: 'booleanForm',
              data: { key, value: String(value), minVersion },
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
  files: ['**/agents/**/*.md'],
  rule,
}

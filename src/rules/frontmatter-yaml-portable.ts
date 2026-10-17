// Frontmatter that the strict `yaml` parser cannot read, in a subagent, skill, command or output
// style file. Each kind is found as the rules of that kind find it. Claude Code can
// load some of these files (issue #288), so the message claims nothing about Claude Code. It
// says that other tools cannot read the YAML (docs/rules/frontmatter-yaml-portable.md).
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyLinted, classifyOutputStyle } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { classifyFrontmatter } from '../frontmatter.ts'
import { classifySkillFile } from '../skill-files.ts'

const name = 'frontmatter-yaml-portable' as const

const rule: MarkdownRuleDefinition<{ MessageIds: 'notPortable' | 'notPortableNoLine' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write frontmatter that a strict YAML parser can read',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notPortable:
        'This frontmatter is not strict YAML, so other tools cannot read it: {{reason}} (line {{line}}).',
      notPortableNoLine:
        'This frontmatter is not strict YAML, so other tools cannot read it: {{reason}}.',
    },
  },
  create(context) {
    const known =
      classifyLinted(context) !== null ||
      classifySkillFile(context.filename) !== null ||
      classifyOutputStyle(context.filename) !== null
    if (!known) {
      return {}
    }
    return {
      yaml(node) {
        const parsed = classifyFrontmatter(node.value)
        if (parsed.kind !== 'error') {
          return
        }
        const reason = parsed.message
        if (parsed.line === null) {
          context.report({ node, messageId: 'notPortableNoLine', data: { reason } })
          return
        }
        // Line 1 of the YAML text is the line after the opening `---`.
        const line = String(context.sourceCode.getLoc(node).start.line + parsed.line)
        context.report({ node, messageId: 'notPortable', data: { reason, line } })
      },
    }
  },
}

export const target = {
  name,
  language: 'markdown' as const,
  files: ['**/agents/**/*.md', '**/SKILL.md', '**/commands/**/*.md', '**/output-styles/*.md'],
}

export default rule

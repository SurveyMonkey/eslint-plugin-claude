// A subagent cannot preload a skill that sets `disable-model-invocation: true`
// (docs/rules/agent-skills-preloadable.md).
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { type AgentScope, agentScope } from '../agent-scope.ts'
import { docsUrl } from '../docs-url.ts'
import { readBoolean } from '../frontmatter-boolean.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import {
  frontmatterOfFile,
  readManifest,
  repositoryRoot,
  skillFiles,
  UNREADABLE,
} from '../skill-tree.ts'

const name = 'agent-skills-preloadable' as const

type MessageIds = 'disabled'

/** The `skills/` directory where the entries of an agent in `scope` resolve.
 *  The result is null when the rule cannot know that directory. A plugin
 *  manifest that sets `skills` adds directories. A manifest that the rule
 *  cannot read can set it. */
function skillsDirOf(scope: AgentScope, bound: string): string | null {
  if (scope.plugin) {
    const manifest = readManifest(scope.root, bound)
    if (manifest === UNREADABLE || (manifest !== null && 'skills' in manifest)) {
      return null
    }
  }
  return path.join(scope.root, 'skills')
}

/** The message id for the entry `entry`, or null for no report. */
function problemOf(entry: string, skillsDir: string, bound: string): MessageIds | null {
  const file = skillFiles(skillsDir, bound).find((f) => path.basename(path.dirname(f)) === entry)
  if (file !== undefined) {
    const fields = frontmatterOfFile(file)
    // A skill file that the rule cannot read gives no report. A file with no
    // frontmatter, or with frontmatter that does not parse, sets no field.
    return fields !== UNREADABLE && readBoolean(fields?.['disable-model-invocation']) === true
      ? 'disabled'
      : null
  }
  // An entry with no skill file is the business of `agent-skills-exist`. The
  // bundled `verify` skill gets no report. A skill of the repository root can
  // replace it, and the rule cannot see that skill.
  return null
}

const rule: MarkdownRuleDefinition<{ MessageIds: MessageIds }> = {
  meta: {
    type: 'problem',
    docs: { description: 'Preload only skills that a model can invoke', url: docsUrl(name) },
    schema: [],
    messages: {
      disabled:
        '`{{entry}}` sets `disable-model-invocation: true`. A subagent cannot preload it. Remove it from `skills`.',
    },
  },
  create(context) {
    const scope = agentScope(context.filename)
    if (scope === null) {
      return {}
    }
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const field = fm?.fields.get('skills')
        const entries = fm?.data.skills
        // A value that is not a list is the business of `agent-frontmatter-schema`.
        if (fm === null || field === undefined || !Array.isArray(entries)) {
          return
        }
        const bound = repositoryRoot(scope.root)
        const skillsDir = skillsDirOf(scope, bound)
        if (skillsDir === null) {
          return
        }
        for (const entry of entries) {
          const messageId = typeof entry === 'string' ? problemOf(entry, skillsDir, bound) : null
          if (messageId !== null) {
            context.report({
              loc: fm.at(field.valueStart, field.valueEnd),
              messageId,
              data: { entry: entry as string },
            })
          }
        }
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/agents/**/*.md'], rule }

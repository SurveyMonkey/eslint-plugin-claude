// A subagent cannot preload a skill that sets `disable-model-invocation: true`
// (docs/rules/agent-skills-preloadable.md).
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { type AgentScope, agentScope } from '../agent-scope.ts'
import { docsUrl } from '../docs-url.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import {
  entriesOf,
  frontmatterOfFile,
  readManifest,
  repositoryRoot,
  skillFiles,
  UNREADABLE,
} from '../skill-tree.ts'

const name = 'agent-skills-preloadable' as const

type MessageIds = 'disabled' | 'bundled'

/** The bundled skill that Claude cannot run on its own, so a subagent cannot
 *  preload it. */
const BUNDLED = 'verify'

/** The `skills/` directory in which the entries of an agent in `scope`
 *  resolve, or null when the rule cannot know that directory. A plugin
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
    return fields !== UNREADABLE && fields?.['disable-model-invocation'] === true
      ? 'disabled'
      : null
  }
  if (entry !== BUNDLED) {
    // An entry with no skill file is the business of `agent-skills-exist`.
    return null
  }
  // A folder named like the bundled skill can be a skill that the rule cannot
  // see, for example a link out of the repository. Then the bundled skill has
  // no report either. A `skills/` directory that the rule cannot list is the same.
  const entries = entriesOf(skillsDir)
  const shadowed =
    entries === UNREADABLE || (Array.isArray(entries) && entries.some((e) => e.name === BUNDLED))
  return shadowed ? null : 'bundled'
}

const rule: MarkdownRuleDefinition<{ MessageIds: MessageIds }> = {
  meta: {
    type: 'problem',
    docs: { description: 'Preload only skills that a model can invoke', url: docsUrl(name) },
    schema: [],
    messages: {
      disabled:
        '`{{entry}}` sets `disable-model-invocation: true`. A subagent cannot preload it, and Claude Code skips it. Remove it from `skills`.',
      bundled:
        '`{{entry}}` is a bundled skill that Claude cannot run on its own. A subagent cannot preload it, and Claude Code skips it. Remove it from `skills`.',
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

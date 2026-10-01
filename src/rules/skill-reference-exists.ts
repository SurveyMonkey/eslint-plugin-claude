// A relative link in a `SKILL.md`, or a path that starts with
// `${CLAUDE_SKILL_DIR}/`, must name a file in the skill folder
// (docs/rules/skill-reference-exists.md).
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { MarkdownRuleDefinition, MarkdownSourceCode } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { classifySkillFile } from '../skill-files.ts'

const name = 'skill-reference-exists' as const

// Escaped, so that the template keeps the variable as text.
const SKILL_DIR = `\${CLAUDE_SKILL_DIR}/`
// A URL, `mailto:` and the like. A drive letter has the same form.
const SCHEME = /^[a-z][a-z0-9+.-]*:/i
// Text that stands for a path, and is not one.
const PLACEHOLDER = /[$*?<>{}|]/

/** The path in `raw`, below the skill folder, or null when `raw` is not
 *  a path that the rule checks. */
function folderPath(raw: string): string | null {
  const bare = raw.split(/[#?]/)[0] as string
  const inFolder = bare.startsWith(SKILL_DIR)
  const target = inFolder ? bare.slice(SKILL_DIR.length) : bare
  const skipped =
    target === '' ||
    PLACEHOLDER.test(target) ||
    (!inFolder && (SCHEME.test(target) || /^[/\\~]/.test(target)))
  if (skipped) {
    return null
  }
  try {
    return decodeURIComponent(target)
  } catch {
    return target
  }
}

const rule: MarkdownRuleDefinition<{ MessageIds: 'missing' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Link only to files that exist in the skill folder',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      missing: '`{{target}}` is not a file in the skill folder. Claude cannot read it.',
    },
  },
  create(context) {
    if (classifySkillFile(context.filename)?.kind !== 'skill') {
      return {}
    }
    const folder = path.dirname(path.resolve(context.filename))
    /** Report `node` when `raw` is a path to a file that is not there. */
    const check = (node: Parameters<MarkdownSourceCode['getLoc']>[0], raw: string) => {
      const target = folderPath(raw)
      if (target === null) {
        return
      }
      const resolved = path.resolve(folder, target)
      const inside = path.relative(folder, resolved)
      if (inside === '' || inside === '..' || inside.startsWith(`..${path.sep}`)) {
        return
      }
      if (!existsSync(resolved)) {
        context.report({
          loc: context.sourceCode.getLoc(node),
          messageId: 'missing',
          data: { target },
        })
      }
    }
    return {
      link: (node) => check(node, node.url),
      image: (node) => check(node, node.url),
      definition: (node) => check(node, node.url),
      inlineCode: (node) => {
        const first = node.value.split(/\s/)[0] as string
        if (first.startsWith(SKILL_DIR)) {
          check(node, first)
        }
      },
    }
  },
}

export default {
  name,
  language: 'markdown' as const,
  files: ['**/SKILL.md'],
  rule,
}

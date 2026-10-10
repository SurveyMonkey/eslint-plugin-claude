// A skill or command file that starts with a byte order mark. Claude Code
// before 2.1.239 ignores such a file (docs/rules/skill-no-bom.md). ESLint
// removes the mark before a rule sees the text, so the rule reads the first
// bytes of the file on disk. It reads no file out of the repository.
import { closeSync, openSync, readSync } from 'node:fs'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { MIN_VERSION_SCHEMA, supportsBefore } from '../min-version.ts'
import { classifySkillFile } from '../skill-files.ts'
import { isInside, realOf, repositoryRoot, scopeRoot } from '../skill-tree.ts'

const name = 'skill-no-bom' as const

// The first version that reads a file with a byte order mark.
const FIXED = '2.1.239'

const BOM = Buffer.from([0xef, 0xbb, 0xbf])

/** True when the file at `real` starts with the three bytes of a byte
 *  order mark. A file that the rule cannot read gives false. */
function startsWithBom(real: string): boolean {
  const head = Buffer.alloc(BOM.length)
  try {
    const fd = openSync(real, 'r')
    try {
      readSync(fd, head, 0, head.length, 0)
    } finally {
      closeSync(fd)
    }
  } catch {
    return false
  }
  return head.equals(BOM)
}

type Options = [{ minVersion?: string }]

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'bom' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Save a skill or command file with no byte order mark',
      url: docsUrl(name),
    },
    schema: [MIN_VERSION_SCHEMA],
    defaultOptions: [{}],
    messages: {
      bom: 'This file starts with a byte order mark. Claude Code before v2.1.239 ignores the file. Save it with no mark, or set the option `minVersion` to 2.1.239 or later.',
    },
  },
  create(context) {
    const [{ minVersion }] = context.options
    const info = classifySkillFile(context.filename)
    if (info === null || !supportsBefore(minVersion, FIXED)) {
      return {}
    }
    return {
      root() {
        // The path of a lint of text with no file, such as `<text>`, is not a file.
        const real = realOf(context.physicalFilename)
        if (typeof real !== 'string') {
          return
        }
        const bound = repositoryRoot(scopeRoot(context.physicalFilename, info))
        if (isInside(real, bound) && startsWithBom(real)) {
          context.report({
            loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
            messageId: 'bom',
          })
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

// A `plugin.json` that starts with a UTF-8 byte order mark. Claude Code before 2.1.246 fails to
// install such a plugin (docs/rules/plugin-manifest-no-bom.md). ESLint removes the mark before a
// rule sees the text, so the rule reads the first bytes of the file on disk. It reads no file
// out of the repository.
import { closeSync, openSync, readSync } from 'node:fs'
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { MIN_VERSION_SCHEMA, supportsBefore } from '../min-version.ts'
import { isInside, realDirectory, realOf, repositoryRoot } from '../skill-tree.ts'

const name = 'plugin-manifest-no-bom' as const

// The first version that installs a plugin whose manifest has a byte order mark.
const FIXED = '2.1.246'

const BOM = Buffer.from([0xef, 0xbb, 0xbf])

/** True when the file at `real` starts with the three bytes of a UTF-8
 *  byte order mark. A file that the rule cannot read gives false. */
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

const rule: JSONRuleDefinition<{ RuleOptions: Options; MessageIds: 'bom' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Save plugin.json with no byte order mark',
      url: docsUrl(name),
    },
    schema: [MIN_VERSION_SCHEMA],
    defaultOptions: [{}],
    messages: {
      bom: 'This `plugin.json` starts with a UTF-8 byte order mark. Claude Code before v2.1.246 fails to install the plugin. Save the file with no mark, or set the option `minVersion` to 2.1.246 or later.',
    },
  },
  create(context) {
    const [{ minVersion }] = context.options
    if (!supportsBefore(minVersion, FIXED)) {
      return {}
    }
    return {
      Document() {
        const file = path.resolve(context.physicalFilename)
        const root = path.dirname(path.dirname(file))
        const bound = repositoryRoot(root)
        const real = realOf(file)
        // The root can be out of the repository, with a `.claude-plugin` that links back in.
        if (
          typeof real === 'string' &&
          isInside(real, bound) &&
          isInside(realDirectory(root), bound) &&
          startsWithBom(real)
        ) {
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
  language: 'json' as const,
  files: ['**/.claude-plugin/plugin.json'],
  rule,
}

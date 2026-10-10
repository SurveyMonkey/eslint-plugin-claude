// Claude Code before v2.1.239 silently ignores an agent file that starts with
// a UTF-8 byte-order mark (docs/rules/agent-no-bom.md). ESLint strips the
// mark before a rule runs, so the rule reads the first bytes of the file on
// disk. It makes no report for a file that it cannot read (ADR 001, Decision
// 14). The rule is inactive until the option `minVersion` is set.
import { closeSync, openSync, readSync } from 'node:fs'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { classifyAgentFile } from '../agent-files.ts'
import { docsUrl } from '../docs-url.ts'
import { isBelow, MIN_VERSION_SCHEMA, type MinVersionOptions } from '../min-version.ts'

const name = 'agent-no-bom' as const

// The first Claude Code version that reads an agent file with a BOM.
const FIXED_IN = '2.1.239'

// The UTF-8 form of U+FEFF.
const BOM = Buffer.from([0xef, 0xbb, 0xbf])

/** True when the file `file` starts with a UTF-8 BOM. A file that cannot be
 *  read gives false. */
function startsWithBom(file: string): boolean {
  try {
    const descriptor = openSync(file, 'r')
    try {
      const head = Buffer.alloc(BOM.length)
      readSync(descriptor, head, 0, BOM.length, 0)
      return head.equals(BOM)
    } finally {
      closeSync(descriptor)
    }
  } catch {
    return false
  }
}

const rule: MarkdownRuleDefinition<{ RuleOptions: MinVersionOptions; MessageIds: 'bom' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Start an agent file with no byte-order mark, for older Claude Code versions',
      url: docsUrl(name),
    },
    schema: [MIN_VERSION_SCHEMA],
    defaultOptions: [{}],
    messages: {
      bom: 'This file starts with a UTF-8 byte-order mark. Claude Code before v2.1.239 silently ignores the agent. The configured minVersion is {{minVersion}}.',
    },
  },
  create(context) {
    const [{ minVersion }] = context.options
    if (
      minVersion === undefined ||
      !isBelow(minVersion, FIXED_IN) ||
      classifyAgentFile(context.filename) === null
    ) {
      return {}
    }
    return {
      root() {
        if (startsWithBom(context.physicalFilename)) {
          context.report({
            loc: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } },
            messageId: 'bom',
            data: { minVersion },
          })
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

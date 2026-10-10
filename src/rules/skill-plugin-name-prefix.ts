// A plugin skill with a `name` that starts with the plugin prefix. On Claude Code 2.1.216 to
// 2.1.245 the prefix shows twice in the `/` menu (docs/rules/skill-plugin-name-prefix.md).
// The rule is inactive until the option `minVersion` is set.
import path from 'node:path'
import type { MarkdownRuleDefinition } from '@eslint/markdown'
import { docsUrl } from '../docs-url.ts'
import { MIN_VERSION_SCHEMA, supportsBefore } from '../min-version.ts'
import { classifySkillFile } from '../skill-files.ts'
import { readFrontmatter } from '../skill-frontmatter.ts'
import { readManifest, repositoryRoot, scopeRoot, UNREADABLE } from '../skill-tree.ts'

const name = 'skill-plugin-name-prefix' as const

// The first version that does not add the prefix a second time.
const FIXED = '2.1.246'

type Options = [{ minVersion?: string }]

const rule: MarkdownRuleDefinition<{ RuleOptions: Options; MessageIds: 'doubled' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not start the name of a plugin skill with the plugin prefix',
      url: docsUrl(name),
    },
    schema: [MIN_VERSION_SCHEMA],
    defaultOptions: [{}],
    messages: {
      doubled:
        '`{{name}}` starts with the plugin prefix `{{plugin}}:`. Claude Code from v2.1.216 through v2.1.245 adds the prefix again. Remove the prefix, or set the option `minVersion` to 2.1.246 or later.',
    },
  },
  create(context) {
    const [{ minVersion }] = context.options
    const file = classifySkillFile(context.filename)
    if (
      file === null ||
      file.kind !== 'skill' ||
      !file.plugin ||
      !supportsBefore(minVersion, FIXED)
    ) {
      return {}
    }
    const root = scopeRoot(context.filename, file)
    const manifest = readManifest(root, repositoryRoot(root))
    // A manifest that the rule cannot read can hold any name.
    if (manifest === UNREADABLE) {
      return {}
    }
    // The prefix is the manifest `name`, or the directory name when the manifest has none.
    const plugin = typeof manifest?.name === 'string' ? manifest.name : path.basename(root)
    return {
      yaml(node) {
        const fm = readFrontmatter(context.sourceCode, node)
        const given = fm?.data.name
        const field = fm?.fields.get('name')
        if (fm && field && typeof given === 'string' && given.startsWith(`${plugin}:`)) {
          context.report({
            loc: fm.at(field.valueStart, field.valueEnd),
            messageId: 'doubled',
            data: { name: given, plugin },
          })
        }
      },
    }
  },
}

export default { name, language: 'markdown' as const, files: ['**/SKILL.md'], rule }

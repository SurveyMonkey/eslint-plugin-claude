// The `version` of `plugin.json`, when set, is a semantic version (docs/rules/plugin-manifest-version-semver.md).
// Claude Code does not check it. A dependency range needs it.
// The rule reports the value. It makes no report when it cannot see the plugin.
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { readPlugin } from '../plugin-manifest.ts'

const name = 'plugin-manifest-version-semver' as const

// The pattern of https://semver.org/ (version 2.0.0), which has no leading `v`.
export const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/

const rule: JSONRuleDefinition<{ MessageIds: 'notSemver' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Set the version of plugin.json to a semantic version',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notSemver:
        'The `version` "{{version}}" is not a semantic version such as 1.2.3. A dependency range needs one.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        const version = lastMember(node.body, 'version')?.value
        if (plugin !== undefined && version?.type === 'String' && !SEMVER.test(version.value)) {
          context.report({
            node: version,
            messageId: 'notSemver',
            data: { version: version.value },
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

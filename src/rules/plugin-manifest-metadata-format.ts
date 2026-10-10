// The `license` of `plugin.json` is an SPDX license expression, and the `repository` is a URL
// (docs/rules/plugin-manifest-metadata-format.md). Claude Code checks neither. The rule checks each
// name in the license against the SPDX License List. It does not check the shape of the expression.
import type { JSONRuleDefinition } from '@eslint/json'
import { SPDX_EXCEPTION_IDS, SPDX_LICENSE_IDS } from '../data/spdx-licenses.ts'
import { docsUrl } from '../docs-url.ts'
import { lastMember } from '../marketplace-json.ts'
import { readPlugin } from '../plugin-manifest.ts'

const name = 'plugin-manifest-metadata-format' as const

// SPDX matches an identifier without regard to case.
const LICENSES = new Set(SPDX_LICENSE_IDS.map((id) => id.toLowerCase()))
const EXCEPTIONS = new Set(SPDX_EXCEPTION_IDS.map((id) => id.toLowerCase()))
// A license that the author defines, with an optional reference to another document.
const REFERENCE = /^(?:DocumentRef-[A-Za-z0-9.-]+:)?LicenseRef-[A-Za-z0-9.-]+$/
// An exception that the author defines, as the SPDX 3.0 grammar allows after `WITH`.
const ADDITION = /^(?:DocumentRef-[A-Za-z0-9.-]+:)?AdditionRef-[A-Za-z0-9.-]+$/
const OPERATORS = new Set(['AND', 'OR', 'WITH', '(', ')'])

/** True when each name in the license expression `text` is in the SPDX License List, and
 *  the text holds at least one name. A name after `WITH` is an exception or an `AdditionRef-`
 *  name. A name can end in `+`. The check leaves out the order of the names and the operators. */
function isSpdx(text: string): boolean {
  const tokens = text.match(/[()]|[^\s()]+/g) ?? []
  let names = 0
  for (const [index, token] of tokens.entries()) {
    if (OPERATORS.has(token)) {
      continue
    }
    names++
    const id = token.toLowerCase()
    const known =
      tokens[index - 1] === 'WITH'
        ? EXCEPTIONS.has(id) || ADDITION.test(token)
        : REFERENCE.test(token) || LICENSES.has(id.replace(/\+$/, ''))
    if (!known) {
      return false
    }
  }
  return names > 0
}

const rule: JSONRuleDefinition<{ MessageIds: 'license' | 'repository' }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Set the license of plugin.json to an SPDX expression and the repository to a URL',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      license:
        'The `license` "{{license}}" is not an SPDX license expression. Use an identifier from https://spdx.org/licenses/, such as MIT or Apache-2.0.',
      repository:
        'The `repository` "{{repository}}" is not a URL. Use the URL of the source repository, such as https://github.com/acme/tool.',
    },
  },
  create(context) {
    const plugin = readPlugin(context.filename)
    return {
      Document(node) {
        if (plugin === undefined) {
          return
        }
        // A value that is not a string is a type error for `claude plugin validate`.
        const license = lastMember(node.body, 'license')?.value
        if (license?.type === 'String' && !isSpdx(license.value)) {
          context.report({ node: license, messageId: 'license', data: { license: license.value } })
        }
        const repository = lastMember(node.body, 'repository')?.value
        if (repository?.type === 'String' && !URL.canParse(repository.value)) {
          context.report({
            node: repository,
            messageId: 'repository',
            data: { repository: repository.value },
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

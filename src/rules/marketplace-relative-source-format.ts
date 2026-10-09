// The text of a relative plugin source in a marketplace entry, and of
// `metadata.pluginRoot`. The rule reads the text only. It reads no file
// system (docs/rules/marketplace-relative-source-format.md).
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { lastMember, pluginEntries, type ValueNode } from '../marketplace-json.ts'

const name = 'marketplace-relative-source-format' as const

// Two slashes or two backslashes at the start, in any mix.
const NETWORK = /^[\\/]{2}/
// A root slash or backslash at the start, or a drive letter with a slash.
const ABSOLUTE = /^(?:[\\/]|[A-Za-z]:[\\/])/
// A bare name is one directory name, with no slash of either kind.
export const BARE_NAME = /^[^\\/]+$/

// A path segment ends at a slash or a backslash.
const SEPARATOR = /[\\/]/

type MessageIds = 'network' | 'absolute' | 'parent' | 'noPrefix'

/** The first fault that every relative path has, or undefined. A `..` is a
 *  fault only as a whole segment: `./a..b` is a valid name. */
export function pathFault(path: string): Exclude<MessageIds, 'noPrefix'> | undefined {
  if (NETWORK.test(path)) {
    return 'network'
  }
  if (ABSOLUTE.test(path)) {
    return 'absolute'
  }
  return path.split(SEPARATOR).includes('..') ? 'parent' : undefined
}

const rule: JSONRuleDefinition<{ MessageIds: MessageIds }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Write a relative plugin source as the docs require',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      network:
        'The {{field}} "{{path}}" starts with two slashes or two backslashes, a network path. Write a path inside the marketplace.',
      absolute:
        'The {{field}} "{{path}}" is an absolute path. Write a path inside the marketplace, from the marketplace root.',
      parent:
        'The {{field}} "{{path}}" has a ".." segment. The path must stay inside the marketplace.',
      noPrefix:
        'The "source" "{{path}}" does not start with "./". A relative path starts with "./", and a bare name needs "metadata.pluginRoot".',
    },
  },
  create(context) {
    /** Report the first fault of the string `value`. The prefix check runs only
     *  when `prefixed` is true. A bare name is valid only when `bareNames` is
     *  true. */
    function check(
      value: ValueNode | undefined,
      field: string,
      prefixed: boolean,
      bareNames: boolean,
    ): void {
      // A value that is not a string is for `marketplace-schema`.
      if (value?.type !== 'String') {
        return
      }
      const path = value.value
      const data = { field, path }
      const fault = pathFault(path)
      if (fault !== undefined) {
        context.report({ node: value, messageId: fault, data })
        return
      }
      const valid = path === '.' || path.startsWith('./') || (bareNames && BARE_NAME.test(path))
      if (prefixed && !valid) {
        context.report({ node: value, messageId: 'noPrefix', data })
      }
    }
    return {
      Document(node) {
        const pluginRoot = lastMember(lastMember(node.body, 'metadata')?.value, 'pluginRoot')?.value
        // The docs set no prefix for `pluginRoot`: it is a relative path inside the marketplace.
        check(pluginRoot, '"metadata.pluginRoot"', false, false)
        const rooted = pluginRoot?.type === 'String' && pluginRoot.value !== ''
        for (const entry of pluginEntries(node)) {
          check(lastMember(entry, 'source')?.value, '"source"', true, rooted)
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.claude-plugin/marketplace.json'],
  rule,
}

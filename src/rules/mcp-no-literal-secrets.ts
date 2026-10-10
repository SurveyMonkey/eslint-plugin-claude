// A credential written into the `headers`, `env`, `args` or `url` of a committed MCP config
// (docs/rules/mcp-no-literal-secrets.md). The MCP page expands `${VAR}` in these fields, and the
// managed MCP page says not to store credentials in `env` blocks. `claude plugin validate`
// already warns about a header value that looks like a literal credential in a plugin MCP config,
// so the rule reads `headers` in a project file only. The docs name no credential format, so a
// credential is a literal value under a name that ends in a credential word (a heuristic). The
// docs list no `oauth` key for a secret, so the rule does not read `oauth`. A message never holds
// the value.
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { HELPER_CREDENTIAL_WORDS } from '../data/mcp-credential-vars.ts'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ValueNode } from '../marketplace-json.ts'
import { lastMembers, lintedServers, mcpFileKind } from '../mcp-servers.ts'

const name = 'mcp-no-literal-secrets' as const

type StringNode = Extract<ValueNode, { type: 'String' }>

/** The words that end the name of a credential. `Authorization` is the name of the header. */
const WORDS = [...HELPER_CREDENTIAL_WORDS, 'AUTHORIZATION']

/** True when the last word of `text` is a credential word. A word ends at a character that is not
 *  a letter or a digit, and at a change from a lower-case letter or a digit to an upper-case letter, so `apiKey`
 *  and `X-Api-Key` both end in `KEY`. A name such as `KEY_FILE` or `MONKEY` does not. */
function isCredentialName(text: string): boolean {
  const last = text
    .split(/[^A-Za-z0-9]+|(?<=[a-z0-9])(?=[A-Z])/)
    .filter((word) => word !== '')
    .at(-1)
  return last !== undefined && WORDS.includes(last.toUpperCase())
}

const SCHEME = /^\s*(?:Bearer|Basic|Token|Digest)\s+/i
const BARE_VARIABLE = /^(?:\$[A-Za-z_]\w*|%[A-Za-z_]\w*%)$/

/** True when `value` is a literal that can be a credential: it has text after an optional
 *  scheme word, it holds no `${` reference, and it is not a bare `$NAME` or `%NAME%` (that is for
 *  `mcp-env-var-syntax`). */
function isLiteral(value: string): boolean {
  const rest = value.replace(SCHEME, '').trim()
  return rest !== '' && !value.includes('${') && !BARE_VARIABLE.test(rest)
}

/** The user information of the URL text `url`: the text between `//` and the first `@` of the
 *  authority. The rule does not parse the URL, because a reference such as `${USER}` does not
 *  parse. */
const userInfoOf = (url: string) => /^[A-Za-z][A-Za-z0-9+.-]*:\/\/([^/?#@]*)@/.exec(url)?.[1]

/** The literal credentials in the `args` of a server: `--token=x`, `NAME=x`, `Name: x`, and a
 *  flag with a credential name followed by its value. */
function argFaults(args: readonly { value: ValueNode }[]): StringNode[] {
  const faults: StringNode[] = []
  args.forEach(({ value }, index) => {
    if (value.type !== 'String') {
      return
    }
    const pair = /^-{0,2}([A-Za-z][\w.-]*)=(.*)$/s.exec(value.value)
    const header = /^([A-Za-z][\w-]*):\s*(.+)$/s.exec(value.value)
    const [, key, text] = pair ?? header ?? []
    if (key !== undefined && isCredentialName(key) && isLiteral(text as string)) {
      faults.push(value)
      return
    }
    // A flag with a credential name takes the next item as its value.
    const flag = /^--?([A-Za-z][\w-]*)$/.exec(value.value)?.[1]
    const next = args[index + 1]?.value
    if (
      flag !== undefined &&
      isCredentialName(flag) &&
      next?.type === 'String' &&
      !next.value.startsWith('-') &&
      isLiteral(next.value)
    ) {
      faults.push(next)
    }
  })
  return faults
}

const rule: JSONRuleDefinition<{ MessageIds: 'secret' }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not write a literal credential in a committed MCP config',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      secret: `The {{where}} of the server "{{server}}" holds a literal credential, and the repository then holds it. Write a \`\${VAR}\` reference, and set the variable in the shell of each person who uses the server.`,
    },
  },
  create(context) {
    // `validate` warns about a header value in a plugin file. A manifest holds plugin servers.
    const plugin =
      path.basename(context.filename) === 'plugin.json' ||
      mcpFileKind(context.filename) === 'plugin'
    return {
      Document(node) {
        for (const server of lintedServers(context.filename, node.body)) {
          const entry = server.member.value
          const found: { node: StringNode; where: string }[] = []
          const maps = plugin ? ['env'] : ['env', 'headers']
          for (const field of maps) {
            const map = lastMember(entry, field)?.value
            if (map?.type !== 'Object') {
              continue
            }
            for (const member of lastMembers(map.members)) {
              const key = keyOf(member.name)
              if (
                member.value.type === 'String' &&
                isCredentialName(key) &&
                isLiteral(member.value.value)
              ) {
                found.push({
                  node: member.value,
                  where: field === 'env' ? `env variable "${key}"` : `header "${key}"`,
                })
              }
            }
          }
          const args = lastMember(entry, 'args')?.value
          if (args?.type === 'Array') {
            found.push(
              ...argFaults(args.elements).map((fault) => ({ node: fault, where: '`args`' })),
            )
          }
          const url = lastMember(entry, 'url')?.value
          const info = url?.type === 'String' ? userInfoOf(url.value) : undefined
          if (url?.type === 'String' && info !== undefined && info !== '' && !info.includes('${')) {
            found.push({ node: url, where: '`url`' })
          }
          for (const { node: text, where } of found) {
            context.report({
              node: server.pinned ?? text,
              messageId: 'secret',
              data: { where, server: server.name },
            })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: ['**/.mcp.json', '**/managed-mcp.json', '**/.claude-plugin/plugin.json'],
  rule,
}

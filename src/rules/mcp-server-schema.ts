// A server entry of `.mcp.json` with a bad shape (docs/rules/mcp-server-schema.md). Claude Code
// skips such an entry and loads the others. The rule reads each fault in a project `.mcp.json` and
// a committed `managed-mcp.json`. `claude plugin validate` 2.1.302 reports each fault of a plugin
// entry but one: a `url` with a `command` and no `type`. So in a plugin with a manifest, the rule
// reports that fault only (rulings 14 and 20 of #355). Validate fails a plugin with no manifest,
// so the rule reports each fault there (#384). An entry with no `type` is a stdio server. Claude
// Code skips a `sdk` entry with its own message, and #355 leaves that entry to it. Claude Code
// 2.1.304 skips an empty `command`, and an `env`, `headers` or `oauth` that is not an object
// (#383).
import path from 'node:path'
import type { JSONRuleDefinition } from '@eslint/json'
import { docsUrl } from '../docs-url.ts'
import { keyOf, lastMember, type ValueNode } from '../marketplace-json.ts'
import {
  type LintedServer,
  lintedServers,
  type McpFileKind,
  mcpFileKind,
  parseUrl,
  REMOTE_SERVER_TYPES,
  serverMembers,
} from '../mcp-servers.ts'
import { hasManifest } from '../plugin-root.ts'

const name = 'mcp-server-schema' as const

type MessageIds =
  | 'notObject'
  | 'urlNoType'
  | 'unknownType'
  | 'noCommand'
  | 'commandType'
  | 'argsType'
  | 'argType'
  | 'noUrl'
  | 'invalidUrl'
  | 'emptyCommand'
  | 'envType'
  | 'headersType'
  | 'oauthType'

const SKIP = 'Claude Code skips this entry.'

/** The fault of the member `key` of `entry` when it is there and is not an object. A `null`
 *  value is a fault too. */
function objectFault(
  entry: ValueNode,
  key: 'env' | 'headers' | 'oauth',
  messageId: MessageIds,
): { node: ValueNode; messageId: MessageIds }[] {
  const value = lastMember(entry, key)?.value
  return value !== undefined && value.type !== 'Object' ? [{ node: value, messageId }] : []
}

/** The faults of the stdio entry `entry`: `command` is a string that is not empty, `args`, when
 *  present, is an array of strings, and `env`, when present, is an object. */
function stdioFaults(entry: ValueNode): { node: ValueNode; messageId: MessageIds }[] {
  const faults: { node: ValueNode; messageId: MessageIds }[] = []
  const command = lastMember(entry, 'command')?.value
  if (command === undefined) {
    faults.push({ node: entry, messageId: 'noCommand' })
  } else if (command.type !== 'String') {
    faults.push({ node: command, messageId: 'commandType' })
  } else if (command.value === '') {
    faults.push({ node: command, messageId: 'emptyCommand' })
  }
  const args = lastMember(entry, 'args')?.value
  if (args !== undefined && args.type !== 'Array') {
    faults.push({ node: args, messageId: 'argsType' })
  }
  for (const { value } of args?.type === 'Array' ? args.elements : []) {
    if (value.type !== 'String') {
      faults.push({ node: value, messageId: 'argType' })
    }
  }
  return [...faults, ...objectFault(entry, 'env', 'envType')]
}

/** The `url` fault of the remote entry `entry`, whose `type` value is `type`: `url` is there and
 *  is a valid absolute URL. An empty `url` is a placeholder, which `mcp-remote-url-empty` reports
 *  in a project `.mcp.json`. A `${` reference can expand to any text, so the rule does not parse
 *  a URL that holds one. */
function urlFaults(
  entry: ValueNode,
  type: ValueNode,
): { node: ValueNode; messageId: MessageIds }[] {
  const url = lastMember(entry, 'url')?.value
  if (url === undefined) {
    return [{ node: type, messageId: 'noUrl' }]
  }
  if (url.type !== 'String') {
    return [{ node: url, messageId: 'invalidUrl' }]
  }
  if (url.value === '' || url.value.includes('${') || parseUrl(url.value) !== null) {
    return []
  }
  return [{ node: url, messageId: 'invalidUrl' }]
}

/** The faults of the remote entry `entry`, whose `type` value is the string `type`: the `url`
 *  fault, and `headers` that is not an object. Claude Code 2.1.304 also skips an `oauth` that is
 *  not an object, in each remote type but `ws`. */
function remoteFaults(
  entry: ValueNode,
  type: Extract<ValueNode, { type: 'String' }>,
): { node: ValueNode; messageId: MessageIds }[] {
  return [
    ...urlFaults(entry, type),
    ...objectFault(entry, 'headers', 'headersType'),
    ...(type.value === 'ws' ? [] : objectFault(entry, 'oauth', 'oauthType')),
  ]
}

/** The faults of the server entry `entry`. */
function entryFaults(entry: ValueNode): { node: ValueNode; messageId: MessageIds }[] {
  if (entry.type !== 'Object') {
    return [{ node: entry, messageId: 'notObject' }]
  }
  const type = lastMember(entry, 'type')?.value
  if (type === undefined) {
    // Claude Code reads an entry with no `type` as a stdio server, and skips it when it has a `url`.
    const url = lastMember(entry, 'url')?.value
    return url !== undefined && url.type !== 'Null'
      ? [{ node: url, messageId: 'urlNoType' }]
      : stdioFaults(entry)
  }
  if (type.type === 'String' && type.value === 'sdk') {
    return []
  }
  if (type.type === 'String' && type.value === 'stdio') {
    return stdioFaults(entry)
  }
  if (type.type === 'String' && REMOTE_SERVER_TYPES.includes(type.value)) {
    return remoteFaults(entry, type)
  }
  return [{ node: type, messageId: 'unknownType' }]
}

/** The faults of the plugin server entry `entry`. Validate 2.1.302 passes an entry with a `url`
 *  and no `type` when the entry has a good stdio shape: a `command` that is not empty, `args` of
 *  strings, and an `env` object (2.1.304). It reports each other fault, so the result is
 *  `urlNoType` or nothing. */
function pluginFaults(entry: ValueNode): { node: ValueNode; messageId: MessageIds }[] {
  if (stdioFaults(entry).length > 0) {
    return []
  }
  return entryFaults(entry).filter(({ messageId }) => messageId === 'urlNoType')
}

const rule: JSONRuleDefinition<{ MessageIds: MessageIds }> = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Give each MCP server entry the shape that Claude Code loads',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      notObject: `The server "{{server}}" is not an object. ${SKIP} Write its config as an object.`,
      urlNoType: `The server "{{server}}" has a \`url\` and no \`type\`, so Claude Code reads it as a stdio server. ${SKIP} Add \`"type": "http"\`, \`"sse"\` or \`"ws"\`.`,
      unknownType: `The server "{{server}}" has an unknown \`type\`. ${SKIP} Use \`stdio\`, \`http\`, \`streamable-http\`, \`sse\` or \`ws\`.`,
      noCommand: `The stdio server "{{server}}" has no \`command\`. ${SKIP} Set \`command\` to the program to run.`,
      commandType: `The \`command\` of the server "{{server}}" is not a string. ${SKIP}`,
      argsType: `The \`args\` of the server "{{server}}" is not an array. ${SKIP} Write \`args\` as an array of strings.`,
      argType: `An item of the \`args\` of the server "{{server}}" is not a string. ${SKIP}`,
      noUrl: `The remote server "{{server}}" has no \`url\`. ${SKIP} Set \`url\` to the endpoint.`,
      invalidUrl:
        'The `url` of the server "{{server}}" is not a valid absolute URL. Write a URL such as `https://host/path`.',
      emptyCommand: `The \`command\` of the server "{{server}}" is empty. ${SKIP} Set \`command\` to the program to run.`,
      envType: `The \`env\` of the server "{{server}}" is not an object. ${SKIP} Write \`env\` as an object of variable names and values.`,
      headersType: `The \`headers\` of the server "{{server}}" is not an object. ${SKIP} Write \`headers\` as an object of header names and values.`,
      oauthType: `The \`oauth\` of the server "{{server}}" is not an object. ${SKIP} Write \`oauth\` as an object.`,
    },
  },
  create(context) {
    const base = path.basename(context.filename)
    // A plugin has no `managed-mcp.json` component, and `claude plugin validate` 2.1.302 does not
    // read the file. So the rule reads it in all directories. Its map is the `mcpServers` object.
    const managed = base === 'managed-mcp.json'
    // A manifest holds plugin servers. A `.mcp.json` gets no report when Claude Code never reads
    // its path, or when the rule cannot read its directory.
    let kind: McpFileKind | null = 'project'
    if (!managed) {
      kind = base === 'plugin.json' ? 'plugin' : mcpFileKind(context.filename)
    }
    if (kind === null) {
      return {}
    }
    // Validate reads the manifest, so `plugin.json` gets the plugin faults. When the plugin has a
    // manifest, validate also reads its `plugin` or `both` file, so that file gets them too.
    // Validate fails a plugin with no manifest, so its file gets each fault.
    const validated =
      base === 'plugin.json' ||
      (kind !== 'project' && hasManifest(path.dirname(path.resolve(context.filename))) === true)
    const faultsOf = validated ? pluginFaults : entryFaults
    return {
      Document(node) {
        const servers: LintedServer[] = managed
          ? serverMembers(node.body, 'project').map((member) => ({
              name: keyOf(member.name),
              member,
            }))
          : lintedServers(context.filename, node.body)
        for (const server of servers) {
          for (const { node: at, messageId } of faultsOf(server.member.value)) {
            // A server of a declared file takes its report on its path in the manifest.
            context.report({
              node: server.pinned ?? at,
              messageId,
              data: { server: server.name },
            })
          }
        }
      },
    }
  },
}

export const target = {
  name,
  language: 'json' as const,
  files: ['**/.mcp.json', '**/managed-mcp.json', '**/.claude-plugin/plugin.json'],
}

export default rule

// A sandbox option that the docs say reduces security or removes isolation
// (docs/rules/sandbox-weakening-options.md). The rule reads one file, except for
// `autoAllowBashIfSandboxed`: a file of the source that sets it to false removes that fault, so
// the rule reads the source there, and makes no report when it cannot read a file. A project or
// local file cannot set `allowAppleEvents`, `allowPlaintextInject` or `filesystem.disabled`, and
// `settings-key-scope` reports the key there, so the rule leaves those keys alone in those files.
import type { JSONRuleDefinition } from '@eslint/json'
import { isIgnoredInRepoFile } from '../data/settings-keys.ts'
import { docsUrl } from '../docs-url.ts'
import type { ValueNode } from '../marketplace-json.ts'
import { SETTINGS_FILES } from '../permission-listener.ts'
import { isOn, stringEntries, valueAt } from '../permission-sandbox.ts'
import { at, sourceOf } from '../permission-source.ts'
import { isHiddenDropIn, kindOf, MANAGED_SETTINGS_FILES } from '../settings-files.ts'

const name = 'sandbox-weakening-options' as const

type MessageId =
  | 'weakerNested'
  | 'weakerNetwork'
  | 'allUnixSockets'
  | 'dockerSocket'
  | 'machLookupAll'
  | 'appleEvents'
  | 'plaintextInject'
  | 'filesystemDisabled'

/** The options that are true, as `[path, message]`. */
const FLAGS: readonly (readonly [readonly string[], MessageId])[] = [
  [['sandbox', 'enableWeakerNestedSandbox'], 'weakerNested'],
  [['sandbox', 'enableWeakerNetworkIsolation'], 'weakerNetwork'],
  [['sandbox', 'network', 'allowAllUnixSockets'], 'allUnixSockets'],
  [['sandbox', 'allowAppleEvents'], 'appleEvents'],
  [['sandbox', 'credentials', 'allowPlaintextInject'], 'plaintextInject'],
]

const rule: JSONRuleDefinition<{ RuleOptions: []; MessageIds: MessageId }> = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Do not weaken the sandbox with an option that removes isolation',
      url: docsUrl(name),
    },
    schema: [],
    messages: {
      weakerNested:
        '"enableWeakerNestedSandbox" bind-mounts the existing `/proc` of the container, which exposes process information. This considerably weakens security. Use it only when an outer layer already isolates the process.',
      weakerNetwork:
        '"enableWeakerNetworkIsolation" opens a potential data exfiltration path through the macOS trust service. It is for Go-based tools behind a MITM proxy with a custom CA. Without such a proxy, list the failing tools in "excludedCommands" instead.',
      allUnixSockets:
        '"allowAllUnixSockets" lets sandboxed commands connect to every Unix socket. On WSL2 it also reopens the interop socket that starts Windows binaries.',
      dockerSocket:
        '`{{entry}}` gives sandboxed commands control of the Docker daemon on macOS, and so of the host. Linux and WSL2 ignore the list. Do not allow a Docker socket.',
      machLookupAll:
        '"*" in "allowMachLookup" allows every XPC and Mach service. List the services that a tool needs, or a prefix such as `com.apple.coresimulator.*`.',
      appleEvents:
        '"allowAppleEvents" removes code-execution isolation: sandboxed commands can launch other applications unsandboxed with no user prompt. Add the one tool to "excludedCommands" instead.',
      plaintextInject:
        '"allowPlaintextInject" sends a credential in cleartext on plain HTTP, to an upstream with no verified identity. Use it only on trusted test networks.',
      filesystemDisabled:
        '"filesystem.disabled" gives sandboxed commands unrestricted read and write access to the host, and "autoAllowBashIfSandboxed" still defaults to `true`, so they run with no prompt. Set "autoAllowBashIfSandboxed" to `false`.',
    },
  },
  create(context) {
    if (isHiddenDropIn(context.filename)) {
      return {}
    }
    const isManaged = kindOf(context.filename) === 'managed'
    /** True when Claude Code reads the key in this kind of file. */
    const reads = (path: readonly string[]) => isManaged || !isIgnoredInRepoFile(path)
    return {
      Document(node) {
        for (const [path, messageId] of FLAGS) {
          const value = valueAt(node, path)
          if (isOn(value, isManaged) && reads(path)) {
            context.report({ node: value as ValueNode, messageId })
          }
        }
        for (const entry of stringEntries(
          valueAt(node, ['sandbox', 'network', 'allowUnixSockets']),
        )) {
          if (/(?:^|\/)docker\.sock$/.test(entry.value)) {
            context.report({ node: entry, messageId: 'dockerSocket', data: { entry: entry.value } })
          }
        }
        for (const entry of stringEntries(
          valueAt(node, ['sandbox', 'network', 'allowMachLookup']),
        )) {
          if (entry.value === '*') {
            context.report({ node: entry, messageId: 'machLookupAll' })
          }
        }
        const disabled = valueAt(node, ['sandbox', 'filesystem', 'disabled'])
        if (isOn(disabled, isManaged) && reads(['sandbox', 'filesystem', 'disabled'])) {
          const { objects, complete } = sourceOf(context.filename, context.sourceCode.text)
          const allowAuto = ['sandbox', 'autoAllowBashIfSandboxed']
          // A file that cannot be read can set the option to false.
          if (
            complete &&
            !objects.some((object) =>
              [false, 'false'].includes(at(object, allowAuto) as string | boolean),
            )
          ) {
            context.report({ node: disabled as ValueNode, messageId: 'filesystemDisabled' })
          }
        }
      },
    }
  },
}

export default {
  name,
  language: 'json' as const,
  files: [...SETTINGS_FILES, ...MANAGED_SETTINGS_FILES],
  rule,
}

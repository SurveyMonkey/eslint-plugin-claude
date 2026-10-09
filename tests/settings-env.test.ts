// The lists of `src/data/settings-env.ts` against the reviewed copies of the docs in
// docs/docs-snapshot/. The snapshot is a source that the module does not share. The names below
// are written by hand from the same pages, and a name that the docs add makes a test fail.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { envIgnoredIn, removedEnvVarSince } from '../src/data/settings-env.ts'

function snapshotText(page: string, id: string): string {
  const snapshot = JSON.parse(
    readFileSync(path.resolve(import.meta.dirname, `../docs/docs-snapshot/${page}.json`), 'utf8'),
  ) as { sources: { id: string; text: string }[] }
  const source = snapshot.sources.find((entry) => entry.id === id)
  if (source === undefined) {
    throw new Error(`The snapshot of ${page} has no source ${id}.`)
  }
  return source.text
}

const IGNORED = snapshotText('settings-reference', 'variables-claude-code-ignores-in-env')
const VARIABLES = snapshotText('env-vars', 'variables')

// A name in code font: an upper-case variable, or a Windows variable of the docs.
const NAME =
  /`((?:[A-Z][A-Z0-9_]*)|SystemRoot|ComSpec|ProgramData|LOCALAPPDATA|PATHEXT|PSModulePath|ProgramFiles)`/g

describe('the variables that settings cannot set, against the settings reference', () => {
  const named = [...new Set([...IGNORED.matchAll(NAME)].map(([, name]) => name ?? ''))]

  it('reads the names of the section', () => {
    expect(named.length).toBeGreaterThan(40)
  })

  it('knows each variable that the section names', () => {
    // `claude --debug` and the `/status` command are no variables, and the regular expression
    // skips them. The section also names `HOME`, which the module lists.
    const unknown = named.filter((name) => envIgnoredIn(name) === undefined)
    expect(unknown).toEqual([])
  })

  it('names each family of the module as a family in the section', () => {
    expect(IGNORED).toContain('`XDG_*` family')
    expect(IGNORED).toContain('`OTEL_EXPORTER_OTLP_*`')
    expect(IGNORED).toContain(
      '`_ENDPOINT`, `_HEADERS`, `_PROTOCOL`, `_CERTIFICATE`, `_CLIENT_KEY`, or `_INSECURE`',
    )
    expect(IGNORED).toContain('`ProgramFiles` family')
  })

  it('names the identity variables and the launch-environment variables as ignored in every file', () => {
    const everyFile = [
      'CLAUDE_CODE_REMOTE',
      'CLAUDE_CODE_ACCOUNT_UUID',
      'CLAUDE_CODE_MESSAGING_SOCKET',
      'CLAUDE_CODE_MESSAGING_TOKEN',
      'CLAUDE_CODE_PROJECT_DIR_NAME',
      'CLAUDE_CODE_RESTRICTED',
      'CLAUDE_CODE_DISABLE_POWERSHELL_CMD_RM_DENY',
      'CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT',
      'CLAUDE_CODE_DISABLE_SUBSTITUTION_RM_PROMPT',
      'CLAUDE_CODE_DISABLE_INLINE_SHELL_RM_PROMPT',
    ]
    for (const name of everyFile) {
      expect(IGNORED).toContain(`\`${name}\``)
      expect(envIgnoredIn(name)).toBe('every-file')
    }
    // The env vars reference says the same for this variable.
    expect(VARIABLES).toMatch(
      /\| `CLAUDE_CODE_DISABLE_ADMIN_ENV_UNION` \|[^\n]*ignores a copy delivered through a settings `env` block/,
    )
    expect(envIgnoredIn('CLAUDE_CODE_DISABLE_ADMIN_ENV_UNION')).toBe('every-file')
  })
})

describe('the removed variables, against the env vars reference', () => {
  const removed = [
    ...VARIABLES.matchAll(/^\| `([A-Z0-9_]+)` \| Removed in v(\d+\.\d+\.\d+)/gm),
  ].map(([, name, since]) => [name, since] as const)

  it('reads the removed rows', () => {
    expect(removed.length).toBeGreaterThanOrEqual(7)
  })

  it('gives each removed row the version of the docs', () => {
    expect(removed.map(([name]) => [name, removedEnvVarSince(name ?? '')])).toEqual(
      removed.map(([name, since]) => [name, since]),
    )
  })

  it('gives the variable that the docs accept and ignore the version after the last one it was needed in', () => {
    expect(VARIABLES).toMatch(
      /\| `CLAUDE_CODE_ENABLE_AUTO_MODE` \| Accepted for compatibility with older releases and has no effect\./,
    )
    expect(VARIABLES).toContain('In v2.1.158 through v2.1.206, setting this to `1` was required')
    expect(removedEnvVarSince('CLAUDE_CODE_ENABLE_AUTO_MODE')).toBe('2.1.207')
  })

  it('gives a variable that is not removed no version', () => {
    expect(removedEnvVarSince('API_TIMEOUT_MS')).toBeUndefined()
  })
})

describe('the value forms, against the docs', () => {
  it('has a row in the env vars reference for each variable with a form', () => {
    for (const name of [
      'CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH',
      'CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS',
      'CLAUDE_CODE_WEBFETCH_CACHE_TTL_MS',
      'CLAUDE_CODE_AUTO_COMPACT_WINDOW',
      'BASH_MAX_OUTPUT_LENGTH',
      'CLAUDE_CODE_TOOL_MEMORY_LIMIT',
      'CLAUDE_CODE_TOOL_MEMORY_CGROUP_EXCLUDE',
      'ENABLE_TOOL_SEARCH',
      'MCP_SDK_GENERATION',
      'MCP_PROTOCOL_NEGOTIATION',
      'CLAUDE_CODE_PROMPT_CACHE_TTL',
      'CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL',
      'CLAUDE_CODE_EFFORT_LEVEL',
      'CLAUDE_CODE_SHELL',
    ]) {
      expect(VARIABLES).toContain(`| \`${name}\` |`)
    }
    expect(VARIABLES).toContain('maximum: 150000')
    expect(VARIABLES).toContain('from `100000` to `1000000`')
  })

  it('names the kinds of the memory limit as the tools reference does', () => {
    const text = snapshotText('tools-reference', 'memory-limit-on-linux-and-wsl')
    for (const kind of ['mcp', 'lsp', 'hooks', 'plugin', 'helper', 'agent']) {
      expect(text).toContain(`* \`${kind}\`: `)
    }
    expect(text).toContain('Set `0`, `off`, `false`, `no`, or `none` to turn the cap off.')
  })

  it('names the capabilities as the model configuration page does', () => {
    const text = snapshotText('model-config', 'customize-pinned-model-display-and-capabilities')
    for (const capability of [
      'effort',
      'xhigh_effort',
      'max_effort',
      'thinking',
      'adaptive_thinking',
      'interleaved_thinking',
    ]) {
      expect(text).toContain(`| \`${capability}\` |`)
    }
  })

  it('states the range of the tool search threshold', () => {
    expect(snapshotText('mcp', 'configure-tool-search')).toContain('where `N` is 0-100')
  })
})

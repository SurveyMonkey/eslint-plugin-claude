// Red first: the rule does not exist yet, so each case is expected to fail.
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'

const ids = (code: string, platforms?: string[]) => {
  const filename = path.resolve('/repo/.claude/settings.json')
  return new Linter({ cwd: path.parse(filename).root })
    .verify(
      code,
      [
        {
          files: ['**/*.json'],
          plugins: { json, claude: plugin },
          language: 'json/json',
          rules: {
            'claude/settings-defaultshell-powershell-tool':
              platforms === undefined ? 'error' : ['error', { platforms }],
          },
        },
      ],
      { filename },
    )
    .map((m) => m.messageId)
}

describe('settings-defaultshell-powershell-tool (red)', () => {
  it.fails('reports powershell for macos without the tool variable', () => {
    expect(ids('{"defaultShell": "powershell"}', ['macos'])).toEqual(['off'])
  })
  it.fails('stays silent when the option is unset', () => {
    expect(ids('{"defaultShell": "powershell"}')).toEqual([])
    expect(ids('{"defaultShell": "powershell"}', ['linux'])).toEqual(['off'])
  })
})

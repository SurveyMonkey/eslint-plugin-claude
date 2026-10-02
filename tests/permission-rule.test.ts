// The grammar of the permissions page, "Permission rule syntax": `Tool` or
// `Tool(specifier)`, with literal parentheses inside the specifier.
import { describe, expect, it } from 'vitest'
import { paramName, parsePermissionRule } from '../src/permission-rule.ts'

describe('parsePermissionRule', () => {
  it.each([
    ['Bash', { tool: 'Bash', specifier: null }],
    ['mcp__puppeteer__*', { tool: 'mcp__puppeteer__*', specifier: null }],
    ['Bash(npm run build)', { tool: 'Bash', specifier: 'npm run build' }],
    ['WebFetch(domain:example.com)', { tool: 'WebFetch', specifier: 'domain:example.com' }],
    ['Bash()', { tool: 'Bash', specifier: '' }],
    // Parentheses inside the specifier are literal.
    ['Edit(./Finance (2024)/**)', { tool: 'Edit', specifier: './Finance (2024)/**' }],
    ['Bash(echo (a)', { tool: 'Bash', specifier: 'echo (a' }],
    // Nothing is trimmed.
    [' Bash ', { tool: ' Bash ', specifier: null }],
  ])('parses %j', (text, expected) => {
    expect(parsePermissionRule(text)).toEqual({ ok: true, ...expected })
  })

  it.each([
    ['', 'emptyTool'],
    ['(npm run build)', 'emptyTool'],
    ['Bash(npm run build', 'unbalanced'],
    ['Bash(', 'unbalanced'],
    ['Bash)', 'unbalanced'],
    ['Ba)sh(x)', 'unbalanced'],
    ['Bash(npm run build) --watch', 'trailingText'],
    ['Bash(x) ', 'trailingText'],
    ['Bash\0', 'nulByte'],
    ['Bash(a\0b)', 'nulByte'],
    // The NUL check comes before the check of the tool name.
    ['(\0)', 'nulByte'],
  ])('rejects %j as %s', (text, reason) => {
    expect(parsePermissionRule(text)).toEqual({ ok: false, reason })
  })
})

describe('paramName', () => {
  it.each([
    ['model:opus', 'model'],
    ['isolation:*', 'isolation'],
    [' model : opus', 'model'],
    ['command:rm *', 'command'],
  ])('reads the name of %j', (specifier, name) => {
    expect(paramName(specifier)).toBe(name)
  })

  it.each([['npm run *'], ['./src/**'], [''], ['a.b:c'], [':x'], ['1a:x']])(
    'reads no name in %j',
    (specifier) => {
      expect(paramName(specifier)).toBeNull()
    },
  )
})

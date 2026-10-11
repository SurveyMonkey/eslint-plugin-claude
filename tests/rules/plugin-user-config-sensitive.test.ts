// A `userConfig` option for a token or a password sets `sensitive: true` (components reference,
// "Ask the user for configuration values"). The docs name a token and a password only. The rule
// matches whole words of the key and of the `title`, so `tokenizer` stays silent. It reads the
// top-level `userConfig` and the `userConfig` of each channel. It skips an option that sets
// `sensitive` at all, an option with a `type` string other than `string`, and an option with
// `options`. The files glob is in tests/configs.test.ts.
import { describe, expect, it } from 'vitest'
import { lintPlugin, pluginTree } from '../plugin-tree.test-support.ts'

const RULE = 'plugin-user-config-sensitive'
const check = it

const option = (extra: Record<string, unknown> = {}) => ({
  type: 'string',
  title: 'Label',
  description: 'd',
  ...extra,
})
const run = (userConfig: unknown, more: Record<string, unknown> = {}) => {
  const { dir, code } = pluginTree({ name: 'p', userConfig, ...more })
  return lintPlugin(RULE, dir, code)
}

describe(RULE, () => {
  check('reports a token key, on the key, with the full message', () => {
    const { dir, code } = pluginTree({ name: 'p', userConfig: { api_token: option() } })
    const found = lintPlugin(RULE, dir, code)
    expect(found).toHaveLength(1)
    expect(found[0]?.column).toBe(code.indexOf('"api_token"') + 1)
    expect(found[0]).toMatchObject({
      ruleId: `claude/${RULE}`,
      messageId: 'sensitive',
      message:
        'The option "api_token" looks like a token or a password. Set `"sensitive": true`, so that Claude Code masks the input and keeps the value in secure storage.',
      line: 1,
    })
  })

  check.each([
    ['a password key', { password: option() }],
    ['a camelCase key', { botToken: option() }],
    ['an upper case key with an acronym', { APIToken: option() }],
    ['an upper case key', { API_TOKEN: option() }],
    ['a plural key', { tokens: option() }],
    ['a plural password key', { passwords: option() }],
    ['a key with a digit', { api2Token: option() }],
    ['a plural title', { cred: option({ title: 'Access Tokens' }) }],
    ['a option with no type', { api_token: { title: 'T' } }],
    ['a key with a hyphen', { 'db-password': option() }],
    ['a title with the word', { cred: option({ title: 'Admin Password' }) }],
  ])('reports %s', (_title, userConfig) => {
    expect(run(userConfig)).toHaveLength(1)
  })

  check('reports each option', () => {
    const found = run({ a_token: option(), b_password: option() })
    expect(found.map((one) => one.message.slice(12, 19))).toEqual(['a_token', 'b_passw'])
  })

  check('reports an option of a channel', () => {
    const found = run(undefined, {
      channels: [{ server: 's', userConfig: { bot_token: option() } }],
    })
    expect(found).toHaveLength(1)
  })
})

describe(`${RULE} (silent)`, () => {
  check.each([
    ['sensitive true', option({ sensitive: true })],
    ['sensitive false', option({ sensitive: false })],
    ['type number', option({ type: 'number' })],
    ['type boolean', option({ type: 'boolean' })],
    ['type directory', option({ type: 'directory' })],
    ['type file', option({ type: 'file' })],
    ['a choice list', option({ options: ['bearer', 'basic'] })],
  ])('stays silent for an option with %s', (_title, value) => {
    expect(run({ api_token: value })).toEqual([])
  })

  check.each([
    ['tokenizer', { tokenizer: option() }],
    ['a word that ends in token', { csrftoken: option() }],
    ['a count of tokens', { max_tokens: option({ type: 'number' }) }],
    ['secretary', { secretary: option() }],
    ['passwordless', { passwordless: option() }],
    ['a word in a title', { name: option({ title: 'Tokenizer' }) }],
    ['api_key, which the docs do not name', { api_key: option() }],
    ['a key with no word', { endpoint: option() }],
  ])('stays silent for %s', (_title, userConfig) => {
    expect(run(userConfig)).toEqual([])
  })

  check.each([
    ['an option that is not an object', { api_token: 'x' }],
    ['a title that is not a string', { cred: option({ title: 5 }) }],
    ['a userConfig that is not an object', 'x'],
    ['no userConfig', undefined],
  ])('stays silent for %s', (_title, userConfig) => {
    expect(run(userConfig)).toEqual([])
  })

  check('stays silent for a channel that has no userConfig', () => {
    expect(run(undefined, { channels: [{ server: 's' }] })).toEqual([])
  })

  check('stays silent when the manifest on disk does not parse', () => {
    const { dir } = pluginTree('{')
    expect(lintPlugin(RULE, dir, '{"name": "p", "userConfig": {"api_token": {}}}')).toEqual([])
  })
})

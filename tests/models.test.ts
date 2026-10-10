// The expected values are written by hand from the model configuration page
// (https://code.claude.com/docs/en/model-config): the "Model aliases" table, the "[1m]" lines of
// "Extended context", and "Override model IDs per version". The settings reference gives the
// aliases of `advisorModel`.
import { describe, expect, it } from 'vitest'
import {
  ADVISOR_ALIASES,
  BASE_ALIASES,
  DEFAULT_VALUE,
  FAMILY_ALIASES,
  familyOf,
  IGNORED_IN_LISTS,
  isAnthropicModelId,
  isModelAlias,
  isModelId,
  withoutSuffix,
} from '../src/data/models.ts'

describe('the model aliases', () => {
  it('holds the six aliases of the table, and the special value default', () => {
    expect([...BASE_ALIASES].sort()).toEqual(
      ['best', 'fable', 'haiku', 'opus', 'opusplan', 'sonnet'].sort(),
    )
    expect(DEFAULT_VALUE).toBe('default')
    expect([...FAMILY_ALIASES].sort()).toEqual(['fable', 'haiku', 'opus', 'sonnet'])
  })

  it('names the three aliases of advisorModel', () => {
    expect([...ADVISOR_ALIASES].sort()).toEqual(['fable', 'opus', 'sonnet'])
  })

  it('names the three entries that a deny list and an exact list ignore', () => {
    expect([...IGNORED_IN_LISTS].sort()).toEqual(['best', 'default', 'opusplan'])
  })

  it('accepts an alias, an alias with [1m], and default', () => {
    for (const value of ['fable', 'opus', 'sonnet', 'haiku', 'best', 'opusplan', 'default']) {
      expect(isModelAlias(value), value).toBe(true)
    }
    for (const value of ['sonnet[1m]', 'opus[1m]', 'opusplan[1m]', 'haiku[1m]']) {
      expect(isModelAlias(value), value).toBe(true)
    }
  })

  it('does not accept an ID, a wrong case, or a malformed suffix', () => {
    for (const value of [
      'Opus',
      'claude-opus-5-5',
      'opus[2m]',
      'opus[1m',
      'opus [1m]',
      'default[1m]',
      '',
      'opus ',
    ]) {
      expect(isModelAlias(value), value).toBe(false)
    }
  })
})

describe('the model ID forms', () => {
  it('accepts a claude- ID, a dated ID, and an ID with [1m]', () => {
    for (const value of [
      'claude-opus-5-5',
      'claude-sonnet-4-5-20250929',
      'claude-fable-5-1',
      'claude-haiku-4-5',
      'claude-opus-4-6[1m]',
      'claude-3-5-haiku-latest',
    ]) {
      expect(isModelId(value), value).toBe(true)
    }
  })

  it('does not accept an alias, a provider ID, or a malformed value', () => {
    for (const value of [
      'opus',
      'claude-',
      'Claude-opus-5',
      'claude opus',
      'claude-opus-5[1m',
      'claude-opus-5[2m]',
      'us.anthropic.claude-opus-4-8',
      'arn:aws:bedrock:us-east-1:123456789012:inference-profile/x',
      '',
    ]) {
      expect(isModelId(value), value).toBe(false)
    }
  })

  it('accepts an exact Anthropic ID for a modelOverrides key, without [1m]', () => {
    for (const value of ['claude-opus-4-7', 'claude-sonnet-4-5-20250929', 'claude-fable-5-1']) {
      expect(isAnthropicModelId(value), value).toBe(true)
    }
    for (const value of [
      'opus',
      'claude-opus-4-6[1m]',
      'us.anthropic.claude-opus-4-8',
      'claude-',
      'claude-Opus-4',
    ]) {
      expect(isAnthropicModelId(value), value).toBe(false)
    }
  })
})

describe('the family of a value', () => {
  it('reads the family of an alias, with or without [1m]', () => {
    expect(familyOf('sonnet')).toBe('sonnet')
    expect(familyOf('opus[1m]')).toBe('opus')
    expect(familyOf('fable')).toBe('fable')
    expect(familyOf('haiku')).toBe('haiku')
  })

  it('reads the family of an ID of either spelling', () => {
    expect(familyOf('claude-opus-5-5')).toBe('opus')
    expect(familyOf('claude-sonnet-4-5-20250929')).toBe('sonnet')
    expect(familyOf('claude-3-5-haiku-latest')).toBe('haiku')
    expect(familyOf('claude-fable-5')).toBe('fable')
    expect(familyOf('claude-opus-4-6[1m]')).toBe('opus')
  })

  it('has no family for best, opusplan, default, or a value that is no model name', () => {
    for (const value of [
      'best',
      'opusplan',
      'default',
      'inherit',
      'gpt-5',
      'claude-mythos-1',
      'my-opus-gateway',
      'xclaude-opus-5',
    ]) {
      expect(familyOf(value), value).toBeUndefined()
    }
  })

  it('reads the family of a provider ID that embeds a claude- name', () => {
    // The page says a provider-form ID "counts as a specific entry for that family".
    expect(familyOf('us.anthropic.claude-opus-4-8')).toBe('opus')
    expect(familyOf('my-gateway/claude-opus-5-5')).toBe('opus')
    expect(familyOf('anthropic.claude-sonnet-4-5-20250929-v1:0')).toBe('sonnet')
    expect(familyOf('global.anthropic.claude-haiku-4-5[1m]')).toBe('haiku')
  })
})

describe('the [1m] suffix', () => {
  it('is removed from the end of a value, and from nowhere else', () => {
    expect(withoutSuffix('opus[1m]')).toBe('opus')
    expect(withoutSuffix('claude-opus-4-6[1m]')).toBe('claude-opus-4-6')
    expect(withoutSuffix('opus')).toBe('opus')
    expect(withoutSuffix('[1m]opus')).toBe('[1m]opus')
    expect(withoutSuffix('opus[1m][1m]')).toBe('opus[1m]')
  })
})

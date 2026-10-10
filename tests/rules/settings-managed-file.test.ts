// The rule reads one managed settings file: `managed-settings.json` or a file in a
// `managed-settings.d/` directory. The files glob, and the match of a hidden file by that glob,
// are in tests/configs.test.ts. The page "Deploy managed settings" gives each fact:
// https://code.claude.com/docs/en/managed-settings
import { mkdirSync, symlinkSync } from 'node:fs'
import path from 'node:path'
import json from '@eslint/json'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../../src/index.ts'
import { repo } from '../agent-settings.test-support.ts'
import { chmodCannotBlock, jsonTester, ruleOf, withoutAccess } from '../rule-tester.test-support.ts'

const rule = ruleOf('settings-managed-file')

const main = 'managed-settings.json'
const dropIn = 'managed-settings.d/10-x.json'
const hidden = 'managed-settings.d/.10-x.json'
const obj = (value: object) => JSON.stringify(value)

jsonTester.run('settings-managed-file (valid)', rule, {
  valid: [
    // A file with a policy key counts.
    { code: obj({ model: 'opus' }), filename: main },
    { code: obj({ model: 'opus' }), filename: dropIn },
    { code: obj({ model: 'opus' }), filename: 'etc/claude-code/managed-settings.json' },
    { code: obj({ model: 'opus' }), filename: 'etc/claude-code/managed-settings.d/20-y.json' },
    // An empty object is an empty managed settings file. The docs say it counts as `{}`.
    { code: '{}', filename: main },
    { code: '{}', filename: dropIn },
    // A control key beside a policy key.
    { code: obj({ managedSourcesBehavior: 'first-wins', model: 'opus' }), filename: main },
    {
      code: obj({ wslInheritsWindowsSettings: true, allowManagedHooksOnly: true }),
      filename: dropIn,
    },
    // A policy key counts when its value is not `null`. A `null` removes the key, so the file
    // holds no key at all, and the rule has no control key to report.
    { code: obj({ model: null }), filename: main },
    {
      code: obj({ managedSourcesBehavior: null, wslInheritsWindowsSettings: null }),
      filename: dropIn,
    },
    // A control key with a `null` value is no control key, and a policy key beside it counts.
    { code: obj({ managedSourcesBehavior: null, model: 'opus' }), filename: main },
    // Two keys of one name. The rule reads the last. The last `managedSourcesBehavior` is not
    // "merge", so there is nothing to report.
    {
      code: '{"managedSourcesBehavior": "merge", "managedSourcesBehavior": "first-wins", "model": "x"}',
      filename: main,
    },
    // Two keys of one name: the last `model` is a value, so the file holds a policy key.
    { code: '{"model": null, "model": "x", "managedSourcesBehavior": "merge"}', filename: dropIn },
    // A drop-in with only control keys is silent: another file of the merged source can hold the
    // policy keys.
    { code: obj({ managedSourcesBehavior: 'first-wins' }), filename: dropIn },
    { code: obj({ wslInheritsWindowsSettings: true }), filename: dropIn },
    // "merge" beside a policy key in a drop-in. The page states the lowest rank for the
    // `managed-settings.json` file. The rule does not check a drop-in for it.
    { code: obj({ managedSourcesBehavior: 'merge', model: 'x' }), filename: dropIn },
    // A value of another type is not the string "merge".
    { code: obj({ managedSourcesBehavior: true, model: 'x' }), filename: main },
    // A file in `managed-settings.d` that is named `managed-settings.json` is a drop-in.
    { code: obj({ model: 'x' }), filename: 'managed-settings.d/managed-settings.json' },
    {
      code: obj({ managedSourcesBehavior: 'merge', model: 'x' }),
      filename: 'managed-settings.d/managed-settings.json',
    },
    // A dot inside a file name is not a hidden file.
    { code: obj({ model: 'x' }), filename: 'managed-settings.d/10.x.json' },
    // Only control keys, in a file that is no `managed-settings.json` file, or is a drop-in.
    { code: obj({ managedSourcesBehavior: 'first-wins' }), filename: 'x/other.json' },
    {
      code: obj({ managedSourcesBehavior: 'first-wins' }),
      filename: 'managed-settings.d/managed-settings.json',
    },
    // "merge" in a file with another name is no `managed-settings.json` file.
    { code: obj({ managedSourcesBehavior: 'merge', model: 'x' }), filename: 'x/other.json' },
    // A hidden name outside `managed-settings.d` is not a drop-in.
    { code: obj({ model: 'x' }), filename: 'other/.managed-settings.json' },
  ],
  invalid: [],
})

jsonTester.run('settings-managed-file (invalid)', rule, {
  valid: [],
  invalid: [
    // A top-level value that is not an object: Claude Code refuses to start. The report is on
    // the value.
    ...[main, dropIn].flatMap((filename) =>
      ['[1]', '"x"', '1', 'null', 'true', 'false'].map((code) => ({
        code,
        filename,
        errors: [{ messageId: 'notObject' as const }],
      })),
    ),
    {
      code: '\n  [{"a": 1}]',
      filename: main,
      errors: [{ messageId: 'notObject', line: 2, column: 3 }],
    },
    // A hidden drop-in: Claude Code ignores it. The report is on the top-level value.
    {
      code: obj({ model: 'opus' }),
      filename: hidden,
      errors: [{ messageId: 'hiddenDropIn', line: 1, column: 1 }],
    },
    // A hidden drop-in gets the one report. Claude Code does not read it, so a top level
    // that is not an object, and a control key, do not matter.
    { code: '[1]', filename: hidden, errors: [{ messageId: 'hiddenDropIn' }] },
    {
      code: obj({ managedSourcesBehavior: 'first-wins' }),
      filename: 'etc/claude-code/managed-settings.d/.20-y.json',
      errors: [{ messageId: 'hiddenDropIn' }],
    },
    // A `managed-settings.json` with only control keys and no policy drop-in beside it: Claude
    // Code does not count it, and moves on. A drop-in gets no such report (see below).
    ...[main].flatMap((filename) =>
      [
        { managedSourcesBehavior: 'first-wins' },
        { wslInheritsWindowsSettings: true },
        { wslInheritsWindowsSettings: false, managedSourcesBehavior: 'first-wins' },
        // A `null` removes a policy key, so only the control key is left.
        { model: null, managedSourcesBehavior: 'first-wins' },
      ].map((value) => ({
        code: obj(value),
        filename,
        errors: [{ messageId: 'controlKeysOnly' as const, line: 1, column: 1 }],
      })),
    ),
    // The last of two keys of one name counts.
    {
      code: '{"model": "x", "model": null, "managedSourcesBehavior": "first-wins"}',
      filename: main,
      errors: [{ messageId: 'controlKeysOnly' }],
    },
    // "merge" in `managed-settings.json` has no source below it to combine with.
    {
      code: obj({ managedSourcesBehavior: 'merge', model: 'x' }),
      filename: main,
      errors: [{ messageId: 'mergeNothing', line: 1, column: 27, endColumn: 34 }],
    },
    {
      code: '{"model": "x", "managedSourcesBehavior": "first-wins", "managedSourcesBehavior": "merge"}',
      filename: 'etc/claude-code/managed-settings.json',
      errors: [{ messageId: 'mergeNothing' }],
    },
    // A file with only "merge" gets one report: the file does not count, so "merge" has no effect.
    {
      code: obj({ managedSourcesBehavior: 'merge' }),
      filename: main,
      errors: [{ messageId: 'controlKeysOnly' }],
    },
  ],
})

// The text of each message.
jsonTester.run('settings-managed-file (message text)', rule, {
  valid: [],
  invalid: [
    {
      code: '[1]',
      filename: main,
      errors: [
        {
          message:
            'Claude Code refuses to start when a managed settings file is not a JSON object. The top-level value has the type Array.',
        },
      ],
    },
    {
      code: '{}',
      filename: hidden,
      errors: [
        {
          message:
            'Claude Code ignores the hidden file ".10-x.json" in managed-settings.d. Rename it, or remove it.',
        },
      ],
    },
    {
      code: obj({ wslInheritsWindowsSettings: true }),
      filename: main,
      errors: [
        {
          message:
            'This file holds only the control keys wslInheritsWindowsSettings and managedSourcesBehavior. Claude Code does not count it as a policy source, and moves on to the next source.',
        },
      ],
    },
    {
      code: obj({ managedSourcesBehavior: 'merge', model: 'x' }),
      filename: main,
      errors: [
        {
          message:
            '"merge" in a managed settings file has no source below it to combine with. The file is the lowest-ranked admin source.',
        },
      ],
    },
  ],
})

// A `managed-settings.json` file with only control keys is a fault only when no drop-in beside it
// holds a policy key. The rule reads the sibling `managed-settings.d/` on disk.
describe('settings-managed-file control keys with drop-ins on disk', () => {
  const CONTROL = JSON.stringify({ managedSourcesBehavior: 'first-wins' })
  const POLICY = JSON.stringify({ model: 'opus' })
  /** The message ids of the rule for the text `code` at `managed-settings.json` of `root`. */
  const lintMain = (root: string, code = CONTROL) =>
    new Linter({ cwd: path.parse(root).root })
      .verify(
        code,
        [
          {
            files: ['**/*.json'],
            plugins: { json, claude: plugin },
            language: 'json/json',
            rules: { 'claude/settings-managed-file': 'error' },
          },
        ],
        { filename: path.join(root, 'managed-settings.json') },
      )
      .map((message) => message.messageId)
  const ids = (files: Record<string, string>) => lintMain(repo(files))

  it('reports a file alone', () => {
    expect(ids({})).toEqual(['controlKeysOnly'])
  })
  it('reports beside a control-only drop-in', () => {
    expect(ids({ 'managed-settings.d/10-ctl.json': CONTROL })).toEqual(['controlKeysOnly'])
  })
  it('is silent beside a drop-in with a policy key', () => {
    expect(ids({ 'managed-settings.d/10-p.json': POLICY })).toEqual([])
  })
  it('reports beside a hidden drop-in with a policy key', () => {
    expect(ids({ 'managed-settings.d/.10-p.json': POLICY })).toEqual(['controlKeysOnly'])
  })
  it('reports beside a file that does not end in .json', () => {
    expect(ids({ 'managed-settings.d/10-p.txt': POLICY })).toEqual(['controlKeysOnly'])
  })
  it('reports when the policy key of the drop-in is null', () => {
    expect(ids({ 'managed-settings.d/10-p.json': '{"model": null}' })).toEqual(['controlKeysOnly'])
  })
  it('is silent when a drop-in does not parse to an object', () => {
    for (const text of ['[1]', '[]', 'null', '1', '"x"', '{']) {
      expect(ids({ 'managed-settings.d/10-p.json': text })).toEqual([])
    }
  })
  it('is silent when a drop-in is a dangling link', { skip: process.platform === 'win32' }, () => {
    const root = repo({})
    mkdirSync(path.join(root, 'managed-settings.d'))
    symlinkSync(path.join(root, 'gone.json'), path.join(root, 'managed-settings.d/10-p.json'))
    expect(lintMain(root)).toEqual([])
  })
  // A drop-in directory that is a dangling link, or a link out of
  // the repository, is a part that exists and that the rule cannot see (ADR 001, Decision 14).
  // `readManagedSource` gives `UNREADABLE`, so a file of control keys gets no report.
  it('is silent when the drop-in directory is a dangling link', {
    skip: process.platform === 'win32',
  }, () => {
    const root = repo({})
    symlinkSync(path.join(root, 'gone-directory'), path.join(root, 'managed-settings.d'))
    expect(lintMain(root)).toEqual([])
  })
  it('is silent when the drop-in directory is a link out of the repository', {
    skip: process.platform === 'win32',
  }, () => {
    const root = repo({})
    // The target holds control keys only. A rule that followed the link would report.
    const outside = repo({ 'managed-settings.d/10-ctl.json': CONTROL })
    symlinkSync(path.join(outside, 'managed-settings.d'), path.join(root, 'managed-settings.d'))
    expect(lintMain(root)).toEqual([])
  })
  it('is silent when a drop-in cannot be read', () => {
    if (chmodCannotBlock) {
      return
    }
    const root = repo({ 'managed-settings.d/10-p.json': POLICY })
    withoutAccess(path.join(root, 'managed-settings.d/10-p.json'), () => {
      expect(lintMain(root)).toEqual([])
    })
  })
  it('is silent when the drop-in directory cannot be read', () => {
    if (chmodCannotBlock) {
      return
    }
    const root = repo({ 'managed-settings.d/10-p.json': POLICY })
    withoutAccess(path.join(root, 'managed-settings.d'), () => {
      expect(lintMain(root)).toEqual([])
    })
  })
  it('reports a "merge" file with only control keys once', () => {
    expect(lintMain(repo({}), JSON.stringify({ managedSourcesBehavior: 'merge' }))).toEqual([
      'controlKeysOnly',
    ])
  })
  it('reports "merge" beside a policy drop-in', () => {
    const merge = JSON.stringify({ managedSourcesBehavior: 'merge' })
    const root = repo({ 'managed-settings.d/10-p.json': POLICY })
    expect(lintMain(root, merge)).toEqual(['mergeNothing'])
  })
})

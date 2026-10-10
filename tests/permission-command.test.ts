// The words of a command pattern. The permissions page treats a `:*` at the end as ` *`,
// and a `:*` in the middle as literal text:
// https://code.claude.com/docs/en/permissions#wildcard-patterns
import { expect, it } from 'vitest'
import { commandWords } from '../src/permission-command.ts'

it('splits a pattern at white space', () => {
  expect(commandWords('git log --oneline *')).toEqual(['git', 'log', '--oneline', '*'])
  expect(commandWords('  git   log\t*  ')).toEqual(['git', 'log', '*'])
})

it('gives no word for an empty pattern', () => {
  expect(commandWords('')).toEqual([])
  expect(commandWords('   ')).toEqual([])
})

it('reads a :* at the end as a final wildcard word', () => {
  expect(commandWords('ls:*')).toEqual(['ls', '*'])
  expect(commandWords('npm run:*')).toEqual(['npm', 'run', '*'])
  expect(commandWords('ls :*')).toEqual(['ls', '*'])
})

it('keeps a :* that is not at the end as part of a word', () => {
  expect(commandWords('git:* push')).toEqual(['git:*', 'push'])
  expect(commandWords(':*')).toEqual([':*'])
})

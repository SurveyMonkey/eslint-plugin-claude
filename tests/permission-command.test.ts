// The words of a command pattern. The permissions page treats a `:*` at the end as ` *`,
// and a `:*` in the middle as literal text:
// https://code.claude.com/docs/en/permissions#wildcard-patterns
import { expect, it } from 'vitest'
import {
  commandPatternMatches,
  commandWords,
  isInputParameterRule,
} from '../src/permission-command.ts'

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

it('reads a :* after a one-letter word, and trims the pattern before it reads the end', () => {
  expect(commandWords('a:*')).toEqual(['a', '*'])
  expect(commandWords('ls:*  ')).toEqual(['ls', '*'])
})

it('reads a parameter rule with white space around the colon', () => {
  expect(isInputParameterRule('deny', 'run_in_background : true')).toBe(true)
  expect(isInputParameterRule('ask', ' timeout:*')).toBe(true)
  expect(isInputParameterRule('allow', 'timeout:5')).toBe(false)
  expect(isInputParameterRule('deny', 'command:rm *')).toBe(false)
  expect(isInputParameterRule('deny', 'git log *')).toBe(false)
})

// The rows of the table in "Wildcard patterns":
// https://code.claude.com/docs/en/permissions#wildcard-patterns
it.each([
  ['npm run build', ['npm run build'], ['npm run build --watch']],
  ['npm run *', ['npm run build', 'npm run test --watch', 'npm run'], ['npm install']],
  [
    'git log * main',
    ['git log --oneline main', 'git log -5 main'],
    ['git log main', 'git push origin main'],
  ],
  ['git * main', ['git merge main', 'git push origin main'], ['git log']],
  ['* --version', ['node --version', "bash -c 'echo hi' --version"], ['node -v']],
  ['ls *', ['ls -la', 'ls'], ['lsof']],
  ['ls*', ['ls -la', 'lsof'], []],
  ['* --help *', ['npm --help x'], ['npm --help']],
  ['ls:*', ['ls -la', 'ls'], ['lsof']],
])('matches the pattern %s as the docs table says', (pattern, matches, misses) => {
  for (const command of matches) {
    expect(commandPatternMatches(pattern, command), command).toBe(true)
  }
  for (const command of misses) {
    expect(commandPatternMatches(pattern, command), command).toBe(false)
  }
})

it('reads a character of a pattern as text, and gives no match for an empty pattern', () => {
  expect(commandPatternMatches('a.b (x)', 'a.b (x)')).toBe(true)
  expect(commandPatternMatches('a.b (x)', 'axb (x)')).toBe(false)
  expect(commandPatternMatches('a?b', 'axb')).toBe(false)
  expect(commandPatternMatches('', '')).toBe(false)
  expect(commandPatternMatches('  ', 'ls')).toBe(false)
})

it('lets a * match text across lines', () => {
  expect(commandPatternMatches('git push *', 'git push origin\nmain')).toBe(true)
})

// Each list of `src/data/bash-commands.ts` is the list of a sentence of the permissions page. The
// sentences below are copied from the page, and the test reads the names between the backticks:
// https://code.claude.com/docs/en/permissions#process-wrappers
import { expect, it } from 'vitest'
import {
  ABSOLUTE_ROOTS,
  FETCH_COMMANDS,
  READ_ONLY_COMMANDS,
  READ_ONLY_WITH_PROMPTS,
  STRIPPED_WRAPPERS,
} from '../src/data/bash-commands.ts'

const names = (sentence: string) => [...sentence.matchAll(/`([^`]+)`/g)].map((match) => match[1])

const WRAPPER_SENTENCE =
  "The stripped wrappers are `timeout`, `time`, `nice`, `nohup`, and `stdbuf`, plus the shell builtins `command` and `builtin`, and zsh's `noglob`."
const READ_ONLY_SENTENCE =
  'The set includes `ls`, `cat`, `echo`, `pwd`, `head`, `tail`, `grep`, `find`, `wc`, `which`, `diff`, `stat`, `du`, `cd`, and read-only forms of `git`.'
const FETCH_SENTENCE = 'use deny rules to stop `curl`, `wget`, and similar commands'

it('pins the stripped wrappers to the sentence of the docs', () => {
  expect(STRIPPED_WRAPPERS).toEqual(names(WRAPPER_SENTENCE))
})

it('pins the read-only commands to the sentence of the docs, apart from git', () => {
  expect(READ_ONLY_COMMANDS).toEqual(names(READ_ONLY_SENTENCE).filter((name) => name !== 'git'))
})

it('pins the fetch commands to the sentence of the docs', () => {
  expect(FETCH_COMMANDS).toEqual(names(FETCH_SENTENCE))
})

it('lists only read-only commands that the docs say prompt for some arguments', () => {
  expect(READ_ONLY_WITH_PROMPTS.filter((name) => !READ_ONLY_COMMANDS.includes(name))).toEqual([])
  expect(READ_ONLY_WITH_PROMPTS).toEqual(['find', 'cd'])
})

it('has no project directory in the absolute roots', () => {
  expect(ABSOLUTE_ROOTS).toContain('Users')
  expect(
    ABSOLUTE_ROOTS.filter((name) => ['src', 'docs', 'lib', 'bin', 'dev'].includes(name)),
  ).toEqual([])
})

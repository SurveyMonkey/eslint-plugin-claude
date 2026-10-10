// The words of a command pattern, as `Bash(git log *)` holds it. The rules for
// `Bash` and the tools of its shape read the pattern by word
// (https://code.claude.com/docs/en/permissions#wildcard-patterns). The
// grammar of the rule itself is in `permission-rule.ts`.
import { paramName } from './permission-rule.ts'

/** The words of `specifier`, split at white space. A `:*` at the end of the
 *  pattern is the same as a final ` *`, so it gives the words before it and
 *  a final `*`. A `:*` anywhere else is part of a word, because Claude Code
 *  reads the colon there as a literal character. */
export function commandWords(specifier: string): string[] {
  const text = specifier.trim()
  const suffix = text.length > 2 && text.endsWith(':*')
  const words = (suffix ? text.slice(0, -2) : text).split(/\s+/).filter((word) => word !== '')
  return suffix ? [...words, '*'] : words
}

/** The input parameters of a command tool. The "Match by input parameter" section
 *  (https://code.claude.com/docs/en/permissions#match-by-input-parameter) names `run_in_background`
 *  and says the match works for any scalar parameter of the tool. The other three are fields of
 *  the Bash tool input. The plugin chooses them. */
export const COMMAND_PARAMETERS: readonly string[] = [
  'run_in_background',
  'description',
  'timeout',
  'dangerouslyDisableSandbox',
]

/** True for a deny or ask rule on an input parameter of a command tool, as in
 *  `Bash(run_in_background:true)` and `Bash(run_in_background:*)`. There the `*` is the wildcard of
 *  a value and not a command suffix
 *  (https://code.claude.com/docs/en/permissions#match-by-input-parameter). Only the parameters
 *  that are not the command itself are listed. */
export function isInputParameterRule(list: string, specifier: string): boolean {
  return list !== 'allow' && COMMAND_PARAMETERS.includes(paramName(specifier) ?? '')
}

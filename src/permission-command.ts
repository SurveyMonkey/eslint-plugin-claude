// The words of a command pattern, as `Bash(git log *)` holds it. The rules for
// `Bash` and the tools of its shape read the pattern by word
// (https://code.claude.com/docs/en/permissions#wildcard-patterns). The
// grammar of the rule itself is in `permission-rule.ts`.

/** The words of `specifier`, split at white space. A `:*` at the end of the
 *  pattern is the same as a trailing ` *`, so it gives the words before it and
 *  a final `*`. A `:*` anywhere else is part of a word, because Claude Code
 *  reads the colon there as a literal character. */
export function commandWords(specifier: string): string[] {
  const text = specifier.trim()
  const suffix = text.length > 2 && text.endsWith(':*')
  const words = (suffix ? text.slice(0, -2) : text).split(/\s+/).filter((word) => word !== '')
  return suffix ? [...words, '*'] : words
}

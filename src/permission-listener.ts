// The listener that the grammar rules share. A rule reads permission rules
// from two kinds of file. A settings file is JSON, with a `Document` node. A
// skill or command file is Markdown, with a `yaml` node for its frontmatter.
// One rule object serves both languages, as in `agent-teams-no-project-config`.
import type { JSONRuleVisitor } from '@eslint/json'
import type { MarkdownSourceCode } from '@eslint/markdown'
import type { Rule } from 'eslint'
import {
  type ParsedEntry,
  type PermissionEntry,
  parsedEntries,
  permissionEntries,
  skillEntries,
} from './permission-entries.ts'
import { isHiddenDropIn } from './settings-files.ts'
import { classifySkillFile } from './skill-files.ts'
import { readFrontmatter } from './skill-frontmatter.ts'

/** The project settings files that hold permission rules. The managed settings
 *  files are in `MANAGED_SETTINGS_FILES` (`src/settings-files.ts`). A rule that
 *  lists only `SETTINGS_FILES` does not lint a managed file. A grammar rule
 *  lists both sets, and `permissionListener` skips a hidden drop-in. */
export const SETTINGS_FILES = ['**/.claude/settings.json', '**/.claude/settings.local.json']

/** The second target of a grammar rule: the skill and command files, where
 *  `allowed-tools` and `disallowed-tools` hold permission rules. */
export const SKILL_TARGET = {
  language: 'markdown' as const,
  files: ['**/SKILL.md', '**/commands/**/*.md'],
}

/** A listener that calls `check` with the permission rules of the file. For a
 *  settings file, it does so unless the file is a hidden drop-in in
 *  `managed-settings.d`: Claude Code ignores that file. For a Markdown file,
 *  it does so only when the file is a skill or a command file, and its
 *  frontmatter parses. */
export function permissionListener(
  context: Rule.RuleContext,
  check: (entries: PermissionEntry[]) => void,
): Rule.RuleListener {
  const listener = {
    Document(node: Parameters<typeof permissionEntries>[0]) {
      if (!isHiddenDropIn(context.filename)) {
        check(permissionEntries(node))
      }
    },
    yaml(node: Parameters<typeof readFrontmatter>[1]) {
      if (classifySkillFile(context.filename) === null) {
        return
      }
      // The `yaml` node exists in a Markdown tree only, so the source code is a Markdown one.
      const fm = readFrontmatter(context.sourceCode as unknown as MarkdownSourceCode, node)
      if (fm !== null) {
        check(skillEntries(fm, node.value))
      }
    },
  }
  // `Rule.RuleListener` types a node as an ESTree node. These nodes are not.
  return listener as unknown as Rule.RuleListener
}

/** The root node of a settings file. */
export type SettingsDocument = Parameters<NonNullable<JSONRuleVisitor['Document']>>[0]

/** A listener for a rule that reads settings files only, and not skill files.
 *  It calls `check` with the entries that parse and the document, and skips a
 *  hidden drop-in in `managed-settings.d`. An entry that does not parse is for
 *  `permissions-rule-syntax`. */
export function settingsListener(
  context: { readonly filename: string },
  check: (entries: ParsedEntry[], document: SettingsDocument) => void,
): JSONRuleVisitor {
  return {
    Document(node) {
      if (!isHiddenDropIn(context.filename)) {
        check(parsedEntries(permissionEntries(node)), node)
      }
    },
  }
}

---
type: ADR
description: The checks for Claude Code configuration files (SKILL.md, agents, plugin and marketplace manifests, hooks.json, settings) live in an ESLint plugin, eslint-plugin-claude, on @eslint/markdown and @eslint/json, with `yaml` for frontmatter. It is TypeScript built to `dist/`, published to npm from this repository, and ships the `recommended` and `strict` configs. Its rules check only the files that a git repository holds.
status: stable
created: 2026-09-29
owner: brianespinosa
related_issues: [5, 6, 7, 8, 23, 56]
---

# ADR 001: An ESLint plugin for Claude Code configuration files

## Context

**A person found a defect that a check could find.** A review found a skill description with a
narrow trigger. That skill set `user-invocable: false`, so the description was its only
trigger. An earlier case was of the same kind: a frontmatter flag hid a skill from the skills that
call it.

**The current checks cover structure, not practice.** `claude plugin validate --strict` checks that
a manifest loads, and it only turns warnings into errors
([plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference)).
Nothing checks the practices in the [skills docs](https://code.claude.com/docs/en/skills).

**The checks span two file formats and more than one file.**

- Skills and agents are Markdown with YAML frontmatter.
- Plugin manifests, the marketplace manifest, `hooks.json` and settings are JSON.
- Some checks read a second file. Examples: a skill name that must match its directory, a
  referenced file that must exist, and a hook command that must point at a real script.

**A check that reads files out of the repository gives a result that the repository does not
fix.** Claude Code also loads configuration from the user's machine, such as `~/.claude/` and
links to folders out of the checkout. A check that reads those files gives two contributors, or a
contributor and CI, different reports for one commit. It also costs time on each lint: in review
of [#41](https://github.com/SurveyMonkey/eslint-plugin-claude/pull/41), one link to a large folder
out of the repository made a single lint take 92 seconds.

**A team can want a stricter number than the docs give.** Many rules check a number, such as
1,536 characters for a skill description, 500 lines for a `SKILL.md` or 200 lines for a
`CLAUDE.md`. The docs give each default. A team can want shorter files, and a number that is fixed
in the rule gives it no way to say so. A message that names the docs value is false at a team
value (#56).

**Teams in more than one organization need the same checks.** They need one install, not a set of
tools to join together. The checks must run in three places: the editor, a staged-only commit
hook, and CI.

**The checks must come from a trusted source.** A check that a third party can change without
review is not acceptable. A Claude Code plugin that updates itself and runs scripts in a session is
not acceptable either.

**Current tools do not meet all of these constraints.** An evaluation found:

| Tool | Why it does not fit |
|------|---------------------|
| [Skillsaw](https://github.com/stbenjam/skillsaw) | The authors control the checks. It needs Python, and its commit hook lints the whole repository. |
| [claudelint](https://github.com/pdugan20/claudelint) | The authors control the checks. It has no staged-only hook, and one form is a Claude Code plugin. |
| [@gtbuchanan/eslint-plugin-agent-skills](https://github.com/gtbuchanan/tooling/tree/main/packages/eslint-plugin-agent-skills) | It covers `SKILL.md` only. One maintainer publishes it, and v1.0.0 is from 2026-09-05. |
| Biome GritQL plugins | Biome has no Markdown parser. A GritQL pattern sees one file only. |
| markdownlint-cli2 custom rules | It is for Markdown. Its editor extension does not lint JSON. |
| Oxlint JS plugins | Oxlint lints JavaScript and TypeScript only. |

No package named `eslint-plugin-claude` was on npm on 2026-09-27.

## Decision

1. **An ESLint plugin that this repository writes and owns checks Claude Code configuration
   files.** Its rules use the two official ESLint language plugins:
   - [`@eslint/markdown`](https://github.com/eslint/markdown), with `frontmatter: "yaml"`, for
     skills, agents and commands;
   - [`@eslint/json`](https://github.com/eslint/json) for manifests, `hooks.json` and settings.

   A rule that needs a second file reads it from `context.filename`. No third-party ESLint plugin
   is a dependency. The two plugins in the table above are prior art to read, not code to import.
2. **The plugin ships two configs.**
   - `recommended` holds the rules that follow from the
     [Claude Code docs](https://code.claude.com/docs). Any team can use it. A rule goes here only
     when the Claude Code docs are its source.

   This plugin lints the files of the Claude Code harness only. A rule that no Claude Code docs
   page gives is not a rule in this package, even when other documentation gives it. Such
   documentation covers skills outside Claude Code, where the limits are different (#23).
   - `strict` extends `recommended`, then turns on at `warn` each rule that is still off, the
     heuristics included. It gives an easy way to test the full rule set.

   A rule that checks a number can take a stricter team value as an option:
   - The option is optional. Its default is the value from the Claude Code docs. A config that sets
     only the severity keeps the default.
   - `recommended` and `strict` set no option.
   - A stricter team value is not a new rule. It is also not a convention of one organization,
     because the docs value stays the default.
   - Where Claude Code cuts or skips the file over the number (a hard limit), the option schema
     sets `maximum` to the docs value. ESLint then refuses a larger value. A larger value would
     hide a fault that Claude Code makes real. The cost: if Claude Code raises the limit, the schema
     blocks the new value until a release of this plugin.
   - At a value that is not the default, the message names the value as the configured limit. It
     does not say that Claude Code acts at that value.

   A convention of one organization is not a rule in this package. A check that needs a model
   judgment is not a lint rule. A check that `claude plugin validate` already covers fully is not
   a rule either. A check that validate covers in part is a rule, for the cases validate misses. The [rule inventory](../rules-inventory.md) lists the candidates
   with a preset and a severity for each.
3. **The name is `eslint-plugin-claude`, unscoped.** Its namespace is `claude`, and its rules read
   `claude/<rule>` in a config.
4. **The code lives in this standalone public repository.** It is TypeScript in `src/`, and `tsc`
   builds it to `dist/`. Only `dist/`, `README.md`, `LICENSE` and `package.json` are published.
5. **It is published to the npm registry.** release-please reads the Conventional Commit titles
   on `main` and opens a release pull request. Merging it publishes through npm trusted publishing
   (OIDC), with no npm token. `CONTRIBUTING.md` describes the release flow and the CI checks.
6. **The frontmatter parser is `yaml`.** `@eslint/markdown` gives the frontmatter as raw text.
   `yaml` parses it, in one helper that each rule calls. A hand-written parser would fail on
   folded, block and quoted scalars.
7. **Biome lints this repository's source, and ESLint is the product.** Biome checks the
   TypeScript and JSON in this repository. The plugin's rules lint Claude Code configuration files
   in the repositories that install it.
8. **`@eslint/markdown` and `@eslint/json` are `peerDependencies`, and `yaml` is a
   `dependency`.**
   - The two language plugins are peers, at `^8.0.0` and `^2.0.0`. The consumer installs one
     copy of each. The configs import that copy and register it in `plugins`, so a consumer
     needs no other setup.
   - ESLint 10 refuses two different plugin objects under one name, with
     `Cannot redefine plugin "markdown"` (`eslint/lib/config/flat-config-schema.js:398`, ESLint
     10.11.0). A copy inside this package would cause this error for a consumer that also
     configures `@eslint/markdown`. A peer gives one copy, so the two objects are the same.
   - The cost: the install line names both peers. If the package manager does not install
     peers, a missing peer shows as a load error.
   - `yaml` is a runtime `dependency`, at an exact version. The frontmatter helper of Decision 6
     imports it, and a consumer does not configure it.

9. **Each rule module names its own `files` glob and language.** A new rule adds no entry to a
   central list.
10. **Globs are broad, and a rule checks the plugin root in code.** For example, the glob
    `**/commands/**/*.md` matches many paths. The rule reports only under `.claude/commands/`, or
    next to `.claude-plugin/plugin.json`.
11. **A value set that Claude Code owns lives in one data module.** Hook events, tool names and
    settings key scopes are examples. The module is in `src/data/`. It records the Claude Code
    version that the values came from, and a review date.
12. **Tests have two layers.** A RuleTester test under vitest covers each rule. One ESLint-class
    test runs each config over a tree in a temporary directory.
13. **Each rule has one doc.** The doc is at `docs/rules/<rule>.md`, and `meta.docs.url` points to
    it. The [rule inventory](../rules-inventory.md) stays the backlog of candidate rules.
14. **The plugin checks what a git repository holds.** It helps a team govern the Claude Code files
    that it writes and commits. It does not manage the Claude Code configuration of a user.
    - A rule reads no file out of the repository. The repository is the first directory at or
      above the linted file that has a `.git` entry.
    - A rule does not follow a link whose real path is out of the repository.
    - A rule does not model what Claude Code loads from out of the repository, such as user
      settings or agents in `~/.claude/`.
    - A rule that cannot see a file because of this limit makes no report that rests on that file.
      A rule option, such as `allow`, names what the repository cannot see.

These items were open, and are now settled:

- **The build step.** The earlier design ran erasable TypeScript directly, with no build step, and
  loaded the plugin by relative path. Node does not strip types from a file under `node_modules`,
  so a published package must ship JavaScript. Decision 4 settles this with a `tsc` build to
  `dist/`.
- **Sharing.** The earlier design left the registry, the version policy and the build to a later
  decision. Decisions 3 to 5 settle them: an unscoped npm package, versioned by release-please.
- **How `@eslint/markdown`, `@eslint/json` and `yaml` reach a consumer.** The first rules
  ([#6](https://github.com/SurveyMonkey/eslint-plugin-claude/issues/6)) import all three.
  Decision 8 settles it.

## Consequences

- **A team can set a stricter number, and cannot set a looser one past a hard limit.** Each rule
  that checks a number takes it as an option. `CONTRIBUTING.md` states the form, and
  `tests/limit-options.test.ts` fails for a built `limit` rule with no option.
- **One install covers every file type and every venue.** A team adds one package and what it
  needs to run. It then gets the same rules in the editor, in a hook and in CI.
- **A consuming repository may run two linters.** A repository that uses Biome keeps it for its
  code and adds ESLint for its Claude Code files. The file globs keep them apart, but a
  contributor installs both editor extensions.
- **Each contributor and CI get the same reports for one commit.** The cost: a rule cannot catch a
  fault that needs a file out of the repository, such as a skill that names an agent in
  `~/.claude/agents/`. A rule option names such a file, or the rule stays silent.
- **A rule that reads a second file needs a CI run without `--cache`.** The ESLint cache stores one
  result per file, so it does not see a change to that second file. The editor and a staged-only
  hook can miss the defect until CI runs.
- **A rule can be wrong in a way a test cannot see.** Each rule gets fixtures that show it reports
  when it must and stays silent when it must not. The fixtures come from real cases, such as a
  skill description with a narrow trigger and a frontmatter flag that hid a skill from its
  callers.

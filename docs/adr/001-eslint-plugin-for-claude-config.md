---
type: ADR
description: The checks for Claude Code configuration files (SKILL.md, agents, plugin and marketplace manifests, hooks.json, settings) live in an ESLint plugin, eslint-plugin-claude, on @eslint/markdown and @eslint/json, with `yaml` for frontmatter. It is TypeScript built to `dist/`, published to npm from this repository, and ships the `recommended` and `strict` configs.
status: stable
created: 2026-09-29
owner: brianespinosa
related_issues: [5]
---

# ADR 001: An ESLint plugin for Claude Code configuration files

## Context

**A person found a defect that a check could find.** A review found a skill description that did
not follow the skill authoring guidance. The description was imperative, not third person, and its
trigger was narrow. That skill set `user-invocable: false`, so the description was its only
trigger. An earlier case was of the same kind: a frontmatter flag hid a skill from the skills that
call it.

**The current checks cover structure, not practice.** `claude plugin validate --strict` checks that
a manifest loads, and it only turns warnings into errors
([plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference)).
Nothing checks the practices in the [skills docs](https://code.claude.com/docs/en/skills) or the
[skill authoring guide](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).

**The checks span two file formats and more than one file.**

- Skills and agents are Markdown with YAML frontmatter.
- Plugin manifests, the marketplace manifest, `hooks.json` and settings are JSON.
- Some checks read a second file. Examples: a skill name that must match its directory, a
  referenced file that must exist, and a hook command that must point at a real script.

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
   - `recommended` holds the rules that follow from the Claude Code docs and the skill authoring
     guide. Any team can use it. A rule goes here only when Anthropic documentation is its source.
   - `strict` extends `recommended`, then turns on at `warn` each rule that is still off, the
     heuristics included. It gives an easy way to test the full rule set.

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
   `yaml` parses it, once for each file, in one helper that each rule calls. A hand-written parser
   would fail on folded, block and quoted scalars.
7. **Biome lints this repository's source, and ESLint is the product.** Biome checks the
   TypeScript and JSON in this repository. The plugin's rules lint Claude Code configuration files
   in the repositories that install it.

Two items were open in the earlier design and are now settled:

- **The build step.** The earlier design ran erasable TypeScript directly, with no build step, and
  loaded the plugin by relative path. Node does not strip types from a file under `node_modules`,
  so a published package must ship JavaScript. Decision 4 settles this with a `tsc` build to
  `dist/`.
- **Sharing.** The earlier design left the registry, the version policy and the build to a later
  decision. Decisions 3 to 5 settle them: an unscoped npm package, versioned by release-please.

Still open:

- **How `@eslint/markdown` and `@eslint/json` reach a consumer.** They can be `peerDependencies`,
  which the consumer installs and configures, or `dependencies`, which the plugin wires into its
  configs. The first rule that needs one settles it.
- **Where `yaml` sits.** It is a runtime `dependency` unless the parser choice changes.

## Consequences

- **One install covers every file type and every venue.** A team adds one package and what it
  needs to run. It then gets the same rules in the editor, in a hook and in CI.
- **A consuming repository may run two linters.** A repository that uses Biome keeps it for its
  code and adds ESLint for its Claude Code files. The file globs keep them apart, but a
  contributor installs both editor extensions.
- **A rule that reads a second file needs a CI run without `--cache`.** The ESLint cache stores one
  result per file, so it does not see a change to that second file. The editor and a staged-only
  hook can miss the defect until CI runs.
- **A rule can be wrong in a way a test cannot see.** Each rule gets fixtures that show it reports
  when it must and stays silent when it must not. The fixtures come from real cases, such as a
  skill description that did not follow the authoring guide and a frontmatter flag that hid a
  skill from its callers.

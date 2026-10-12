---
type: ADR
description: eslint-doc-generator 3.7.1 writes the README rule list and the header and options list of each rule doc from the rule meta, in its own format. A docs check in CI fails when they do not agree. The rule details, the examples, Usage, the Category and Files table and Sources stay hand-written.
status: stable
created: 2026-10-11
owner: brianespinosa
related_issues: [234, 235, 236]
---

# ADR 003: Generate the rule list and the rule doc headers with eslint-doc-generator

## Context

**The hand docs did not agree with the code.** People wrote the README rule tables and the 450
rule docs by hand. A new rule or a new option needed edits in several places. No check compared
them with the code. The "Checks" text of each README row did not match the
`meta.docs.description` of its rule (#236).

**The format of #234 put more facts in each place.** The README tables of #234 gave a severity
column for each config and each option with its default. Each rule doc gave a Config and Severity
table and an Options table. Each of these facts is also in the rule `meta` or in the configs.
So one change to a rule made more cells go out of date.

**#235 put the facts in `meta`.** Each schema option has a `description`, and each rule with
options keeps its defaults in `meta.defaultOptions`. A tool can now read all of them.

## Decision

1. **eslint-doc-generator 3.7.1 writes the generated parts, in its own format.** It is an exact
   dev dependency. It writes the README rule list and the header and options list of each rule
   doc. The README rule list has the columns name, description, a column for each config
   severity, and options. It gives no option default. The options list of each rule doc gives the
   defaults.
2. **The config is `.eslint-doc-generatorrc.mjs`.**
   - The title of a rule doc is `prefix-name`, such as `# claude/skill-max-lines`.
   - A `ruleListSplit` function puts each rule in one of 9 groups, by the type of file that it
     checks. The function stops the run for a rule in no group. It also stops the run for a name
     in a group that is not a rule.
3. **`pnpm docs:generate` writes the docs, and `pnpm docs:check` checks them.** Each script
   builds `dist/` first, because the generator loads the built plugin. The `docs` check in CI
   runs `pnpm docs:check`. It fails when a generated part does not agree with the code.
4. **`package.json` has `"main": "./dist/index.js"`.** The generator loads the plugin with a
   `require` of the package root. A `require` of a directory reads `main`, not `exports`. For a
   consumer, `exports` still applies.
5. **These parts stay hand-written:**
   - the Rule details, the examples and the hand prose under `## Options`;
   - the `## Usage` block;
   - the `| Category | Files |` table under the generated header;
   - the `## Sources` footnotes and the frontmatter.

   `tests/docs.test.ts` compares the Files cell of each doc with the files of the rule. It also
   compares the Usage severity with the `recommended` severity, or with the `strict` severity for
   a rule that is off in `recommended`.

## Consequences

- **The README lost three facts of #234.** These are the Checks text, the severity of each config
  as a word, and the option defaults. The description of each rule replaces the Checks text. The
  options list of each rule doc gives the defaults.
- **A new rule needs no hand edit of the README list.** Its author adds the rule to a group in
  the generator config, and runs `pnpm docs:generate`.
- **The `docs` check needs `dist/`.** The check builds first, so it is slower than a check that
  reads the source.
- **The "Require CI" ruleset needs the `docs` check.** A person adds it after the first run
  reports it.
- **A schema `description` is now text of the docs.** A change to it changes the options list of
  the doc. `pnpm docs:check` fails until its author runs `pnpm docs:generate`.

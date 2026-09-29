---
name: testing
description: This repository's test strategy for ESLint rules and configs. Covers the seam (RuleTester and Linter), where a test and its fixtures live, fixtures that report and fixtures that stay silent, asserting the result rather than the parse, expected values from an independent source, real specimens, red first, the 100% coverage gate, and the review checklist. Use when you write or review a test under tests/, add or change a rule or config in src/, or fix a defect found by running the plugin.
---

# Testing

This is the strategy that the gates enforce. `CONTRIBUTING.md` has the commands. Nothing here
repeats them.

Paired examples: [tests.md](tests.md). What to mock, and how to inject a dependency:
[mocking.md](mocking.md).

## Seams

- **A rule is tested through ESLint's `RuleTester`**, never by a call to a private helper of the
  rule. Give each case the file name and the language that the rule gets in real use: for
  example, `markdown/gfm` with `frontmatter: "yaml"` for a `SKILL.md`, and `json/json` for a
  manifest ([RuleTester](https://eslint.org/docs/latest/integrate/nodejs-api#ruletester)).
- **A config is tested through `Linter` and `defineConfig`**, the way a user loads it: by name
  in `extends`, and as the object from `plugin.configs`.
- **A shared helper in `src/`** (frontmatter, plugin roots) has its own tests only when more
  than one rule uses it. Otherwise, the tests of the rules cover it.
- **The built package** is tested once, by the smoke test in `ci.yml`. It installs the packed
  tarball into an empty directory and loads it in ESLint.

**Agree the seams and the cases first.** Before you write a new rule, its issue lists the cases
that must report and the cases that must stay silent, with a docs source for each. The reviewer
of the issue agrees to that list, not only to the idea.

## Layout

- A test lives under `tests/`, at the mirror of the code that it covers:
  `tests/rules/<rule>.test.ts` for `src/rules/<rule>.ts`.
- Fixtures go beside the tests that load them. Nothing test-only goes in `src/`, because `src/`
  builds into the published package.
- A rule that reads a second file (a cross-file rule) gets a real directory tree in a temporary
  directory. Do not mock the file system ([mocking.md](mocking.md)).

## Both sides of every rule

Each rule has `invalid` cases that report and `valid` cases that stay silent. The `valid` side
includes the near misses: the shape that is almost wrong and is correct. A rule with no `valid`
case can report on everything and still pass.

In ESLint 10, an `invalid` error object does not use `type`, and a `valid` case has no `errors`
or `output` ([migrate to v10](https://eslint.org/docs/latest/use/migrate-to-10.0.0)).

## Assert the result, not the parse

- Assert the `messageId`, the location and the `output` of a fix. A test that stops at "the
  file parsed" passes while the defect stays.
- The title of a case claims no more than its assertion checks.
- Do not assert how the rule gets its result: no call counts, no call order. These fail on a
  refactor that keeps the behavior.

## Expected values come from an independent source

The expected value must be able to disagree with the code. It can be:

- a literal, written by hand from the behavior that the rule specifies;
- the Claude Code docs, cited on the rule's row in `docs/rules-inventory.md`;
- a specimen, trimmed from a real Claude Code file.

Never calculate the expected value the way the code calculates it.

## Specimens

- A fixture is a Claude Code file that breaks a rule on purpose. Do not "fix" a fixture to follow
  the conventions that it tests.
- A shape seen in real use is the specimen. Do not write a shape by hand when a real sample
  exists.
- Rebuild the shape of a real case. Do not copy specifics from private repositories.

## Red first

- **A fix without a fixture is not a fix.** A defect found by running the plugin lands with a
  fixture of that exact shape, in the same commit as the fix.
- **Prove the red.** Run the new case against the code before the fix, and see it fail.
- **One case at a time for a new rule.** Write one case, then the smallest code that passes it,
  then the next case. Do not write all the cases first: bulk cases test imagined behavior.

## Coverage

`vitest.config.ts` sets 100 on lines, branches, functions and statements over `src/`, and
`scripts/check-coverage.mjs` fails a report that names no file.

- Do not lower a threshold.
- Do not exclude a file from coverage.
- If no test can reach a branch, change the code so that the branch does not exist: move the
  decision into a function that takes, as an argument, what the decision depends on.

## Review checklist

1. **Seam or internals?** `RuleTester` and `Linter`, or a private helper.
2. **Both sides?** An `invalid` case and a `valid` case, with the near miss.
3. **Literal or calculated?** Can the expected value disagree with the code?
4. **Result or parse?** Does the assertion check the report, its location and its fix?
5. **Would the named defect fail?** Name the defect that the case is for, and check that it dies.
6. **Does the title claim more than the assertion checks?**

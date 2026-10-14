# eslint-plugin-claude

An ESLint 10 flat-config plugin, published to npm as `eslint-plugin-claude`, that lints Claude
Code configuration files. Rule IDs are `claude/<rule>`. The configs are `recommended` and
`strict`. Each rule keeps to the limits in [README Scope](README.md#scope) (ADR 001 Decisions 2
and 14):

- Its source is a page of the Claude Code docs.
- It reports a measurable fault. Style, quality and a model judgment are not faults.
- A convention of one organization is not a rule.
- It reads no file out of the git repository.

## Design

- `docs/adr/001-eslint-plugin-for-claude-config.md` records the decision and its scope.
- `docs/rules-inventory.md` lists the candidate rules, each with its group, preset, severity and
  docs source. A rule enters the plugin in its own pull request.
- A check that `claude plugin validate` covers fully is not a rule. A check that it covers in
  part is a rule, for the cases that it misses.
- `docs/adr/002-classify-docs-changes-with-jev.md` records the docs watch. A daily job finds each
  changed block of a page that a rule cites. It classifies the block and opens an issue. It posts
  a comment on a group issue for a tracked block. It opens a `moved` issue for a renamed section.
  It opens a digest for the uncited blocks of one page.
- `docs/rule-sources.json` maps each rule to its docs sources. `docs/docs-snapshot/` holds the
  hashes of the last docs text. Only a reviewed pull request changes them. The `docs-snapshot`
  check (`scripts/docs-verify.ts`) runs the docs watch on the base state in dry run. It fails a
  pull request that stores a change that no issue or group issue comment names. It also fails a
  snapshot that is not the live docs.
- `docs/runbooks/docs-watch-triage.md` tells how to resolve a docs watch issue.

## Code

- Source is TypeScript in `src/`, built by `tsc` to `dist/` (`.claude/rules/type-ts.md`). Tests
  are in `tests/`, and follow the `testing` skill. The `docs-watch-triage` skill decides a batch
  of docs watch issues.
- `CONTRIBUTING.md` has the commands, the hooks and the release flow. Run `pnpm lint`,
  `pnpm typecheck`, `pnpm test`, `pnpm knip` and `pnpm docs:check` before you push.
- A new rule needs footnotes in `docs/rules/<rule>.md` that link to its docs sources. The form
  is in `CONTRIBUTING.md` (Rule source map). Add the rule to a group in
  `.eslint-doc-generatorrc.mjs`. Then run `pnpm docs:generate`, then `pnpm docs:seed`, then
  `pnpm docs:update`. Commit `docs/rule-sources.json` and `docs/docs-snapshot/`. `docs:update`
  fetches the live docs and rewrites the snapshot of each cited page. If you skip the group or
  `docs:generate`, the `docs` check fails. If you skip `docs:seed` or `docs:update`,
  `tests/rule-sources.test.ts` fails.
- The scripts in `scripts/*.ts` run with `node` 22.18.0 or later. `.nvmrc` and `devEngines` pin 22.18.0.

## Fixtures

- Each rule has fixtures that show it reports when it must, and stays silent when it must not.
- Build fixtures from real cases. Rebuild the shape of the case. Do not copy specifics from
  private repositories.
- Fixtures are Claude Code files that break rules on purpose. Do not "fix" a fixture to follow
  the conventions that it tests.

## CI

The check names in `.github/workflows/ci.yml` and `codeql.yml` are a contract. The rulesets
"Require CI" and "Require CodeQL" require each name by exact string. A rename does not fail the
build: the required check never reports, and every pull request waits. Update the ruleset in the
same change. A new name, such as `docs-snapshot`, is the exception. A person adds it to the
ruleset after the merge that adds its job.

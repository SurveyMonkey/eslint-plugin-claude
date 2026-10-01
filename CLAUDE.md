# eslint-plugin-claude

An ESLint 10 flat-config plugin, published to npm as `eslint-plugin-claude`, that lints Claude
Code configuration files. Rule IDs are `claude/<rule>`. The configs are `recommended` and
`strict`. Rules that enforce the conventions of one organization are out of scope. The plugin
checks what a git repository holds: a rule reads no file out of the repository (ADR 001
Decision 14).

## Design

- `docs/adr/001-eslint-plugin-for-claude-config.md` records the decision and its scope.
- `docs/rules-inventory.md` lists the candidate rules, each with its group, preset, severity and
  docs source. A rule enters the plugin in its own pull request.
- A check that `claude plugin validate` covers fully is not a rule. A check that it covers in
  part is a rule, for the cases that it misses.
- `docs/adr/002-classify-docs-changes-with-jev.md` records the docs watch. A daily job finds a
  change to a docs block that a rule cites, classifies it, and opens an issue.
- `docs/rule-sources.json` maps each rule to its docs sources. `docs/docs-snapshot/` holds the
  last docs text. Only a reviewed pull request changes them.
- `docs/runbooks/docs-watch-triage.md` tells how to resolve a docs watch issue.

## Code

- Source is TypeScript in `src/`, built by `tsc` to `dist/` (`.claude/rules/type-ts.md`). Tests
  are in `tests/`, and follow the `testing` skill.
- `CONTRIBUTING.md` has the commands, the hooks and the release flow. Run `pnpm lint`,
  `pnpm typecheck`, `pnpm test` and `pnpm knip` before you push.
- A new rule needs footnotes in `docs/rules/<rule>.md` that link to its docs sources. The form
  is in `CONTRIBUTING.md` (Rule source map). Then run `pnpm docs:seed`, then `pnpm docs:update`.
  Commit `docs/rule-sources.json` and `docs/docs-snapshot/`. `docs:update` fetches the live docs
  and rewrites the snapshot of each cited page. If you skip a step, `tests/rule-sources.test.ts`
  fails.
- The scripts in `scripts/*.ts` run with `node`. Node 22.13 to 22.17 needs
  `--experimental-strip-types`.

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
same change.

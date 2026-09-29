# eslint-plugin-claude

An ESLint 10 flat-config plugin, published to npm as `eslint-plugin-claude`, that lints Claude
Code configuration files. Rule IDs are `claude/<rule>`. The configs are `recommended` and
`strict`. Rules that enforce the conventions of one organization are out of scope.

## Design

- `docs/adr/001-eslint-plugin-for-claude-config.md` records the decision and its scope.
- `docs/rules-inventory.md` lists the candidate rules, each with its group, preset, severity and
  docs source. A rule enters the plugin in its own pull request.
- A check that `claude plugin validate` covers fully is not a rule. A check that it covers in
  part is a rule, for the cases that it misses.

## Code

- Source is TypeScript in `src/`, built by `tsc` to `dist/`. Tests are in `tests/`
  (`.claude/rules/type-ts.md`).
- `CONTRIBUTING.md` has the commands, the hooks and the release flow. Run `pnpm lint`,
  `pnpm typecheck`, `pnpm test` and `pnpm knip` before you push.

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

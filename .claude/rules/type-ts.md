---
paths:
  - "src/**/*.ts"
  - "tests/**/*.ts"
  - "*.ts"
---

# TypeScript

## Language level

Erasable syntax only: no `enum`, no parameter properties, no namespaces. `erasableSyntaxOnly` in
`tsconfig.json` makes each of them a type error. Relative imports name the `.ts` extension, and
the build (`tsconfig.build.json`) rewrites it to `.js` in `dist/`.

## Tests

- A test lives under `tests/`, at the mirror of the code that it covers: `tests/rules/<rule>.test.ts`
  for `src/rules/<rule>.ts`. Fixtures go beside the tests that load them. Nothing test-only goes
  in `src/`, because `src/` builds into the published package.
- Each rule has fixtures that report and fixtures that stay silent. Test both sides.
- Assert the result that a rule gives, not how it gets there. No call-count or call-order
  assertions: they fail on a refactor that keeps the behavior.

## Coverage

`vitest.config.ts` sets 100 on lines, branches, functions and statements, and
`scripts/check-coverage.mjs` fails a report that names no file. The gate does not change to fit
the code. Do not lower a threshold, and do not exclude a file from coverage. If no test can reach
a branch, change the code so that the branch does not exist: move the decision into a function
that takes, as an argument, what the decision depends on.

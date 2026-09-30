---
paths:
  - "src/**/*.ts"
---

# TypeScript

`src/` is the shipped code. `tsc` (`tsconfig.build.json`) builds it to `dist/`, and npm
publishes `dist/` only.

- Erasable syntax only: no `enum`, parameter properties or namespaces. `erasableSyntaxOnly` makes
  each one a type error.
- Relative imports name the `.ts` extension. The build rewrites it to `.js`.
- Nothing test-only goes in `src/`.

Tests follow the `testing` skill.

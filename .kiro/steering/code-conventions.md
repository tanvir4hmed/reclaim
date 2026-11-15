---
inclusion: always
---

# Code conventions

## Layout

- `web/` is the Shop (Vite, React, TypeScript). `api/` is the Echo service (Fastify, Node's built-in `node:sqlite`). `e2e/` holds Playwright tests.
- Follow the folder plan in `.kiro/specs/reclaim/design.md` (core, director, shop, gl, products, fx).

## TypeScript

- Strict mode, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` (use `import type` for types).
- No `any`. Prefer discriminated unions for events and phases.
- `src/core` is pure: no DOM, timers, `Math.random`, `Date.now` or React. Time and randomness come in through events.

## React and 3D

- Function components and hooks only. Keep components small; one product per folder in `src/products/<id>/`.
- 3D code lives under `src/gl` and product `Model` components. Never create a new `<Canvas>` outside the two allowed ones (shop canvas, inspection canvas).
- Every interactive 3D thing gets a DOM hit proxy with an accessible name.
- Every animation has a reduced-motion version that keeps its meaning.

## Testing

- Unit and property tests sit in `web/tests` and next to API code as `*.test.ts`.
- Any change to `src/core` or the Director's pure parts must keep the property tests in `design.md` passing.
- Run `npm run typecheck`, `npm run lint` and `npm test` in the package you changed before finishing a task.

## Dependencies

- Pin exact versions (`--save-exact`). Add a dependency only when it removes real work, and note why in the commit message.
- Third-party assets (models, textures, fonts) go in `ASSETS.md` with source URL and license before they are committed.

## Privacy

- No analytics, trackers or third-party requests at runtime.
- The API never logs or stores IP addresses, user agents or identifiers.

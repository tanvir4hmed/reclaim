# Re:Claim

> *A Christmas shop that sells what the war left behind.*
> Kiroween 2026 submission, **Costume Contest** category.

Re:Claim opens as a cheerful Christmas shop, Reclaim & Co. Holiday Market. A small bat has got in. Catch it, and the same shop is revealed after a fictional war: every object belonged to someone, and every object answers back when you take it.

**Content note:** fictional war, blood stains, mild psychological horror, brief darkness effects. No flashing faster than three times per second. Reduced motion is supported.

_Status: in development. Features are added task by task from `.kiro/specs/reclaim/tasks.md`._

## Links

- Live app: _TBD_
- Demo video (YouTube): _TBD_
- Devpost: _TBD_

## Run it

### With Docker

```sh
docker compose up --build
```

Open http://localhost:8080. The Shop is served by nginx and `/api` goes to the Echo service.

### Without Docker

Requires Node.js 24 or newer (tested on 26 LTS).

```sh
cd api && npm install && npm run dev      # Echo service on :3000
cd web && npm install && npm run dev      # Shop on http://localhost:5173 (proxies /api)
```

## Tests

```sh
cd web && npm run typecheck && npm run lint && npm test   # unit and property tests
cd api && npm run typecheck && npm test
cd e2e && npm install && npx playwright install chromium && npm test   # end to end (desktop, phone, reduced motion)
```

## Project layout

| Path | What |
| --- | --- |
| `web/` | The Shop: Vite, React, TypeScript, three.js / React Three Fiber |
| `api/` | Echo service: Fastify with Node's built-in SQLite |
| `e2e/` | Playwright tests |
| `.kiro/` | Kiro specs, steering and hooks used to build this project |
| `docs/` | Rules notes, creative direction, Kiro usage log |

## How Kiro was used

See [docs/KIRO_USAGE.md](docs/KIRO_USAGE.md). The spec is in [.kiro/specs/reclaim](.kiro/specs/reclaim).

## Assets and licenses

All objects and effects are made in code. Third-party fonts and any models are listed in [ASSETS.md](ASSETS.md). All code in this repository was written during the Kiroween 2026 Submission Period (from Oct 30, 2026).

Rules summary and submission checklist: [docs/KIROWEEN_RULES.md](docs/KIROWEEN_RULES.md).

## License

[MIT](LICENSE)

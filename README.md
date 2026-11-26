# Re:Claim

> *A Christmas shop that sells what the war left behind.*
> Kiroween 2026 submission, **Costume Contest** category.

Re:Claim opens as a cheerful Christmas shop, Reclaim & Co. Holiday Market. A small bat has got in. Catch it, and the same shop is revealed after a fictional war: every object belonged to someone, and every object answers back when you take it.

**Content note:** fictional war, blood stains, mild psychological horror, brief darkness effects. No flashing faster than three times per second. Reduced motion is supported.

## What works now

- **The Day shop:** search, categories, price filter, sort, grid and list view (all kept in the URL), product view with a turnable live object, cart drawer, and a checkout whose payments are "paused for the holiday rush".
- **Live objects:** all 24 products are real-time 3D, built in code. The same objects burn, tear, rot, dust and age in place through one shared decay shader when the shop turns.
- **The Day bat:** it hangs from the decorations and flies between perches. Over it the cursor becomes a reaching hand and the lights flicker like lightning. Catch it (click, Enter, or two taps) and it jerks round, lunges, covers the screen with its wings, and the shop turns in the dark.
- **The haunted shop:** palette, copy, menu and logo change. Bats fly only in darkness, with glowing eyes. Brownouts and blackouts come and go. A severed hand crawls up once. A pumpkin-headed scarecrow creaks in the wind in the hero, a werewolf howls on a far tower, and in the graveyard under the shelves one skeleton drags another out of its grave while a third crawls past.
- **Consequences:**
  - shoes leave a walking trail to the cart
  - the watch and the shop clock run backward
  - the doll's eyes turn to the photo
  - the letter's "Sorry." stains and the envelope is readdressed
  - the typewriter types tomorrow's confession, key by key
  - a face rises in the mirror
  - the photo makes room for one more
  - the cart rings and you can answer it
  - the other products have their own, in their own picture: a camera that turns to you and prints, an hourglass whose sand runs back up, a reindeer that turns its skull to you, a lamp that lets out a ghost, a jack-in-the-box, a hungry nutcracker, doors slamming
- **Closing time, checkout and the ending:** dust sheets, eyes, the sheet ghost, and a payment of time, age or a memory. One tremor, "Your order has been accepted.", and the opening shop returns with what you left behind. A receipt then lists the dark patterns the shop used.
- **Echo service:** the next visitor sees what the previous player left, with no identifiers stored.

## Status

Built and verified so far:

- 60 web unit and property tests
- 7 API tests
- 25 end-to-end tests on desktop, a 390 px phone and reduced motion
- `docker compose up` checked by hand

Still open (tracked in `.kiro/specs/reclaim/tasks.md`):

- the storage descent behind "Load more"
- "Leave her here?" when removing a sneaked item
- account and order history
- scorch marks where the pointer lingered
- objects moving while unwatched (only the truffle box does it so far)
- haunted inspections for products other than the watch
- Tier B products
- the postcard and the director panel (`?director` only speeds up timers)
- a measured performance pass
- sound
- public hosting
- the demo video

**Fallback:** without WebGL2, or with `?nogl`, the cards show the product name on velvet instead of a live object. Pre-rendered stills are not built yet.

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

## Deploy

Pushes to `main` are tested and deployed to EC2 by GitHub Actions through AWS Systems Manager. Setup and the GitHub variables are in [deploy/README.md](deploy/README.md).

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

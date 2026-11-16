# Implementation Plan

Status 2026-11-16: [x] done and verified, [-] partly done (see notes in README "Status"), [ ] not started.

Build order follows `docs/CREATIVE_DIRECTION.md` section 7. Each task is small enough to finish and verify on its own. Tasks marked `*` are optional and done only if time allows.

- [x] 1. Project setup
  - [x] 1.1 Scaffold `web/` (Vite, React, TypeScript strict, ESLint, Prettier) and `api/` (Fastify, TypeScript), with pinned versions
    - Add `code-conventions.md` steering file
    - _Requirements: 30.1_
  - [x] 1.2 Test tooling: Vitest + fast-check in `web/` and `api/`, Playwright in `e2e/` (desktop and 390 px phone projects, reduced-motion project)
    - _Requirements: 30.3, 30.4_
  - [x] 1.3 Docker: `web` (build, then nginx on 8080 proxying `/api`), `api` (Fastify on 3000, SQLite volume), `docker-compose.yml`; README run instructions
    - Verified 2026-11-16: `docker compose up --build` serves the Shop on :8080, `/api/health`, echo POST/GET, 400 on a bad product, SPA deep link 200
    - _Requirements: 30.1, 30.2_
  - [x] 1.4 Create `ASSETS.md`; self-host two OFL fonts (serif display, sans UI) and record them
    - _Requirements: 28.2_

- [x] 2. State core
  - [x] 2.1 Types, initial state, reducer for phase, cart, Weight, act, marks, clock, extras, echo, settings
    - _Requirements: 6, 10.2, 12.3, 12.4, 22.4, 23.1, 37_
  - [x] 2.2 Persistence to `localStorage` (`reclaim:v1`) with version check
    - _Requirements: 6.3, 10.5, 12.3_
  - [x] 2.3 Property tests for the reducer invariants listed in design (cart unchanged by Reveal, only `BAT_CAUGHT` leaves day, monotonic Weight/act, consequence once, agreement, reset, persistence round trip)
    - The cart-total property moves to task 3.3, where prices exist
    - _Requirements: 30.4_

- [x] 3. Day storefront (DOM only, placeholder boxes where objects go)
  - [x] 3.1 Design tokens for both palettes, typography, contrast test on tokens
    - _Requirements: 1.2, 26.6_
  - [x] 3.2 Layout: header (logo, nav, search, account, cart badge), hero frame, category tiles, filter sidebar and drawer under 900 px, grid/list, footer, sale countdown clock
    - _Requirements: 1.1, 1.3, 1.4, 1.6_
  - [x] 3.3 Catalog data for all products (both states' names, copy, prices, categories, ratings)
    - _Requirements: 1.5, 2_
  - [x] 3.4 Search, category filters, price range, sort, URL sync
    - _Requirements: 3, 4_
  - [x] 3.5 Product view as a modal route (Back closes it), cart drawer, Day checkout with paused payments, pre-checked gift wrap
    - _Requirements: 5.1, 5.5, 5.6, 6, 22.1, 22.6_
  - [x] 3.6 e2e: normal shopping flow on desktop and phone, keyboard only
    - _Requirements: 26.1, 30.3_

- [-] 4. Live object pipeline and the quality gate
  - [x] 4.1 Shared shop canvas with one drei `View` per card image box, demand frame loop, viewport culling, DPR cap
    - _Requirements: 27.1, 27.2, 27.4, 31.1_
  - [x] 4.2 Code-generated lighting (RoomEnvironment), velvet backdrop, contact shadows; Day and Haunted light rigs
    - _Requirements: 31.1, 31.4_
  - [x] 4.3 Decay material chunk (`uBurn`, `uTear`, `uRot`, `uDust`, `uAge`) on `MeshPhysicalMaterial`
    - _Requirements: 31.2_
  - [x] 4.4 Pocket watch end to end: procedural model, Day and Haunted decay, idle quirk, lazy inspection canvas with post-processing, case opening
    - _Requirements: 14, 5.2, 5.3, 5.4_
  - [x] 4.5 **Quality gate:** screenshots of the watch in both states and the inspection; Tanvir approves before 4.6
    - _Requirements: 31.5_
  - [-] 4.6 Still-render fallback: Playwright script that captures every product view in both states; WebGL2 and frame-time detection
    - _Requirements: 27.5, 31.6_

- [x] 5. Director
  - [x] 5.1 Clock with time scale and tab-hidden pause; Stage scheduler with major/minor/quirk rules and quiet gaps
    - _Requirements: 12.3a, 12.3b, 27.4, 35.4_
  - [x] 5.2 Light and power: `mains`, flames, Brownout, Blackout, Storm flicker, darkness overlay, flash limiter
    - _Requirements: 9.4, 26.5, 34_
  - [x] 5.3 Attention model (pointer radius, viewport, visibility, focus, idle)
    - _Requirements: 36_
  - [x] 5.4 Property tests: flash limiter, Stage scheduler
    - _Requirements: 30.4_

- [x] 6. Day bat, catch and Reveal
  - [x] 6.1 Bat model with wing animation; Perches across the page; flight between perches; DOM hit proxy following its screen position
    - _Requirements: 8_
  - [x] 6.2 Hand cursor over the bat only; hover signs building with time; Storm flicker; settle on leave
    - _Requirements: 9.1–9.5_
  - [x] 6.3 Catch: hand closes, head jerk, lunge, wings fill the viewport, events in the dark, Reveal behind it, wings pull away
    - _Requirements: 9.6–9.10, 10_
  - [x] 6.4 Haunted palette, haunted copy, logo mark, haunted hero scene in the same frame
    - _Requirements: 2.3, 10.3, 10.4_
  - [x] 6.5 Keyboard catch, two-tap catch on touch, reduced-motion versions
    - _Requirements: 8.7, 8.8, 9.11–9.13_
  - [x] 6.6 Early signs in the Day state (bulb, tilted frame, moving shadow)
    - _Requirements: 7_
  - [x] 6.7 e2e: bat hover, catch, Reveal keeps cart, scroll and focus
    - _Requirements: 30.3_

- [x] 7. Featured products (each: model, Day and Haunted decay, quirk, haunted inspection, Consequence, Lasting mark, e2e check)
  - [x] 7.1 Consequence framework: cue context helpers (card and cart rectangles, decal layer, creature layer, clock, light), `MARK_ADDED` on finish
    - _Requirements: 12_
  - [x] 7.2 Shoes: footprint path generator (alternating feet, left and right turns, ends at cart), fading prints, last pair kept; property test for the path
    - _Requirements: 13_
  - [x] 7.3 Pocket watch consequence: stop, shudder, run backward; shop clock reverses
    - _Requirements: 14.3, 14.4_
  - [x] 7.4 Letter: opens on hover, tap, keyboard; bloodstain on "Sorry."; recipient change
    - _Requirements: 16_
  - [x] 7.5 Photo frame: the gap, people leaning toward it, shifting aside for one more, hero copy in sync, tilt sign
    - _Requirements: 19, 7.1_
  - [x] 7.6 Doll: damage and unstitching; eyes turn toward the gap in any visible photo
    - _Requirements: 15_
  - [x] 7.7 Mirror: back-turned figure, delayed reflection, head turn in dips, face rising from the glass; faint face in reflective surfaces
    - _Requirements: 18_
  - [x] 7.8 Typewriter: keys press and spring back in sync with letters, carriage return, confession dated tomorrow, last line describes the visitor's action
    - _Requirements: 17_
  - [x] 7.9 Cake: collapse, rot, nonhuman bite, fly; fly leaves the tile and settles on the UI, dodging the pointer
    - _Requirements: 20_
  - [x] 7.10 Telephone: rattling ring, trembling price tags, cart rings with Answer, subtitles, ring again on next cart open
    - _Requirements: 21_

- [-] 8. Haunted life
  - [x] 8.1 Haunted bats: fly only in darkness, glowing eyes, banner to grid, hanging from card edges, taking off when the pointer reaches controls
    - _Requirements: 11.1–11.3_
  - [x] 8.2 Severed hand: rising finger by finger, gripping, pulling toward the grid; prints and drag marks in page space; later the ornament retrieval
    - _Requirements: 11.3a–11.3c_
  - [-] 8.3 Parallax, delayed reflections, shapes in negative space
    - _Requirements: 11.4_
  - [-] 8.4 Quirks for every product
    - _Requirements: 35_
  - [-] 8.5 Things move when unwatched
    - _Requirements: 36_
  - [x] 8.6 Ghostly events behind the open product view
    - _Requirements: 5.7, 5.8_

- [-] 9. Acts, navigation and design decay
  - [x] 9.1 Weight and acts driving Director dials
    - _Requirements: 37_
  - [-] 9.2 Renamed menu, growing breadcrumbs, "Recently viewed" that lies, "Previous owners", reviews dated tomorrow, "1 person is standing behind you"
    - _Requirements: 40_
  - [-] 9.3 Sneak into basket with "Leave her here?"; account and order history; typing support chat with preset replies
    - _Requirements: 40_
  - [ ] 9.4 Storage descent behind "Load more"
    - _Requirements: 40_
  - [-] 9.5 Hidden text on selection; scorch marks where the pointer lingered; drifting letters; too-perfect day shop details
    - _Requirements: 40_

- [x] 10. Checkout, climax and ending
  - [x] 10.1 Closing time master timeline: power fails, eyes, dust sheets (vertex cloth), turning, sheet ghost, after; Skip and Escape
    - _Requirements: 38_
  - [x] 10.2 Haunted checkout: time, age or preset memory; agreement box and Accept; confirmshaming decline that still works
    - _Requirements: 22_
  - [x] 10.3 Accept: tremor, silence, "Your order has been accepted.", return to the opening shop with the Echo in the hero and the Day bat perched on it
    - _Requirements: 22.7, 22.8, 23_
  - [x] 10.4 Echo service: GET and POST, allowlists, SQLite, rate limit without stored identifiers, 1.5 s client timeout and local fallback; API tests
    - _Requirements: 24_
  - [x] 10.5 Receipt of dark patterns after the ending
    - _Requirements: 25_
  - [x] 10.6 e2e: checkout decline and accept, ending, Echo with API up and down
    - _Requirements: 30.3_

- [-] 11. More anomalies and products
  - [-] 11.1 Requirement 32 anomalies: snow globe, chocolate box, music box, wishlist heart, glass ornament, candle, teddy bear, haunted search, tab away, exit intent
    - _Requirements: 32_
  - [x] 11.2 Tier A products: advent calendar, tin soldier, valve radio, instant camera, unopened gift, mittens
    - _Requirements: 39_
  - [ ]* 11.3 Tier B products: house key, gingerbread house, stockings
    - _Requirements: 39_
  - [-] 11.4 Postcard and `?director` panel
    - _Requirements: 33_

- [-] 12. Polish, verification and submission
  - [-] 12.1 Accessibility pass: keyboard, screen reader names, focus, live region, reduced motion, contrast
    - _Requirements: 26_
  - [ ] 12.2 Performance pass on a mid-range phone and laptop; initial JS ≤ 250 KB gzipped
    - _Requirements: 27_
  - [ ]* 12.3 Sound (opt-in, code-generated)
    - _Requirements: 29_
  - [x] 12.4 README (what it is, content note, run with and without Docker, tests, assets), final `ASSETS.md`
    - _Requirements: 28, 30.2_
  - [ ] 12.5 Deploy to always-on hosting; uptime check until Jan 29, 2027
    - _Requirements: 24, 30.1_
  - [ ] 12.6 Kiro write-up from `docs/KIRO_USAGE.md`, demo video under 3 minutes, Devpost submission before Dec 4, 2:00 PM PT
    - _Requirements: 30.5_

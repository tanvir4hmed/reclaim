# How Kiro was used

Running log for the required "How Kiro was used" write-up. Add an entry whenever a Kiro feature makes a real difference: what we did, why, and the result. Concrete examples and numbers beat general praise.

## Kiro apps (IDE / CLI / Web / Crew)

- 2026-11-15: Project set up in Kiro IDE. Research of the hackathon rules and past winners done through the agent chat.

## Spec-driven development

- 2026-11-15: `.kiro/specs/reclaim/requirements.md` drafted by the Kiro IDE agent from Tanvir's written plan, a mockup board and follow-up chat decisions. 30 requirements with EARS-style acceptance criteria.
- Decisions changed during requirements, before any code: the offer notification trigger was replaced by a hiding cloth Ghost (Tanvir's idea, to fix the risk that judges miss a self-expiring notification); hover on the Ghost causes a storm flicker. Agent added a WCAG 2.3.1 flash limit to that effect, a touch two-tap rule and keyboard access. Sound moved to the last phase.
- 2026-11-15 (revision 3): Tanvir replaced the hiding ghost with a Day bat that flies around the shop. The cursor becomes a reaching hand only over the bat; hover brings lightning and warning signs; clicking catches the bat, which jerks its head around, lunges and covers the screen with its wings while the Reveal happens in the dark. The Kiro-style sheet ghost moved to the climax. Product views now show ghostly events in the shop behind them. The agent rewrote Requirements 8–9 and replaced every Ghost reference across the spec with a script, then checked that none were left.
- 2026-11-15 (revision 2): story/psychology section added to the spec; the Ghost became an original homage to Kiro's ghost mascot (agent flagged that embedding the official logo may conflict with Rules section 11); photos replaced by real-time 3D "live objects" (Req 31); a one-Anomaly-at-a-time "Stage" rule added for pacing; new consequences for shoes, watch, mirror, typewriter, telephone, photo, bats and a crawling severed hand; ten more anomalies (Req 32) and a postcard + director mode (Req 33).

- 2026-11-15: `.kiro/specs/reclaim/design.md` written by the Kiro IDE agent from the approved requirements. It defines the layer stack (DOM, decals, darkness overlay, shared WebGL canvas, hit proxies, overlays, inspection canvas), a pure reducer as the testable story core, a Director for Stage/light/attention/acts, a shared decay shader for in-place damage, and a property-based test plan mapped to requirement numbers. While designing, the agent found that one WebGL context cannot sit both under the product view's blur and above it, and changed Requirement 27.2 to allow a second context only during inspection.

## Steering docs

- `.kiro/steering/hackathon-rules.md` (always included): keeps every change inside the Kiroween 2026 rules and the Costume Contest goals.
- `.kiro/steering/design-direction.md` (always included): palettes, composition cues from the mockup, and craft rules (every effect needs a reason, reduced-motion alternatives).

- 2026-11-15: `.kiro/specs/reclaim/tasks.md` written: 12 groups, 79 tasks, each linked to requirement numbers, with a quality gate (task 4.5) where Tanvir approves the first live object before the pipeline is used for the rest.
- 2026-11-15, task 1 (setup): before installing anything, the agent searched the web and found that Node 20 on the dev machine had reached end of life on 2026-04-30; Tanvir upgraded to Node 26 LTS. During the API install, npm 11 blocked `better-sqlite3`'s native install script. Instead of approving a native build, the agent switched the Echo service to Node's built-in `node:sqlite`, which also removes a native build from the Docker image. The agent also turned off Fastify's default request logs because they include client IP addresses (Requirement 24.4).

## MCP

_(server, what it enabled that would otherwise be hard)_

## Property-based testing

_(which requirements, what it caught)_

- 2026-11-15, task 2.3: the first version of the property tests passed, which looked fine. The agent added a coverage test that samples the event generator and counts how many runs reach each story phase. It showed only 55 of 1000 random runs ever reached the Haunted state, so the properties about checkout, acceptance and the ending were almost never exercised. The generator was rewritten to mix random events with scripted visitor actions (catch the bat, buy a few items, go through checkout). With that change, the coverage test enforces minimum counts, and all properties still hold. Lesson for the write-up: a green property test is not evidence on its own; measure what the generator reaches.

- 2026-11-15, task 3: the persistence round-trip property failed once on a random seed: a Lasting mark with rotation `-0` came back from JSON as `0`, so the loaded state was not equal to the saved one. A unit test would never have tried `-0`. The agent wrote two regression tests, confirmed they fail without the fix, then made the reducer normalize `-0` and reject non-finite mark coordinates. The new contrast test on the design tokens also failed for the haunted button outline (1.6:1 against cards); a dedicated outline colour was added so both palettes pass WCAG AA.

- 2026-11-16, tasks 3–12 (single long agent session in Kiro IDE, Tanvir granted blanket execution permission). Findings that changed the code:
  - **Quality gate by screenshot:** the agent drove Playwright to screenshot the Day shop, the product view and the haunted grid, then looked at the images itself. That showed the pocket watch rendering well, and the doll dress washing out pink, the shoes too flat and the typewriter over-dusted. Materials and framing were tuned from the screenshots.
  - **WebGL context limits found while designing:** native `<dialog>` lives in the browser's top layer, so no canvas can paint above it. The inspection therefore uses its own canvas, and environment maps are set per scene, because a PMREM texture cannot be shared across WebGL contexts.
  - **The API allowlist property test failed:** Fastify's default JSON validation silently strips unknown fields and accepts the request. AJV was set to reject them.
  - **e2e found three real bugs:**
    1. A second quick Add to Cart lost its Consequence, because the Stage refused it. Visitor Consequences now queue.
    2. Fast typing followed by Escape raced async router navigations. The shop query moved to a synchronous store mirrored with `replaceState`.
    3. A quick second tap on the bat read stale React state. The tap handler now reads the store.
  - **React Compiler lint rules (react-hooks 7):** they flagged refs written during render, setState in effects, `Math.random` in render and hook-value mutation. Each was refactored rather than silenced.

- 2026-11-21, realism and feedback round (Kiro IDE agent, same blanket permission). Tanvir reviewed the build and asked for realistic objects, a scarier bat, a skeleton-hand cursor, clear cart confirmation and stock limits, a single fast checkout ghost and a shadow lady in the mirror. What the agent did and found:
  - **Code-only realism:** generated surface textures (wood grain, leather, knit, fur, paper, metal, ceramic, wax) feed the shared material factory, and the hero became a live 3D still life. After the Reveal a procedural ruined street (seeded skyline with window holes, a moon, a fire glow) stands behind it. No photos or third-party models.
  - **Screenshot review caught layout bugs:** the first ruined skyline ran behind the hero copy and made the subtitle unreadable, because the shared canvas paints over the DOM. The skyline now starts right of the copy. When the hanging bat was flipped, its legs read as rabbit ears; the wings were redrawn to wrap the body. A haunted bat hung over a category title; tiles now use corner perches.
  - **Flaky e2e diagnosed instead of retried:** catches failed only in full runs. A probe test showed the Reveal completes in about 2.5 s on its own; with two parallel workers, software WebGL starved the timers. The suite now runs one worker, and if the Reveal ever stalls, the failure message reports the lunge step and saved phase.
  - **New e2e coverage:** the "Added to your cart" toast, and the "greedy" refusal past the stock limit, by day and after the Reveal.
  - **Sub-agents:** while the agent's shell was busy with a long Playwright run, it delegated polling of the log and screenshot files to a sub-agent limited to file reads.
- 2026-11-22, second feedback round from Tanvir's reference images (bat in flight and hanging, a haunted hero, a found-footage scare). The agent redrew the bat (torn red-lit wings, wrapped-wing cocoon, head that turns to follow the pointer with burning eyes), painted the haunted hero's ruined world on a canvas in code (red moon, smoke, gothic ruins, Ferris wheel, rubble, embers, an XMAS → HALLOWEEN sign), added idle haunted life to every product, a jack-o'-lantern beside the bear, inline cart confirmations instead of a popup, and the jump scare after Accept. Screenshot review drove fixes the agent would not have caught from code: the pumpkin's carved face was buried under the rind's ribs, its spill light washed the rind out, and the scare's hair strands read as prison bars.

## Agent hooks

- `.kiro/hooks/core-property-tests.json` (PostFileSave on `web/src/core` and the Director's pure modules): runs the core and Director property tests on save.
- `.kiro/hooks/assets-license-guard.json` (PostFileCreate under `web/public`): reminds the agent to add source and license to `ASSETS.md` before committing.
- `.kiro/hooks/kiro-usage-log.json` (PostTaskExec): prompts a log entry here after each spec task.
- These were created on 2026-11-16 and take effect from the next session. They have not run yet at the time of writing.

## Kiro powers

_(which powers, what they added)_

## Custom agents

_(agent, which Kiro app, impact)_

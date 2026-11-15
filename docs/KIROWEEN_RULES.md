# Kiroween 2026: rules and submission notes

Sources (read 2026-11-15):

- Overview: https://kiroween.devpost.com/
- Official Rules summary (AWS Japan blog, translated from the official English pages as of 2026-10-31): https://aws.amazon.com/jp/blogs/news/kiroween-2026/
- Kiroween 2025 gallery (past winners): https://kiroween-2025.devpost.com/project-gallery

- Official Rules full text (pasted by Tanvir on 2026-11-15 from https://kiroween.devpost.com/rules)

Resources, FAQ, Updates and Discussions tabs were not readable by the agent (HTTP 403). If the Official Rules conflict with anything else (website, form, these notes), the Official Rules win. Rules can be amended; recheck the Rules page before submitting.

## Key dates (Pacific Time → Bangladesh time, UTC+6)

| Event | PT | BST |
| --- | --- | --- |
| Submission Period opens | Oct 30, 2026 09:00 | Oct 30, 2026 22:00 |
| Free Kiro credit request deadline | Dec 1, 2026 12:00 | Dec 2, 2026 02:00 |
| **Submission deadline** | **Dec 4, 2026 14:00** | **Dec 5, 2026 04:00** |
| Judging | Dec 16, 2026 – Jan 29, 2027 | |
| Winners announced | ~Feb 3, 2027 09:00 | ~Feb 3, 2027 23:00 |

No extensions. Submissions cannot be edited after the deadline.

## Eligibility

- Above the age of majority in your country. Bangladesh is not on the excluded list.
- Solo, team of up to 3, or an organization. One person submits for the team.
- Project must be **new**: started on or after Oct 30, 2026. Kiroween 2025 projects are not eligible.
- Frameworks, libraries and starter templates are fine. Other pre-existing code must be disclosed.
- Judges can disqualify a project if Kiro usage is insufficient.
- Some Kiro features or models may be unavailable in some regions; checking is the entrant's responsibility.
- The project must not be built with funding, a contract or a commercial license from AWS or Devpost.
- Multiple submissions are allowed only if each is substantially different.

## Project rules from the Official Rules (section 4)

- **Functionality:** must install and run consistently on its intended platform, and work as shown in the video and description.
- **Third-party SDKs, APIs, data:** we must be authorized to use them under their terms and licenses.
- **Ownership and IP:** original work, solely owned by us, not infringing anyone's copyright, trademark, patent, contract or privacy rights. Paid technical help is allowed if the work and ideas remain ours. Open source use is fine if we follow its license and build on top of it.
- **Testing access:** the working app must be free to use with no restriction for the Sponsor, Devpost and Judges **until the Judging Period ends (Jan 29, 2027)**. Keep the deployment live until then. Private apps need credentials in the private form field.
- Judges may skip testing and score only from the description, images and video. The video and screenshots must carry the project on their own.
- Non-standard hardware may need physical access on request. Desktop, phone or tablet apps avoid this.
- No viruses, spyware or other malicious code in the submission.
- **After the deadline:** no changes to the submission, except removals Devpost allows (infringing material, personal data). Save drafts early.

## Category: Costume Contest

> Build any app but show us a haunting user interface that's polished and unforgettable. Bring in spooky design elements that enhance your app's function.

One category per project. A project can win one Overall Prize **or** one Category Prize, plus any number of Bonus Prizes.

## Required submission items

- [ ] Category selected: **Costume Contest** (plus any Bonus Prizes)
- [ ] Public **GitHub** repo URL (GitLab/Bitbucket not allowed)
  - [ ] All source code, assets and instructions needed to run the app
  - [ ] Open source license file, detected and shown in the repo **About** section (this repo: MIT)
  - [ ] `/.kiro` directory at the repo root with specs, hooks and steering
  - [ ] `/.kiro` is **not** in `.gitignore`
- [ ] URL to the working app (deployed). Test login credentials go in the private Devpost form field, not in the repo.
- [ ] Text description of features and functionality
- [ ] Demo video
  - [ ] Under 3 minutes
  - [ ] Shows the app working on the device it was built for
  - [ ] Public on YouTube
  - [ ] No third-party trademarks, copyrighted music or other copyrighted material without permission
- [ ] Write-up on how Kiro was used (see `docs/KIRO_USAGE.md`)
- [ ] Everything in English (or with English translations of video, description and test instructions)

## Judging

Judging may use expert panels, peer review and automated AI-driven analysis.
Stage 1 is pass/fail: fits the theme and uses Kiro.
Stage 2 scores five equally weighted criteria, each out of 10 (20%). Ties are re-scored from scratch on a 20-point scale per criterion.

| Criterion | What judges look for |
| --- | --- |
| Potential Impact | Real problem, real audience, demo proves it, useful, intuitive, accessible |
| Technological Implementation | Depth and variety of Kiro usage, a deliberate AI development strategy, experimentation |
| Design | A complete, coherent product, not a proof of concept; intuitive, polished, intentional |
| Innovation/Idea | Novel concept; unusual technologies or public datasets combined in a new way |
| Presentation | Video shows it end-to-end; clear problem / audience / why; easy to follow; memorable |

## Kiro features the write-up should cover

IDE / CLI / Web / Crew (and how they differed), custom agents, agent hooks, spec-driven development (vs vibe coding), steering docs, MCP, property-based testing (PBT), Kiro powers.

## Bonus prizes worth considering

| Prize | Reward | What it takes |
| --- | --- | --- |
| Best Student Project: Costume Contest | $1,500 + 1-yr Kiro Pro Max | All members are students; LinkedIn, student email, year/degree, school |
| Best Demo | $1,000 | Automatic: highest Presentation score among the top 10% |
| Bonus Blog Prize | 2,000 Kiro credits (100 winners) | Public post on a third-party blog during the Submission Period, stating it was written for Kiroween 2026 |
| Social Blitz Prize | 3-month Kiro Pro+ (5 winners) | Post must **begin** with `#KiroweenHackathon26`: favorite thing about Kiro and how it changed your approach. Judged on original (not AI-written) thoughts, insights and image/video quality. Social profile must match submission details |
| Best Kiro Crew App | $1,000 | A newly built Kiro Crew app repo + description; same GitHub account as the main submission; picked from the top 50 by usefulness and innovation |
| Best Startup Project | $10,000 | Founder; LinkedIn + startup website |
| Best Ghost of Kiroween Past | $2,000 | Registered for Kiroween 2025 |

## Free Kiro credits

Each entrant (each team member, individually) can request a one-time 4,000 credits through the Credit Request Form on the Resources tab, by Dec 1, 2026 12:00 PT. You need the correct Kiro user ID (or AWS account ID); a wrong ID may be rejected. Allow 48 business hours. Codes must be redeemed by Dec 4 and redeemed credits expire Dec 31, 2026 23:59 PT. No extra credits beyond this.

Redeeming the code (from the FAQ):

1. Have a Kiro account and be logged in before opening the redemption URL.
2. Open the URL and look for "Kiroupon successfully redeemed!".
3. If you see an error, it often worked anyway: log out, wait a few minutes, log back in.
4. Check https://kiro.dev/account/usage. Credits show up within 1–2 minutes.

## FAQ points (from the Overview/FAQ, pasted 2026-11-15)

- Kiro is mandatory, and the `/.kiro` directory must be at the repo root.
- One category per project only (ours: Costume Contest), plus any bonus prizes we qualify for.
- Open source libraries and code are fine if we follow their licenses and build on top of them.
- A working app URL is required. Test credentials go in the judges-only form field.
- Status: Tanvir is registered for Kiroween 2026 on Devpost.
- Optional to-dos from the Devpost dashboard: join the Discord, read the Kiro docs and guides, the "Build a game with Kiro in 30 minutes" session.

## Prizes: payment notes

- Team prizes go to the Representative, who splits them.
- Winners must return an affidavit and tax forms within 10 business days. Non-US residents (Bangladesh) fill out **W-8BEN**. Missing forms means losing the prize.
- Winners pay wire and currency fees and their own local taxes; tax may be withheld.
- By entering, you let AWS and Devpost use the submission, your name and likeness for promotion for 3 years.

## Help

- Kiro Discord `#kiroween-hackathon`: https://discord.gg/kirodotdev (biweekly office hours, Mondays 09:30 PT)
- Hackathon manager: sara@devpost.com

## Lessons from Kiroween 2025 UI-focused winners

**Seance**, Best Costume Contest 2025 (https://devpost.com/software/seance). An educational folklore app: world map → choose a country → answer quiz questions in a page-flipping book. Wrong answer flips you back to the start. Next.js + React + Three.js smoke, react-pageflip, ambient sound. The write-up covered specs (EARS-style requirements), a README hook, and a steering rule that limits unrequested edits.

**SpookBnB**, 3rd Overall 2025 (https://devpost.com/software/spookbnb-when-dark-mode-gets-truly-dark). Entered as Costume Contest. A normal-looking rental site whose dark-mode toggle turns it into a flashlight-cursor horror escape room with four puzzle fragments. Next.js, Tailwind, Framer Motion. Specs + three steering files + on-save hooks.

Patterns that worked:

- The spooky effect **is** the mechanic (flashlight reveals content, wrong answers flip the book back), not a skin over a normal app.
- One strong, simple concept you can explain in a sentence.
- Sound design plus visual effects, with graceful handling of autoplay limits and WebGL fallback.
- A real use underneath (learning, booking), so Potential Impact scores too.
- Detailed write-up of specs, hooks and steering with concrete examples.

Things 2026 scores harder than 2025: Presentation and Innovation are now separate 20% criteria, so the video matters as much as the code.

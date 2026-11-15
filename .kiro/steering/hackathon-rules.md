---
inclusion: always
---

# Kiroween 2026 compliance rules

This repository is a Kiroween 2026 submission in the **Costume Contest** category.
Every change must keep the project eligible. Full notes: `docs/KIROWEEN_RULES.md`.

## Hard rules (breaking these can disqualify the project)

- Never add `.kiro/` or any sub-folder of it to `.gitignore`. Specs, hooks and steering must be committed.
- Keep the `LICENSE` file (MIT) at the repo root so GitHub detects it in the About section.
- All new code must be written during the Submission Period (Oct 30 – Dec 4, 2026). Do not copy in code from older projects. Frameworks, libraries and starter templates are allowed; any other pre-existing code must be disclosed in the README.
- The repo must contain everything needed to run the app: source, assets, and setup instructions in the README.
- Do not commit secrets. Use environment variables and keep an `.env.example` with placeholder values.
- Only use assets (images, fonts, sounds, music) that we made ourselves or that have a license allowing reuse. Record each third-party asset and its license in `ASSETS.md`. No third-party trademarks or copyrighted music.
- All user-facing text, docs and the submission must be in English.

## Costume Contest focus

- The category is defined by the UI: it must be polished, haunting and memorable. All five judging criteria still weigh 20% each.
- Spooky design must support the app's function, not just decorate it. Each effect should have a reason.
- The app must still solve a real problem for a real audience (Potential Impact is 20% of the score).
- Keep it accessible: keyboard navigation, readable contrast for core text, a way to mute audio, and `prefers-reduced-motion` support for heavy animation.
- Handle browser audio autoplay limits with an explicit user action to enable sound.

## Working habits

- Log notable Kiro usage (specs, hooks, steering, MCP, powers, PBT, agents) in `docs/KIRO_USAGE.md` as it happens. This feeds the required write-up.

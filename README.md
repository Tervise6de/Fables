# FINAL FORM — You Are The Boss Fight

> A reverse boss-fight roguelite. Every game made you kill the final boss.
> This one lets you **be** the final boss.

Waves of heroes raid your lair. You are the raid boss: dodge their attacks,
unleash bullet-hell patterns of your own, and evolve into a new **Form**
after every wave you survive. How many hero parties can you wipe before
they finally roll credits on *you*?

**Status:** in development — see [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md)
and [`docs/DEV_PLAN.md`](docs/DEV_PLAN.md).

## Tech

- HTML5 Canvas + vanilla JavaScript (ES modules), no runtime dependencies
- Procedural art (occult-synthwave neon) and procedural WebAudio sound —
  zero licensed assets
- Ships to Steam via an Electron wrapper (the same path Vampire Survivors used),
  with Steamworks integration points prepared

## Run locally

```sh
# any static file server works:
npx serve web
# then open http://localhost:3000
```

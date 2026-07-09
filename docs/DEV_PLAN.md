# FINAL FORM — Development Sprint Plan

Sprint start: **2026-07-10 00:47 UTC** (5 hours after planning session, as
instructed). Budget: ~5 hours of focused build → polish → bugfix → report.

## Architecture

```
web/
  index.html          entry point (canvas + module bootstrap)
  src/
    main.js           game bootstrap, fixed-timestep loop, scene stack
    scenes/           title, run, mutation-pick, pause, death
    core/             input, camera/shake, rng, save, math utils
    render/           draw helpers, particles, glow/trail effects, ui widgets
    audio/            procedural WebAudio synth (sfx + adaptive drone music)
    game/
      boss.js         player boss: movement, hp/phases, slam, ultimate
      forms.js        Form definitions (patterns, visuals, evolution tree)
      heroes/         archetype AI (knight, rogue, archer, mage, healer)
      waves.js        party composition & difficulty curve
      mutations.js    upgrade pool + stacking effects
      bullets.js      projectile pools (boss + hero), collision
desktop/              Electron wrapper + steamworks stubs + build scripts
tests/                Playwright smoke tests (boot, run start, wave clear, death)
docs/                 GDD, this plan, Steam shipping guide, final overview
```

No frameworks, no bundler: native ES modules, so the game runs from any
static server and packs directly into Electron.

## Hour-by-hour

| Time | Goal |
|---|---|
| **H1** | Engine skeleton: loop, input, camera, particles, scene stack. Boss moves & fires first pattern; bullet pools + collision. Playwright boot test green. |
| **H2** | Hero archetypes (5) with AI + telegraphs; wave/party spawner; boss HP, phases, slam; hit feedback (shake, hit-stop, numbers). Playable death→restart loop. |
| **H3** | Mutations (pick screen + ~18 effects), Forms & evolution choice, ultimate; title/pause/death screens; saves (Dread, unlocks, hi-score). |
| **H4** | Audio synth (sfx + adaptive drone), juice pass (glow, trails, boss-bar shatter, kill flashes), balance curve tuning via scripted playtests + manual Playwright screenshot review. |
| **H5** | Bugfix sweep (Playwright smoke suite + code review), Electron wrapper + steamworks stubs, `STEAM_SHIPPING.md`, screenshots, final overview report to owner. Commit/push throughout, not just at the end. |

## Verification strategy

- Playwright drives the real game in Chromium: boot, start run, simulate
  input, assert wave progression/death, capture screenshots each hour.
- Deterministic RNG seed flag (`?seed=`) so scripted playtests are stable.
- `window.__testApi` hook exposing game state (wave, hp, entity counts) for
  assertions without coupling tests to rendering.

## Definition of done

Playable, balanced, juiced run loop with meta progression; zero console
errors across the smoke suite; Electron packaging documented and configured;
owner-facing overview with screenshots and a concrete Steam-launch checklist.

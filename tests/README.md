# QA scripts

Playwright-driven tests against the real game in Chromium. Serve the game
first, then run any script with Node 18+ and `playwright` installed:

```sh
npx http-server web -p 8123 -s        # from the repo root
cd tests && mkdir -p shots
node smoke.mjs                        # boot → start run → combat; fails on any console error
node playtest.mjs 21 100 6            # autopilot balance run: seed 21, 100s, 6x speed
node screens.mjs                      # captures mutation/evolution/death screens
```

Useful game URL flags (also used by these scripts):

- `?seed=N` — deterministic RNG for reproducible runs
- `?auto=1` — autopilot bot plays the game
- `?fast=N` — timescale multiplier
- Balance telemetry is printed to the console as `[PLAYTEST] {...}` lines.

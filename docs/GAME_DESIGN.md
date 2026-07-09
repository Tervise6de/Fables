# FINAL FORM — Game Design Document

**Genre:** Reverse boss-fight roguelite (arena bullet-hell, run-based)
**Hook:** *You are the final boss.* Hero parties raid you in waves; survive,
evolve, and wipe as many raids as you can.
**Session length:** 10–20 minute runs, endless-wave structure with meta unlocks.
**Price target:** $4.99 launch (small-indie sweet spot; impulse-buy range).
**Platforms:** Windows / Linux / macOS via Steam (Electron-wrapped HTML5).

---

## 1. Core fantasy

Every game trains players to fight the boss. FINAL FORM flips the camera:
you are the huge glowing monster in the middle of the arena, and the "enemies"
are plucky little heroes with health bars, dodge rolls, and healer support.
The power fantasy is being the raid encounter — and the tension is that heroes
are *designed* to kill bosses.

## 2. Core loop (one run)

1. **Wave begins** — a party of heroes enters the arena and attacks you.
2. **Fight** — you move (slowly, you're huge) and fire boss patterns:
   radial bursts, aimed volleys, beams, summoned minions, arena hazards.
   Heroes telegraph their attacks; you dodge or tank them.
3. **Wave cleared** — pick **1 of 3 Mutations** (upgrades), then **evolve**:
   every few waves your Form visibly changes (bigger, new limbs/sigils, new
   base attack).
4. Repeat with harder hero parties until you die. Score = waves wiped +
   heroes slain. Meta-currency ("Dread") unlocks new starting Forms and
   Mutations for future runs.

## 3. The player (the Boss)

- **Movement:** WASD / left stick, deliberately weighty. Mouse aims.
- **Health:** big HP pool shown as a classic *boss bar at the top of the
  screen* — the UI joke that sells the fantasy. Heroes chip it down; some
  Mutations heal on kills.
- **Attacks (base kit):**
  - **Primary — pattern weapon** (hold): fires the current Form's bullet
    pattern (radial spiral, aimed shotgun, orbiting orbs...).
  - **Slam (space, cooldown):** short-range shockwave that knocks heroes back
    and destroys projectiles — the panic button.
  - **Ultimate (Q, charges by damage dealt):** Form-specific screen-clearing
    phase move with a dramatic wind-up.
- **Phases:** at 66% and 33% HP the boss "enrages" — brief invulnerable
  transformation burst, pattern speeds up. Losing HP makes *you* more
  dangerous, exactly like real boss fights.

## 4. The enemies (Heroes)

Small, readable archetypes with classic MMO/JRPG flavor — the comedy and the
challenge come from them behaving like player characters:

| Archetype | Behavior | Threat |
|---|---|---|
| **Knight** | Walks at you, melee swings, raises shield to block patterns | Tanky, body-blocks |
| **Rogue** | Dashes in, backstab burst, dodge-rolls through bullets | High damage, evasive |
| **Archer** | Keeps max range, aimed shots, repositions | Constant chip damage |
| **Mage** | Casts telegraphed AoE circles you must move off | Zone denial |
| **Healer** | Hides behind others, heals & shields the party | Priority target |
| **Paladin (mini-boss hero)** | Every 5th wave: a "player character" with a name, dodge roll, potion chugs | Wave climax |

Heroes spawn in *parties* with composition rules (e.g. wave 7 = 2 Knights +
Archer + Healer). Killing the Healer first is the emergent skill the game
teaches.

## 5. Mutations (roguelite upgrades)

Picked 1-of-3 after each wave; stack and synergize. Categories:

- **Pattern mods:** +projectiles, spiral speed, bullets split on expiry,
  homing shards, bigger bullets.
- **Body mods:** move speed, max HP, slam radius, thorns (contact damage),
  lifesteal on kill.
- **Lair mods:** arena hazards — rotating flame walls, floor sigils that
  slow heroes, minion spawner nests.
- **Cursed picks (high risk):** huge power, drawback (e.g. "+80% damage,
  heroes gain dodge chance").

## 6. Forms (evolution + meta progression)

- Run starts as **The Husk** (basic radial pattern).
- Evolutions at waves 3/6/9/... choose between 2 visual+mechanical branches
  (e.g. *Seraph of Wires* — beams & orbitals vs *Grave Tide* — minions &
  pools). Form determines base pattern, Slam flavor, and Ultimate.
- **Dread** earned per run unlocks alternate starting Forms and adds
  Mutations to the pool — the "one more run" meta layer.

## 7. Presentation — "occult synthwave"

- Dark arena (near-black indigo), neon magenta/cyan/amber glows, additive
  blending, chromatic bloom faked with layered strokes.
- Boss and heroes drawn procedurally from primitives (polygons, sigil rings,
  trailing particles) — reads as an intentional style, not programmer art.
- **Juice budget is sacred:** screen shake, hit-stop, particle bursts, kill
  flashes, floating damage numbers on heroes (another UI joke — *they* have
  damage numbers), boss bar shatter effect on phase change.
- Procedural WebAudio synth: bass drone layers that intensify per wave,
  synthesized hits/explosions, phase-change stinger. No licensed audio.

## 8. UI / UX

- Title screen → (Run / Forms / Settings). Pause menu. Death screen with
  run stats ("Heroes slain: 214 — They will sing of the party that felled
  you"). Mutation pick screen between waves.
- Settings: volume sliders, screen-shake toggle, fullscreen.
- Local save (localStorage in dev / file in Electron): Dread, unlocks,
  high scores, settings.

## 9. Steam packaging

- Electron wrapper (`desktop/`), fullscreen borderless default.
- `steamworks.js` integration points stubbed behind a feature flag:
  achievements (first wipe, wave 10, all Forms), rich presence.
- Store-page checklist + capsule-art brief in `docs/STEAM_SHIPPING.md`
  so the owner can complete Steamworks submission (account + $100 fee +
  review are owner-side steps).

## 10. Scope guardrails (what ships in the sprint)

**Must:** core loop (waves, 5 hero archetypes, mutations, 3 Forms incl. 1
branch choice), boss bar/phases, death/restart, title/pause/death screens,
saves, sound, juice pass, balance pass, Electron wrapper config, docs.
**Cut first if time runs short:** Paladin mini-boss, cursed picks, second
evolution branch, rich presence.

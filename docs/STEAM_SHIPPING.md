# Shipping FINAL FORM to Steam — Owner Checklist

The game is code-complete and packaged for the Electron shipping path
(the same route Vampire Survivors used at launch). The steps below are the
ones only **you** (the account owner) can do. Rough total cost: **$100**
(one-time Steam Direct fee, recouped after ~$1,000 gross revenue).

## 1. Steamworks account & app (≈1 hour + a few days' waiting)

1. Create / log into a Steamworks account: https://partner.steamgames.com
2. Pay the **$100 Steam Direct fee** → you receive an **App ID**.
3. Complete tax & banking info (payouts require it; can take days to verify).
4. Replace `desktop/steam_appid.txt` contents (`480` is Valve's test ID)
   with your real App ID.

## 2. Build the game (≈15 min per platform)

```sh
cd desktop
npm install                # pulls electron, electron-builder, steamworks.js
npm run dist:win           # → dist/win-unpacked/  (build on/for Windows)
npm run dist:linux         # → dist/linux-unpacked/
```

Windows is ~96% of Steam sales for a game like this — ship Windows first,
Linux is nearly free to add. Test locally: run the unpacked build with the
Steam client open; achievements should pop under Spacewar (App ID 480).

## 3. Steamworks app configuration

- **Achievements** (Steamworks → Stats & Achievements): create these API
  names exactly — they're what the game sends:
  `FIRST_WIPE, FIRST_DEATH, WAVE_10, WAVE_15, FINAL_FORM, PALADIN_DOWN, CENTURION, CURSED`
  (display names/descriptions are in `web/src/core/achievements.js`).
- **Depots**: one per platform; upload builds with the `steamcmd` /
  SteamPipe GUI uploader; set the launch executable to `FINAL FORM.exe`
  (win) / `final-form` (linux).
- **Controller**: keyboard+mouse only at launch — say so on the store page.

## 4. Store page assets

All capsule art must be uploaded in Steam's exact sizes. The game's look
(magenta boss sigil on near-black, cyan accents) is easy to reproduce —
screenshot source material is in `docs/screenshots/`.

| Asset | Size |
|---|---|
| Header capsule | 920×430 |
| Small capsule | 462×174 |
| Main capsule | 1232×706 |
| Vertical capsule | 748×896 |
| Screenshots (min 5) | 1920×1080 (upscale the 1280×720 captures or re-shoot at 1080p fullscreen) |
| Library capsule | 600×900 |
| Library hero | 3840×1240 |

Tip: capture 1080p screenshots by running the game fullscreen on a 1080p
display (the canvas scales), or via Playwright with a 1920×1080 viewport.

## 5. Draft store copy (edit to taste)

**Short description:**
> Every game made you kill the final boss. This one lets you BE the boss.
> Survive waves of raiding heroes, unleash bullet-hell patterns of your own,
> and evolve into your FINAL FORM in this reverse boss-fight roguelite.

**About the game:**
> **You are the raid encounter.** The heroes have health bars, dodge rolls,
> healers, and a plan. You have a giant boss bar at the top of the screen,
> a lair, and an appetite.
>
> - **Be the bullet hell** — hold fire to unleash rotating spirals, aimed
>   lances, orbiting wards, and hunting wisps.
> - **Wipe raid parties** — Knights block, Rogues dodge-roll, Archers kite,
>   Mages drop AoEs on your head, and Healers ruin everything. Kill the
>   healer first. You know you would.
> - **Evolve every run** — pick mutations after every wave; at waves 3, 6
>   and 9 choose your evolution branch: the piercing light of the SERAPH or
>   the drowning dead of the GRAVE TIDE.
> - **Enrage phases** — at 66% and 33% HP you get *stronger*, exactly like
>   the bosses you grew up fighting.
> - **Meta progression** — earn Dread across runs to unlock cursed
>   mutations and permanent power. Your best party-wipe is your high score.

**Genre tags:** Action Roguelike, Bullet Hell, Arcade, Indie, Singleplayer
**Price:** $4.99 (launch discount 10–15% recommended)

## 6. Review & launch

1. Store page review by Valve (~3–5 business days), then the page must be
   public for **at least 2 weeks** before release ("coming soon" period —
   use it to gather wishlists).
2. Build review (run their pre-release checklist; Electron games pass
   routinely).
3. Set the release date, press the button.

## 7. Post-launch quick wins

- Ship the web build as a **free demo** (itch.io / your site) that links to
  the Steam page — this genre converts well from demos.
- Steam Next Fest (free, huge wishlist driver) if you can wait for the next
  edition before launching.
- The game reads well in 30-second clips (neon bullet hell + "you are the
  boss" hook) — short-form video is the cheapest marketing channel here.

## What's already handled in this repo

- Electron wrapper (`desktop/`) with fullscreen, F11 toggle, quit handling
- Steamworks init + achievement bridging (`desktop/main.js`, `preload.js`)
  that silently no-ops when Steam isn't running (so dev builds still work)
- Achievement IDs wired to real game events
- Save data persists in Electron's user-data dir via localStorage
- Deterministic seed + autopilot flags for QA (`?seed= ?auto=1 ?fast=`)

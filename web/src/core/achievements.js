// Achievement hooks. In the browser they just persist locally; inside the
// Electron wrapper, window.steamAchievement (exposed by the preload script)
// forwards them to Steamworks.

const KEY = 'finalform_achievements_v1';

export const ACHIEVEMENTS = {
  FIRST_WIPE: 'Party Wipe — wipe your first raid party',
  FIRST_DEATH: 'Working As Intended — get killed by heroes (you are the boss, after all)',
  WAVE_10: 'Raid Tier — survive 10 waves in one run',
  WAVE_15: 'Unkillable Content — survive 15 waves in one run',
  FINAL_FORM: 'Final Form — reach a tier-3 evolution',
  PALADIN_DOWN: 'Tank Buster — slay a named Paladin',
  CENTURION: 'Centurion — slay 100 heroes in one run',
  CURSED: 'Read The Fine Print — take a cursed mutation',
};

let earned = null;

function load() {
  if (earned) return earned;
  try { earned = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); }
  catch { earned = new Set(); }
  return earned;
}

export function award(id) {
  if (!ACHIEVEMENTS[id]) return;
  const e = load();
  if (e.has(id)) return;
  e.add(id);
  try { localStorage.setItem(KEY, JSON.stringify([...e])); } catch { /* ignore */ }
  try { window.steamAchievement?.(id); } catch { /* steam not present */ }
  console.log('[ACHIEVEMENT]', id);
  return ACHIEVEMENTS[id];
}

export function has(id) { return load().has(id); }

// Persistent save data. localStorage in the browser; the Electron wrapper
// also uses localStorage (persisted in its user-data dir), so this is the
// single save path for both.

const KEY = 'finalform_save_v1';

const DEFAULTS = {
  dread: 0,            // lifetime meta-currency
  bestWave: 0,
  bestKills: 0,
  totalRuns: 0,
  totalKills: 0,
  unlocked: [],        // unlock ids granted at dread thresholds
  settings: { volume: 0.7, music: 0.7, shake: true, fullscreen: false },
};

let data = null;

export function load() {
  if (data) return data;
  try {
    const raw = localStorage.getItem(KEY);
    data = raw ? { ...structuredClone(DEFAULTS), ...JSON.parse(raw) } : structuredClone(DEFAULTS);
    data.settings = { ...DEFAULTS.settings, ...(data.settings || {}) };
  } catch (e) {
    data = structuredClone(DEFAULTS);
  }
  return data;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode etc. */ }
}

export function get() { return load(); }

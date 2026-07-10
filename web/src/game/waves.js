// Wave definitions and the party spawner. Waves 1–10 are authored;
// beyond that, parties are generated from a point budget.
import { irange, pick, chance, shuffle } from '../core/rng.js';
import { createHero, heroCost } from './heroes.js';

const AUTHORED = [
  /* 1 */ ['knight', 'knight'],
  /* 2 */ ['knight', 'knight', 'archer'],
  /* 3 */ ['knight', 'rogue', 'archer'],
  /* 4 */ ['knight', 'knight', 'archer', 'healer'],
  /* 5 */ ['paladin', 'knight', 'healer'],
  /* 6 */ ['knight', 'knight', 'mage', 'healer'],
  /* 7 */ ['rogue', 'rogue', 'archer', 'archer', 'healer'],
  /* 8 */ ['knight', 'knight', 'mage', 'mage', 'healer'],
  /* 9 */ ['knight', 'rogue', 'archer', 'mage', 'healer', 'healer'],
  /* 10 */ ['paladin', 'knight', 'rogue', 'mage', 'healer'],
];

const TYPES = ['knight', 'knight', 'rogue', 'archer', 'archer', 'mage', 'healer'];

export function partyForWave(wave) {
  if (wave <= AUTHORED.length) return [...AUTHORED[wave - 1]];
  // Procedural: budget grows linearly; paladin every 5th wave.
  let budget = 8 + wave * 1.8;
  const party = [];
  if (wave % 5 === 0) { party.push('paladin'); budget -= heroCost('paladin'); }
  party.push('healer'); budget -= heroCost('healer');
  let guard = 40;
  while (budget > 1.5 && guard-- > 0) {
    const t = pick(TYPES);
    const c = heroCost(t);
    if (c <= budget) { party.push(t); budget -= c; }
  }
  // cap party size so late waves stay readable and fair
  return shuffle(party).slice(0, 14);
}

// Gate positions: middle of each arena edge.
function gates(W, H) {
  return [
    { x: W / 2, y: -20, ix: W / 2, iy: 90 },
    { x: W / 2, y: H + 20, ix: W / 2, iy: H - 90 },
    { x: -20, y: H / 2, ix: 110, iy: H / 2 },
    { x: W + 20, y: H / 2, ix: W - 110, iy: H / 2 },
  ];
}

// Returns spawn descriptors with staggered delays; run.update consumes them.
export function buildSpawns(wave, W, H) {
  const party = partyForWave(wave);
  const gs = gates(W, H);
  const spawns = [];
  party.forEach((type, i) => {
    const g = gs[irange(0, gs.length - 1)];
    const jitter = () => irange(-60, 60);
    spawns.push({
      type,
      delay: 0.35 * i + (chance(0.5) ? 0.15 : 0),
      x: g.x + (g.y < 0 || g.y > H ? jitter() : 0),
      y: g.y + (g.x < 0 || g.x > W ? jitter() : 0),
      ix: g.ix + jitter(),
      iy: g.iy + jitter(),
      wave,
    });
  });
  return spawns;
}

export function spawnFromDescriptor(s) {
  const h = createHero(s.type, s.x, s.y, s.wave);
  h.enterX = s.ix; h.enterY = s.iy;
  return h;
}

// Boss Forms: the evolution tree. A run starts as The Husk; at waves 3/6/9
// the player picks a branch tier. Each tier layers a pattern component on
// top of the previous ones and upgrades the visuals.
//
// Pattern components are functions called every update while firing:
//   comp(boss, run, dt, emit) — use boss.fireClock for phase-scaled timing.
import { TAU } from '../core/math.js';
import * as bullets from './bullets.js';
import { PALETTE } from '../render/draw.js';

// Helper: fire on a timer stored on the boss keyed by name.
function every(boss, key, interval, fn) {
  const t = (boss.timers[key] ?? 0) - boss.frameDt;
  if (t <= 0) {
    fn();
    boss.timers[key] = interval + t; // keep remainder for accuracy
  } else {
    boss.timers[key] = t;
  }
}

// --- pattern components -------------------------------------------------

// Rotating radial spiral — the Husk's base weapon.
function spiral(arms, rate, speed) {
  return (boss, run) => {
    every(boss, 'spiral', 1 / (rate * boss.stats.fireRate * boss.phaseRate), () => {
      boss.spiralAngle = (boss.spiralAngle + 0.42) % TAU;
      const n = arms + boss.stats.projAdd;
      for (let i = 0; i < n; i++) {
        const a = boss.spiralAngle + (i / n) * TAU;
        boss.emit(a, { speed: speed * boss.stats.bulletSpeed, r: 6, dmg: boss.stats.damage });
      }
    });
  };
}

// Aimed lance volley toward the cursor (Seraph).
function lances(count, rate) {
  return (boss, run) => {
    every(boss, 'lance', 1 / (rate * boss.stats.fireRate * boss.phaseRate), () => {
      for (let i = 0; i < count; i++) {
        const spread = (i - (count - 1) / 2) * 0.09;
        boss.emit(boss.aim + spread, {
          speed: 520 * boss.stats.bulletSpeed, r: 4.5,
          dmg: boss.stats.damage * 1.3, color: '#ff7ae0', trail: true,
        });
      }
    });
  };
}

// Orbiting orbs that periodically fling outward (Seraph tier 2).
function orbitals(count) {
  return (boss, run) => {
    every(boss, 'orbital', 1.6 / (boss.stats.fireRate * boss.phaseRate), () => {
      for (let i = 0; i < count; i++) {
        const a = boss.spiralAngle * 2 + (i / count) * TAU;
        const ox = boss.x + Math.cos(a) * (boss.radius + 26);
        const oy = boss.y + Math.sin(a) * (boss.radius + 26);
        bullets.spawnBoss(ox, oy, a + Math.PI / 2, {
          speed: 200 * boss.stats.bulletSpeed, r: 8, dmg: boss.stats.damage * 1.5,
          color: '#c9a4ff', life: 2.2, homing: 1.2 + boss.stats.homing,
        });
      }
    });
  };
}

// Slow heavy ring of fat bullets (Grave Tide flavor).
function heavyRing(count, rate) {
  return (boss, run) => {
    every(boss, 'ring', 1 / (rate * boss.stats.fireRate * boss.phaseRate), () => {
      const n = count + boss.stats.projAdd;
      const off = boss.spiralAngle * 0.7;
      for (let i = 0; i < n; i++) {
        boss.emit(off + (i / n) * TAU, {
          speed: 150 * boss.stats.bulletSpeed, r: 9,
          dmg: boss.stats.damage * 1.6, color: '#9d5cff', life: 4.5,
        });
      }
    });
  };
}

// Homing wisp minions (Grave Tide). Fire even when not holding attack —
// the boss update loop runs components flagged alwaysOn every frame.
function wisps(interval) {
  const fn = (boss, run) => {
    every(boss, 'wisp', interval / (boss.phaseRate), () => {
      const a = boss.spiralAngle * 3.7;
      bullets.spawnBoss(boss.x, boss.y, a, {
        speed: 170, r: 7, dmg: boss.stats.damage * 2.2,
        color: '#8dff6a', life: 7, homing: 2.6, wisp: true,
      });
    });
  };
  fn.alwaysOn = true;
  return fn;
}

// --- ultimates -----------------------------------------------------------

function ultPulse(boss, run) {
  // Cataclysm Pulse: three expanding shockwaves (handled by run.hazards).
  for (let i = 0; i < 3; i++) {
    run.hazards.push({ type: 'shockwave', x: boss.x, y: boss.y, r: 20, delay: i * 0.28, speed: 620, dmg: boss.stats.damage * 3.2, hit: new Set() });
  }
}

function ultBeamStorm(boss, run) {
  // Zenith Storm: dense spiral burst for 2.2 seconds.
  boss.stormTime = 2.2;
}

function ultMassGrave(boss, run) {
  // Mass Grave: wisp swarm + heal.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    bullets.spawnBoss(boss.x, boss.y, a, {
      speed: 220, r: 7, dmg: boss.stats.damage * 2.2,
      color: '#8dff6a', life: 8, homing: 2.8, wisp: true,
    });
  }
  boss.heal(boss.maxHp * 0.08);
}

// --- form definitions ----------------------------------------------------

export const FORMS = {
  husk: {
    id: 'husk', name: 'THE HUSK', tier: 0,
    desc: 'A hollow godling. Radial spiral of woe.',
    color: PALETTE.boss, sides: 6, scale: 1,
    components: [spiral(4, 3.5, 260)],
    ult: { name: 'Cataclysm Pulse', fn: ultPulse, desc: 'Expanding shockwaves shred the raid.' },
  },
  seraph1: {
    id: 'seraph1', name: 'WIRED SERAPH', tier: 1, branch: 'seraph',
    desc: 'Grow lances of light. Aimed volleys pierce the raid.',
    color: '#ff5ecf', sides: 8, scale: 1.12,
    stats: { speed: +20 },
    components: [spiral(3, 2.6, 260), lances(3, 1.6)],
    ult: { name: 'Zenith Storm', fn: ultBeamStorm, desc: 'Unleash a 2s bullet hurricane.' },
  },
  seraph2: {
    id: 'seraph2', name: 'SERAPH OF WIRES', tier: 2, branch: 'seraph',
    desc: 'Orbital wards circle you, hunting the faithful.',
    color: '#ff7ae0', sides: 8, scale: 1.24,
    stats: { damage: +3 },
    components: [spiral(4, 2.6, 270), lances(4, 1.8), orbitals(3)],
    ult: { name: 'Zenith Storm', fn: ultBeamStorm, desc: 'Unleash a 2s bullet hurricane.' },
  },
  seraph3: {
    id: 'seraph3', name: 'FINAL FORM: APOTHEOSIS', tier: 3, branch: 'seraph',
    desc: 'You are the light at the end. It hungers.',
    color: '#ffb3ef', sides: 10, scale: 1.38,
    stats: { damage: +4, fireRateMul: 1.15 },
    components: [spiral(5, 2.8, 280), lances(5, 2.0), orbitals(4)],
    ult: { name: 'Zenith Storm', fn: ultBeamStorm, desc: 'Unleash a 2s bullet hurricane.' },
  },
  grave1: {
    id: 'grave1', name: 'GRAVE TIDE', tier: 1, branch: 'grave',
    desc: 'The drowned dead answer. Wisps hunt; shots hit like tombstones.',
    color: '#9d5cff', sides: 5, scale: 1.12,
    stats: { maxHp: +150 },
    components: [heavyRing(6, 1.5), wisps(2.6)],
    ult: { name: 'Mass Grave', fn: ultMassGrave, desc: 'Wisp swarm; drink their fear (heal 8%).' },
  },
  grave2: {
    id: 'grave2', name: 'DROWNED CHOIR', tier: 2, branch: 'grave',
    desc: 'More voices. More graves.',
    color: '#b07dff', sides: 5, scale: 1.24,
    stats: { maxHp: +150, damage: +2 },
    components: [heavyRing(8, 1.6), wisps(1.9)],
    ult: { name: 'Mass Grave', fn: ultMassGrave, desc: 'Wisp swarm; drink their fear (heal 8%).' },
  },
  grave3: {
    id: 'grave3', name: 'FINAL FORM: WORLD-GRAVE', tier: 3, branch: 'grave',
    desc: 'Every hero is already buried. They just don’t know it yet.',
    color: '#c9a4ff', sides: 7, scale: 1.38,
    stats: { maxHp: +200, damage: +3 },
    components: [heavyRing(10, 1.7), wisps(1.3), spiral(3, 1.8, 220)],
    ult: { name: 'Mass Grave', fn: ultMassGrave, desc: 'Wisp swarm; drink their fear (heal 8%).' },
  },
};

// Which forms are offered at an evolution point, given the current form.
export function evolutionChoices(current) {
  if (current.tier === 0) return [FORMS.seraph1, FORMS.grave1];
  if (current.tier === 1) return [FORMS[current.branch + '2']];
  if (current.tier === 2) return [FORMS[current.branch + '3']];
  return [];
}

export function isEvolutionWave(wave) { return wave === 3 || wave === 6 || wave === 9; }

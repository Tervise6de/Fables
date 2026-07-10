// Mutations: 1-of-3 picks after each non-evolution wave. Effects either
// adjust boss.stats or register run-level hazards/behaviors.
import { pick, shuffle } from '../core/rng.js';
import { get as getSave } from '../core/save.js';

export const MUTATIONS = [
  // Pattern mods
  { id: 'proj2', name: 'HYDRA THROATS', desc: '+2 projectiles on radial patterns', tag: 'pattern',
    apply: (s) => { s.projAdd += 2; } },
  { id: 'firerate', name: 'FEVER HYMN', desc: '+25% fire rate', tag: 'pattern',
    apply: (s) => { s.fireRate *= 1.25; } },
  { id: 'bspeed', name: 'SCREAMING SHARDS', desc: '+30% projectile speed', tag: 'pattern',
    apply: (s) => { s.bulletSpeed *= 1.3; } },
  { id: 'pierce', name: 'NEEDLE LITANY', desc: 'Projectiles pierce +1 hero', tag: 'pattern',
    apply: (s) => { s.pierce += 1; } },
  { id: 'split', name: 'MITOSIS', desc: 'Projectiles split in two when they expire', tag: 'pattern',
    apply: (s) => { s.split = true; } },
  { id: 'homing', name: 'JEALOUS BULLETS', desc: 'Projectiles curve toward heroes', tag: 'pattern',
    apply: (s) => { s.homing += 0.9; } },
  { id: 'damage', name: 'BLASPHEMY EDGE', desc: '+25% damage', tag: 'pattern',
    apply: (s) => { s.damageMul *= 1.25; } },
  { id: 'crit', name: 'KILLING JOKE', desc: '15% chance projectiles crit for 3×', tag: 'pattern',
    apply: (s) => { s.critChance = Math.min(0.6, s.critChance + 0.15); } },

  // Body mods
  { id: 'hp', name: 'SWOLLEN IDOL', desc: '+200 max HP and heal 200', tag: 'body',
    apply: (s, boss) => { s.maxHpAdd += 200; boss.maxHp += 200; boss.heal(200); } },
  { id: 'lifesteal', name: 'RED TITHE', desc: 'Heal 12 HP per hero slain', tag: 'body',
    apply: (s) => { s.lifesteal += 12; } },
  { id: 'speed', name: 'UNSHACKLED', desc: '+18% movement speed', tag: 'body',
    apply: (s) => { s.speedMul *= 1.18; } },
  { id: 'thorns', name: 'CROWN OF KNIVES', desc: 'Touching you burns heroes (20 dmg/s)', tag: 'body',
    apply: (s) => { s.thorns += 20; } },
  { id: 'slam', name: 'TECTONIC SCORN', desc: 'Slam radius +40%, knockback +50%', tag: 'body',
    apply: (s) => { s.slamRadius *= 1.4; s.slamKnockback *= 1.5; } },
  { id: 'slamburn', name: 'ASH HALO', desc: 'Slam leaves a burning ring (6s)', tag: 'body',
    apply: (s) => { s.slamBurn = true; } },
  { id: 'ultrate', name: 'DOOM ENGINE', desc: 'Ultimate charges 35% faster', tag: 'body',
    apply: (s) => { s.ultRate *= 1.35; } },

  // Lair mods
  { id: 'flamewall', name: 'ORBITING PYRE', desc: 'A flame orbits you, burning heroes', tag: 'lair',
    apply: (s, boss, run) => { run.hazards.push({ type: 'flame', angle: 0, dist: 95, r: 16, dps: 35 });
      s.flames = (s.flames || 0) + 1; } },
  { id: 'slowfield', name: 'DREAD MIRE', desc: 'Heroes near you are slowed 30%', tag: 'lair',
    apply: (s) => { s.slowAura = Math.max(s.slowAura, 0.3); } },
  { id: 'nest', name: 'WHISPER NEST', desc: 'Spawn a hunting wisp every 5s', tag: 'lair',
    apply: (s) => { s.nestInterval = s.nestInterval > 0 ? s.nestInterval * 0.7 : 5; } },

  // Cursed picks (unlocked at 75 lifetime Dread)
  { id: 'c_glass', name: '☠ GLASS GOD', desc: '+80% damage, but −30% max HP', tag: 'cursed', cursed: true,
    apply: (s, boss) => { s.damageMul *= 1.8; boss.maxHp = Math.max(200, Math.round(boss.maxHp * 0.7)); boss.hp = Math.min(boss.hp, boss.maxHp); } },
  { id: 'c_frenzy', name: '☠ RABID LITURGY', desc: '+50% fire rate, but heroes move 15% faster', tag: 'cursed', cursed: true,
    apply: (s, boss, run) => { s.fireRate *= 1.5; run.heroSpeedMul *= 1.15; } },
  { id: 'c_greed', name: '☠ GOLDEN CANCER', desc: 'Double Dread earned, but −25% damage', tag: 'cursed', cursed: true,
    apply: (s, boss, run) => { run.dreadMul *= 2; s.damageMul *= 0.75; } },
];

// Deal 3 distinct options the player doesn't already have (unique-per-run
// ones like split/slamBurn can repeat only if pool runs dry).
export function dealMutations(run) {
  const unlocked = getSave().unlocked;
  const cursedOk = unlocked.includes('cursed');
  const pool = MUTATIONS.filter((m) => {
    if (m.cursed && !cursedOk) return false;
    const picks = run.mutations.filter((x) => x === m.id).length;
    const unique = ['split', 'slamburn', 'slowfield', 'pierce', 'c_glass', 'c_greed'].includes(m.id);
    return unique ? picks === 0 : picks < 3;
  });
  shuffle(pool);
  // At most one cursed option per deal so the choice stays interesting.
  const out = [];
  let cursedDealt = 0;
  for (const m of pool) {
    if (m.cursed && cursedDealt >= 1) continue;
    if (m.cursed) cursedDealt++;
    out.push(m);
    if (out.length === 3) break;
  }
  return out;
}

// ---- meta progression ----------------------------------------------------

export const UNLOCKS = [
  { id: 'cursed', at: 75, name: 'CURSED MUTATIONS', desc: 'High-risk ☠ picks join the pool.' },
  { id: 'oldblood', at: 200, name: 'OLD BLOOD', desc: 'All runs start with +10% max HP.' },
  { id: 'headstart', at: 400, name: 'AWAKENED', desc: 'Runs start with a free mutation pick.' },
  { id: 'veteran', at: 800, name: 'VETERAN LAIR', desc: 'Slam starts 30% larger.' },
];

// Grant any unlocks the lifetime dread total now qualifies for.
// Returns the newly granted ones (for the death-screen callout).
export function checkUnlocks(save) {
  const fresh = [];
  for (const u of UNLOCKS) {
    if (save.dread >= u.at && !save.unlocked.includes(u.id)) {
      save.unlocked.push(u.id);
      fresh.push(u);
    }
  }
  return fresh;
}

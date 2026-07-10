// The player: a raid boss. Weighty movement, held-fire patterns, a slam
// panic button, a charging ultimate, and enrage phases at 66% / 33% HP.
import { TAU, clamp, angleTo } from '../core/math.js';
import * as input from '../core/input.js';
import * as bullets from './bullets.js';
import * as particles from '../render/particles.js';
import * as camera from '../core/camera.js';
import { sfx } from '../audio/sound.js';
import { FORMS } from './forms.js';
import { glowCircle, ring, poly, sigil, PALETTE } from '../render/draw.js';
import { chance } from '../core/rng.js';
import { get as getSave } from '../core/save.js';

export function createBoss(x, y) {
  const save = getSave();
  const boss = {
    x, y, vx: 0, vy: 0,
    radius: 30,
    form: FORMS.husk,
    maxHp: 1000,
    hp: 1000,
    phase: 1,           // 1 → 2 (66%) → 3 (33%)
    phaseRate: 1,       // pattern speed multiplier from phase
    invuln: 0,          // seconds of invulnerability (phase transitions)
    aim: 0,
    firing: false,
    spiralAngle: 0,
    timers: {},         // per-pattern-component fire timers
    frameDt: 0,
    slamCd: 0,
    ultCharge: 0,       // 0..1
    stormTime: 0,       // Zenith Storm remaining
    hurtFlash: 0,
    dead: false,
    stats: {
      damage: 13, damageMul: 1, fireRate: 1, projAdd: 0, bulletSpeed: 1,
      pierce: 0, split: false, homing: 0, critChance: 0,
      speedMul: 1, maxHpAdd: 0, lifesteal: 0, thorns: 0,
      slamRadius: 130, slamDamage: 30, slamKnockback: 420, slamCooldown: 3.5,
      slamBurn: false, ultRate: 1, slowAura: 0, nestInterval: 0, flames: 0,
    },
    heal(amount) {
      if (this.dead) return;
      this.hp = Math.min(this.maxHp, this.hp + amount);
    },
    hurt(amount, run) {
      if (this.dead || this.invuln > 0) return;
      this.hp -= amount;
      this.hurtFlash = 0.15;
      camera.shake(0.18);
      sfx.bossHurt();
      particles.spawn(this.x, this.y, { color: PALETTE.boss, count: 6, speed: 160, life: 0.4 });
      // Enrage phase thresholds
      const frac = this.hp / this.maxHp;
      if (this.phase === 1 && frac <= 0.66) this.enterPhase(2, run);
      else if (this.phase === 2 && frac <= 0.33) this.enterPhase(3, run);
      if (this.hp <= 0) { this.hp = 0; this.dead = true; }
    },
    enterPhase(p, run) {
      this.phase = p;
      this.phaseRate = 1 + (p - 1) * 0.22;
      this.invuln = 1.1;
      camera.shake(0.7);
      camera.stop(0.12);
      sfx.phase();
      particles.spawn(this.x, this.y, { color: '#fff', count: 40, speed: 380, life: 0.8, size: 4 });
      // Phase burst knocks heroes back so the moment reads as an enrage.
      for (const h of run.heroes) {
        if (h.dead) continue;
        const a = angleTo(this.x, this.y, h.x, h.y);
        h.kbx = (h.kbx || 0) + Math.cos(a) * 380;
        h.kby = (h.kby || 0) + Math.sin(a) * 380;
      }
      run.banner(`PHASE ${p} — THE ${p === 2 ? 'WOUNDED' : 'DYING'} GOD WAKES`, this.form.color);
    },
    // Fire one projectile from the boss edge at angle a.
    emit(a, opts) {
      const s = this.stats;
      const crit = s.critChance > 0 && chance(s.critChance);
      const dmg = (opts.dmg ?? s.damage) * s.damageMul * (crit ? 3 : 1);
      bullets.spawnBoss(
        this.x + Math.cos(a) * (this.radius + 6),
        this.y + Math.sin(a) * (this.radius + 6),
        a,
        { ...opts, dmg, pierce: (opts.pierce ?? 0) + s.pierce, split: opts.split ?? s.split,
          homing: (opts.homing ?? 0) + s.homing, crit,
          r: (opts.r ?? 6) * (crit ? 1.5 : 1) },
      );
    },
    setForm(id) {
      const f = FORMS[id] ?? id;
      this.form = f;
      // Flat stat bonuses baked into the form definition.
      if (f.stats) {
        if (f.stats.maxHp) { this.maxHp += f.stats.maxHp; this.heal(f.stats.maxHp); }
        if (f.stats.damage) this.stats.damage += f.stats.damage;
        if (f.stats.speed) this.stats.speedMul *= 1 + f.stats.speed / 100;
        if (f.stats.fireRateMul) this.stats.fireRate *= f.stats.fireRateMul;
      }
      this.radius = 30 * f.scale;
      this.invuln = Math.max(this.invuln, 1.2);
      particles.spawn(this.x, this.y, { color: f.color, count: 60, speed: 420, life: 1, size: 4 });
      camera.shake(0.8);
      sfx.phase();
    },
  };

  // Meta unlock bonuses
  const un = save.unlocked;
  if (un.includes('oldblood')) { boss.maxHp = Math.round(boss.maxHp * 1.1); boss.hp = boss.maxHp; }
  if (un.includes('veteran')) boss.stats.slamRadius *= 1.3;
  return boss;
}

export function updateBoss(boss, run, dt, W, H) {
  if (boss.dead) return;
  boss.frameDt = dt;
  boss.invuln = Math.max(0, boss.invuln - dt);
  boss.hurtFlash = Math.max(0, boss.hurtFlash - dt);
  boss.slamCd = Math.max(0, boss.slamCd - dt);
  boss.spiralAngle += dt * 0.9;

  // Movement — heavy acceleration toward input axis.
  const ax = input.axis();
  const speed = 165 * boss.stats.speedMul;
  boss.vx += (ax.x * speed - boss.vx) * Math.min(1, dt * 8);
  boss.vy += (ax.y * speed - boss.vy) * Math.min(1, dt * 8);
  boss.x = clamp(boss.x + boss.vx * dt, boss.radius + 12, W - boss.radius - 12);
  boss.y = clamp(boss.y + boss.vy * dt, boss.radius + 12, H - boss.radius - 12);

  boss.aim = angleTo(boss.x, boss.y, input.mouse.x, input.mouse.y);
  boss.firing = input.mouse.down || input.down('KeyJ');

  // Patterns: components fire while the attack is held. Wisp components
  // are "always on" — they fire regardless (summons don't need aim).
  if (boss.firing || boss.stormTime > 0) {
    for (const comp of boss.form.components) comp(boss, run, dt);
    sfx.shoot();
  } else {
    for (const comp of boss.form.components) {
      // Keep summon-type timers ticking (wisps identified by name binding).
      if (comp.alwaysOn) comp(boss, run, dt);
    }
  }

  // Zenith Storm: dense extra spiral while active.
  if (boss.stormTime > 0) {
    boss.stormTime -= dt;
    boss.stormTick = (boss.stormTick ?? 0) - dt;
    if (boss.stormTick <= 0) {
      boss.stormTick = 0.05;
      for (let i = 0; i < 3; i++) {
        const a = boss.spiralAngle * 6 + (i / 3) * TAU;
        boss.emit(a, { speed: 420, r: 5, dmg: boss.stats.damage * 0.9, color: '#ffe1f7', life: 2 });
      }
    }
  }

  // Whisper Nest mutation: periodic wisp regardless of form.
  if (boss.stats.nestInterval > 0) {
    boss.timers.nest = (boss.timers.nest ?? boss.stats.nestInterval) - dt;
    if (boss.timers.nest <= 0) {
      boss.timers.nest = boss.stats.nestInterval;
      bullets.spawnBoss(boss.x, boss.y, boss.spiralAngle * 5, {
        speed: 180, r: 7, dmg: boss.stats.damage * 2.2, color: '#8dff6a', life: 7, homing: 2.6, wisp: true,
      });
    }
  }

  // Slam (Space)
  if ((input.pressed('Space') || input.pressed('KeyK')) && boss.slamCd <= 0) {
    doSlam(boss, run);
  }

  // Ultimate (Q) when fully charged
  if ((input.pressed('KeyQ') || input.pressed('KeyL')) && boss.ultCharge >= 1) {
    boss.ultCharge = 0;
    camera.shake(0.9);
    camera.stop(0.1);
    sfx.ult();
    run.banner(boss.form.ult.name.toUpperCase(), boss.form.color);
    boss.form.ult.fn(boss, run);
  }
}

function doSlam(boss, run) {
  const s = boss.stats;
  boss.slamCd = s.slamCooldown;
  camera.shake(0.5);
  camera.stop(0.06);
  sfx.slam();
  run.hazards.push({ type: 'slamring', x: boss.x, y: boss.y, r: boss.radius, maxR: s.slamRadius, life: 0.25, maxLife: 0.25 });
  bullets.clearHeroBulletsNear(boss.x, boss.y, s.slamRadius * 1.1);
  particles.spawn(boss.x, boss.y, { color: PALETTE.white, count: 30, speed: 420, life: 0.5, size: 3 });
  for (const h of run.heroes) {
    if (h.dead || h.entering) continue;
    const d = Math.hypot(h.x - boss.x, h.y - boss.y);
    if (d < s.slamRadius + h.radius) {
      const a = angleTo(boss.x, boss.y, h.x, h.y);
      h.kbx = (h.kbx || 0) + Math.cos(a) * s.slamKnockback;
      h.kby = (h.kby || 0) + Math.sin(a) * s.slamKnockback;
      run.damageHero(h, s.slamDamage * s.damageMul, false);
      h.stun = Math.max(h.stun || 0, 0.5);
    }
  }
  if (s.slamBurn) {
    run.hazards.push({ type: 'burnring', x: boss.x, y: boss.y, r: s.slamRadius * 0.9, life: 6, dps: 25 * s.damageMul });
  }
}

export function drawBoss(ctx, boss, time) {
  if (boss.dead) return;
  const f = boss.form;
  const pulse = 1 + Math.sin(time * 3) * 0.04 + (boss.phase - 1) * 0.03;
  const r = boss.radius * pulse;
  const flash = boss.hurtFlash > 0;
  const col = flash ? '#ffffff' : f.color;

  // outer sigil ring — grows with tier
  sigil(ctx, boss.x, boss.y, r + 26 + f.tier * 7, boss.spiralAngle * 0.5, f.color, 0.35 + f.tier * 0.08);
  if (f.tier >= 2) sigil(ctx, boss.x, boss.y, r + 44 + f.tier * 6, -boss.spiralAngle * 0.3, f.color, 0.22);

  glowCircle(ctx, boss.x, boss.y, r, col, boss.invuln > 0 ? 1.6 : 1);
  poly(ctx, boss.x, boss.y, r * 0.8, f.sides, boss.spiralAngle, '#05040c', { fill: true, alpha: 0.85 });
  poly(ctx, boss.x, boss.y, r * 0.8, f.sides, boss.spiralAngle, col, { width: 2.5 });
  poly(ctx, boss.x, boss.y, r * 0.5, f.sides, -boss.spiralAngle * 1.4, col, { width: 1.5, alpha: 0.8 });

  // the Eye — tracks the cursor
  const ex = boss.x + Math.cos(boss.aim) * r * 0.22;
  const ey = boss.y + Math.sin(boss.aim) * r * 0.22;
  glowCircle(ctx, ex, ey, r * 0.16, '#ffffff', 1.1);

  // phase pips under the boss
  for (let i = 0; i < 3; i++) {
    ring(ctx, boss.x - 14 + i * 14, boss.y + r + 14, 3.5, i < boss.phase ? f.color : 'rgba(255,255,255,0.2)', 2);
  }
}

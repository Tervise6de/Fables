// Hero archetypes — the "enemies". They behave like player characters:
// they kite, dodge-roll, block, heal each other, and focus the boss.
import { TAU, clamp, dist, angleTo, lerpAngle } from '../core/math.js';
import { range, chance, pick } from '../core/rng.js';
import * as bullets from './bullets.js';
import * as particles from '../render/particles.js';
import { glowCircle, ring, poly, bar, text, PALETTE } from '../render/draw.js';
import { sfx } from '../audio/sound.js';

const NAMES = ['Sir Aldric', 'Dame Yveth', 'Kaelor the Pure', 'Brightshield Om', 'Saint Verrick', 'Lady Solenne'];

const BASE = {
  knight: { hp: 80, speed: 95, radius: 14, color: '#37e2ff', dmg: 11, cost: 2 },
  rogue: { hp: 50, speed: 175, radius: 11, color: '#7dff9a', dmg: 8, cost: 2.5 },
  archer: { hp: 42, speed: 110, radius: 11, color: '#ffc94d', dmg: 13, cost: 2 },
  mage: { hp: 46, speed: 85, radius: 12, color: '#b58cff', dmg: 25, cost: 3 },
  healer: { hp: 55, speed: 105, radius: 11, color: '#7dffd4', dmg: 6, cost: 3 },
  paladin: { hp: 380, speed: 88, radius: 19, color: '#ffe27a', dmg: 22, cost: 6 },
};

export function heroCost(type) { return BASE[type].cost; }

export function createHero(type, x, y, wave) {
  const b = BASE[type];
  const hpMult = 1 + (wave - 1) * 0.17;
  const dmgMult = 1 + (wave - 1) * 0.06;
  return {
    type, x, y,
    hp: Math.round(b.hp * hpMult),
    maxHp: Math.round(b.hp * hpMult),
    dmg: b.dmg * dmgMult,
    speed: b.speed * range(0.92, 1.08),
    radius: b.radius,
    color: b.color,
    dead: false,
    entering: true,       // walking in through the gate; untargetable
    enterX: 0, enterY: 0, // set by spawner
    state: 'idle', t: range(0, 0.5),
    facing: 0,
    stun: 0, kbx: 0, kby: 0, iframes: 0, flash: 0,
    shielded: false, shieldT: range(1, 5),
    strafeDir: chance(0.5) ? 1 : -1,
    potionUsed: false,
    name: type === 'paladin' ? pick(NAMES) : null,
    castX: 0, castY: 0,
    healTarget: null,
  };
}

// Soft steering toward a point, respecting stun/knockback (applied by run).
function moveToward(h, tx, ty, dt, speedMul, factor = 1) {
  if (h.stun > 0) return;
  const a = angleTo(h.x, h.y, tx, ty);
  h.facing = lerpAngle(h.facing, a, Math.min(1, dt * 10));
  h.x += Math.cos(a) * h.speed * speedMul * factor * dt;
  h.y += Math.sin(a) * h.speed * speedMul * factor * dt;
}

export function updateHero(h, run, dt, W, H) {
  const boss = run.boss;
  h.t -= dt;
  h.stun = Math.max(0, h.stun - dt);
  h.iframes = Math.max(0, h.iframes - dt);
  h.flash = Math.max(0, h.flash - dt);

  // knockback decay
  h.x += h.kbx * dt; h.y += h.kby * dt;
  h.kbx *= Math.max(0, 1 - 6 * dt);
  h.kby *= Math.max(0, 1 - 6 * dt);
  h.x = clamp(h.x, 16, W - 16);
  h.y = clamp(h.y, 16, H - 16);

  if (h.entering) {
    moveToward(h, h.enterX, h.enterY, dt, 1);
    if (dist(h.x, h.y, h.enterX, h.enterY) < 12) h.entering = false;
    return;
  }

  // Global speed modifiers: cursed mutation buff + boss slow aura.
  let speedMul = run.heroSpeedMul;
  if (boss.stats.slowAura > 0 && dist(h.x, h.y, boss.x, boss.y) < 230) {
    speedMul *= 1 - boss.stats.slowAura;
  }

  const d = dist(h.x, h.y, boss.x, boss.y);
  const toBoss = angleTo(h.x, h.y, boss.x, boss.y);

  switch (h.type) {
    case 'knight': updateKnight(h, run, dt, d, toBoss, speedMul); break;
    case 'rogue': updateRogue(h, run, dt, d, toBoss, speedMul); break;
    case 'archer': updateArcher(h, run, dt, d, toBoss, speedMul, W, H); break;
    case 'mage': updateMage(h, run, dt, d, toBoss, speedMul, W, H); break;
    case 'healer': updateHealer(h, run, dt, d, toBoss, speedMul, W, H); break;
    case 'paladin': updatePaladin(h, run, dt, d, toBoss, speedMul); break;
  }

  // Separation so heroes don't stack into one blob.
  for (const o of run.heroes) {
    if (o === h || o.dead) continue;
    const dd = dist(h.x, h.y, o.x, o.y);
    const min = h.radius + o.radius + 2;
    if (dd < min && dd > 0.001) {
      const a = angleTo(o.x, o.y, h.x, h.y);
      const push = (min - dd) * 0.5;
      h.x += Math.cos(a) * push; h.y += Math.sin(a) * push;
    }
  }
}

// --- knight ---------------------------------------------------------------

function updateKnight(h, run, dt, d, toBoss, speedMul) {
  const boss = run.boss;
  // shield cycle
  h.shieldT -= dt;
  if (h.shielded && h.shieldT <= 0) { h.shielded = false; h.shieldT = range(4, 7); }
  else if (!h.shielded && h.shieldT <= 0) { h.shielded = true; h.shieldT = 1.6; }

  const reach = boss.radius + 34;
  if (h.state === 'windup') {
    if (h.t <= 0) {
      h.state = 'recover'; h.t = 0.7;
      if (d < reach + 10) {
        run.damageBoss(h.dmg);
        particles.spawn(boss.x + Math.cos(toBoss + Math.PI) * boss.radius, boss.y + Math.sin(toBoss + Math.PI) * boss.radius,
          { color: h.color, count: 8, speed: 150, life: 0.3 });
      }
    }
  } else if (h.state === 'recover') {
    if (h.t <= 0) h.state = 'idle';
  } else {
    if (d > reach) moveToward(h, boss.x, boss.y, dt, speedMul);
    else { h.state = 'windup'; h.t = 0.45; }
  }
}

// --- rogue ------------------------------------------------------------------

function updateRogue(h, run, dt, d, toBoss, speedMul) {
  const boss = run.boss;
  const reach = boss.radius + 26;
  switch (h.state) {
    case 'idle':
      // approach with a curving strafe
      moveToward(h, boss.x + Math.cos(toBoss + Math.PI / 2) * 40 * h.strafeDir, boss.y + Math.sin(toBoss + Math.PI / 2) * 40 * h.strafeDir, dt, speedMul);
      if (d < reach + 8) { h.state = 'slash'; h.t = 0.2; h.slashes = 3; }
      break;
    case 'slash':
      if (h.t <= 0) {
        if (d < reach + 14) {
          run.damageBoss(h.dmg);
          particles.spawn(boss.x, boss.y, { color: h.color, count: 5, speed: 130, life: 0.25 });
        }
        h.slashes--;
        if (h.slashes <= 0) { h.state = 'roll'; h.t = 0.42; h.iframes = 0.42; h.rollDir = toBoss + Math.PI + (chance(0.5) ? 0.7 : -0.7); }
        else h.t = 0.18;
      }
      break;
    case 'roll':
      h.x += Math.cos(h.rollDir) * 340 * dt;
      h.y += Math.sin(h.rollDir) * 340 * dt;
      if (h.t <= 0) { h.state = 'circle'; h.t = range(0.8, 1.5); h.strafeDir *= -1; }
      break;
    case 'circle':
      moveToward(h, boss.x + Math.cos(toBoss + Math.PI) * 180, boss.y + Math.sin(toBoss + Math.PI) * 180, dt, speedMul, 0.7);
      if (h.t <= 0) h.state = 'idle';
      break;
  }
}

// --- archer -----------------------------------------------------------------

function updateArcher(h, run, dt, d, toBoss, speedMul, W, H) {
  const boss = run.boss;
  const IDEAL = 360;
  switch (h.state) {
    case 'idle':
      if (d < IDEAL - 60) moveToward(h, boss.x + Math.cos(toBoss + Math.PI) * IDEAL, boss.y + Math.sin(toBoss + Math.PI) * IDEAL, dt, speedMul);
      else if (d > IDEAL + 80) moveToward(h, boss.x, boss.y, dt, speedMul);
      else { h.state = 'aim'; h.t = 0.65; }
      break;
    case 'aim':
      h.facing = angleTo(h.x, h.y, boss.x, boss.y);
      if (h.t <= 0) {
        sfx.arrow();
        bullets.spawnHero(h.x, h.y, h.facing, { speed: 480, dmg: h.dmg, color: h.color, arrow: true, r: 4 });
        h.state = 'cool'; h.t = range(1.0, 1.6);
      }
      break;
    case 'cool':
      // sidestep while cooling down
      moveToward(h, h.x + Math.cos(toBoss + Math.PI / 2) * 60 * h.strafeDir, h.y + Math.sin(toBoss + Math.PI / 2) * 60 * h.strafeDir, dt, speedMul, 0.5);
      if (h.t <= 0) { h.state = 'idle'; if (chance(0.4)) h.strafeDir *= -1; }
      break;
  }
}

// --- mage --------------------------------------------------------------------

function updateMage(h, run, dt, d, toBoss, speedMul, W, H) {
  const boss = run.boss;
  switch (h.state) {
    case 'idle':
      if (d < 240) moveToward(h, boss.x + Math.cos(toBoss + Math.PI) * 320, boss.y + Math.sin(toBoss + Math.PI) * 320, dt, speedMul);
      else if (h.t <= 0) {
        // telegraph an AoE on the boss's current position
        h.castX = boss.x; h.castY = boss.y;
        h.state = 'cast'; h.t = 1.05;
        sfx.magic();
      }
      break;
    case 'cast':
      if (h.t <= 0) {
        const R = 95;
        run.hazards.push({ type: 'magicblast', x: h.castX, y: h.castY, r: R, life: 0.3, maxLife: 0.3 });
        particles.spawn(h.castX, h.castY, { color: h.color, count: 26, speed: 260, life: 0.5, size: 3 });
        if (dist(boss.x, boss.y, h.castX, h.castY) < R + boss.radius * 0.5) run.damageBoss(h.dmg);
        h.state = 'idle'; h.t = range(2.6, 3.6);
      }
      break;
  }
}

// --- healer --------------------------------------------------------------------

function updateHealer(h, run, dt, d, toBoss, speedMul, W, H) {
  const boss = run.boss;
  // find most-wounded living ally
  let target = null, worst = 1;
  for (const o of run.heroes) {
    if (o === h || o.dead || o.entering) continue;
    const frac = o.hp / o.maxHp;
    if (frac < worst) { worst = frac; target = o; }
  }
  h.healTarget = null;
  if (d < 220) {
    // too close to the boss — run!
    moveToward(h, boss.x + Math.cos(toBoss + Math.PI) * 400, boss.y + Math.sin(toBoss + Math.PI) * 400, dt, speedMul * 1.15);
  } else if (target) {
    const dt2 = dist(h.x, h.y, target.x, target.y);
    if (dt2 > 240) moveToward(h, target.x, target.y, dt, speedMul);
    else if (worst < 1) {
      h.healTarget = target;
      target.hp = Math.min(target.maxHp, target.hp + 26 * dt);
      if (chance(dt * 4)) { sfx.heal(); particles.spawn(target.x, target.y, { color: PALETTE.heal, count: 2, speed: 40, life: 0.5, gravity: -60 }); }
    }
  } else {
    // last one standing: plink away sadly
    if (h.t <= 0) {
      h.t = 1.4;
      bullets.spawnHero(h.x, h.y, toBoss, { speed: 320, dmg: h.dmg, color: h.color, r: 4 });
    }
    if (d < 380) moveToward(h, boss.x + Math.cos(toBoss + Math.PI) * 420, boss.y + Math.sin(toBoss + Math.PI) * 420, dt, speedMul);
  }
}

// --- paladin (mini-boss hero) ------------------------------------------------

function updatePaladin(h, run, dt, d, toBoss, speedMul) {
  const boss = run.boss;
  // dodge roll if a boss bullet is closing in
  if (h.state !== 'roll' && h.iframes <= 0 && chance(dt * 1.2)) {
    for (const b of bullets.bossBullets) {
      if (dist(b.x, b.y, h.x, h.y) < 70) {
        h.state = 'roll'; h.t = 0.38; h.iframes = 0.38;
        h.rollDir = Math.atan2(b.vy, b.vx) + Math.PI / 2 * (chance(0.5) ? 1 : -1);
        break;
      }
    }
  }
  // emergency potion
  if (!h.potionUsed && h.hp < h.maxHp * 0.35) {
    h.potionUsed = true;
    h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.4);
    particles.spawn(h.x, h.y, { color: PALETTE.heal, count: 20, speed: 120, life: 0.7, gravity: -80 });
    run.banner(`${h.name} QUAFFS A POTION`, PALETTE.heal);
    sfx.heal();
  }
  const reach = boss.radius + 40;
  switch (h.state) {
    case 'roll':
      h.x += Math.cos(h.rollDir) * 330 * dt;
      h.y += Math.sin(h.rollDir) * 330 * dt;
      if (h.t <= 0) h.state = 'idle';
      break;
    case 'windup':
      if (h.t <= 0) {
        h.state = 'recover'; h.t = 0.5;
        if (d < reach + 12) {
          run.damageBoss(h.dmg);
          particles.spawn(boss.x, boss.y, { color: h.color, count: 12, speed: 200, life: 0.35 });
        }
      }
      break;
    case 'recover':
      if (h.t <= 0) h.state = 'idle';
      break;
    default:
      if (d > reach) moveToward(h, boss.x, boss.y, dt, speedMul);
      else { h.state = 'windup'; h.t = 0.4; }
  }
}

// --- rendering -----------------------------------------------------------------

export function drawHero(ctx, h, time) {
  if (h.dead) return;
  const flash = h.flash > 0;
  const col = flash ? '#ffffff' : h.color;
  const alpha = h.entering ? 0.5 : 1;

  ctx.save();
  ctx.globalAlpha = alpha;

  // roll ghosting
  if (h.iframes > 0) {
    ctx.globalAlpha = alpha * 0.5;
  }

  switch (h.type) {
    case 'knight': {
      glowCircle(ctx, h.x, h.y, h.radius * 0.9, col, 0.55);
      poly(ctx, h.x, h.y, h.radius, 4, h.facing + Math.PI / 4, col, { width: 2.5 });
      if (h.shielded) {
        ctx.strokeStyle = '#aef4ff'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius + 6, h.facing - 1.1, h.facing + 1.1);
        ctx.stroke();
      }
      if (h.state === 'windup') meleeTelegraph(ctx, h, time);
      break;
    }
    case 'rogue': {
      glowCircle(ctx, h.x, h.y, h.radius * 0.8, col, 0.5);
      poly(ctx, h.x, h.y, h.radius, 3, h.facing, col, { width: 2 });
      break;
    }
    case 'archer': {
      glowCircle(ctx, h.x, h.y, h.radius * 0.8, col, 0.5);
      poly(ctx, h.x, h.y, h.radius, 3, h.facing, col, { width: 2 });
      ring(ctx, h.x, h.y, h.radius + 4, col, 1, 0.5);
      if (h.state === 'aim') {
        // aim line telegraph
        ctx.strokeStyle = col; ctx.globalAlpha = 0.35 + 0.3 * Math.sin(time * 20);
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(h.x, h.y);
        ctx.lineTo(h.x + Math.cos(h.facing) * 700, h.y + Math.sin(h.facing) * 700);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = alpha;
      }
      break;
    }
    case 'mage': {
      glowCircle(ctx, h.x, h.y, h.radius * 0.8, col, 0.6);
      poly(ctx, h.x, h.y, h.radius, 5, time * 1.5, col, { width: 2 });
      if (h.state === 'cast') {
        const p = 1 - h.t / 1.05;
        ring(ctx, h.castX, h.castY, 95, '#b58cff', 2, 0.5);
        ring(ctx, h.castX, h.castY, 95 * p, '#e2ccff', 2.5, 0.8);
      }
      break;
    }
    case 'healer': {
      glowCircle(ctx, h.x, h.y, h.radius * 0.8, col, 0.6);
      ring(ctx, h.x, h.y, h.radius, col, 2);
      // cross
      ctx.strokeStyle = col; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(h.x - 5, h.y); ctx.lineTo(h.x + 5, h.y);
      ctx.moveTo(h.x, h.y - 5); ctx.lineTo(h.x, h.y + 5);
      ctx.stroke();
      if (h.healTarget) {
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = PALETTE.heal; ctx.lineWidth = 2;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.moveTo(h.x, h.y); ctx.lineTo(h.healTarget.x, h.healTarget.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;
    }
    case 'paladin': {
      glowCircle(ctx, h.x, h.y, h.radius, col, 0.8);
      poly(ctx, h.x, h.y, h.radius, 4, h.facing + Math.PI / 4, col, { width: 3 });
      poly(ctx, h.x, h.y, h.radius * 0.6, 4, -h.facing, col, { width: 1.5, alpha: 0.7 });
      if (h.state === 'windup') meleeTelegraph(ctx, h, time);
      text(ctx, h.name, h.x, h.y - h.radius - 24, { size: 12, color: col });
      break;
    }
  }

  // health bar (heroes have the health bars this time)
  if (!h.entering && h.hp < h.maxHp) {
    bar(ctx, h.x, h.y - h.radius - 12, h.type === 'paladin' ? 46 : 26, 4, h.hp / h.maxHp, col);
  }
  ctx.restore();
}

function meleeTelegraph(ctx, h, time) {
  ctx.save();
  ctx.globalAlpha = 0.3 + 0.25 * Math.sin(time * 24);
  ctx.strokeStyle = PALETTE.danger;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(h.x, h.y, h.radius + 26, h.facing - 0.8, h.facing + 0.8);
  ctx.stroke();
  ctx.restore();
}

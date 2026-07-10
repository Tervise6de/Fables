// Projectile pools for both sides, plus boss "wisp" minions (implemented
// as long-lived homing boss bullets with their own look).
import { TAU, dist2, angleTo, lerpAngle } from '../core/math.js';
import * as particles from '../render/particles.js';
import { PALETTE } from '../render/draw.js';

export const bossBullets = [];
export const heroBullets = [];
const MAX_BOSS = 700, MAX_HERO = 250;

export function clear() { bossBullets.length = 0; heroBullets.length = 0; }

export function spawnBoss(x, y, angle, opts = {}) {
  if (bossBullets.length >= MAX_BOSS) return null;
  const b = {
    x, y,
    vx: Math.cos(angle) * (opts.speed ?? 260),
    vy: Math.sin(angle) * (opts.speed ?? 260),
    r: opts.r ?? 6,
    dmg: opts.dmg ?? 10,
    life: opts.life ?? 3.2,
    color: opts.color ?? PALETTE.boss,
    pierce: opts.pierce ?? 0,
    homing: opts.homing ?? 0,       // rad/sec turn toward nearest hero
    split: opts.split ?? false,     // split into shards on expiry
    wisp: opts.wisp ?? false,       // minion visual + contact behavior
    crit: opts.crit ?? false,
    hitIds: null,                   // heroes already pierced (lazy Set)
    trail: opts.trail ?? false,
  };
  bossBullets.push(b);
  return b;
}

export function spawnHero(x, y, angle, opts = {}) {
  if (heroBullets.length >= MAX_HERO) return null;
  const b = {
    x, y,
    vx: Math.cos(angle) * (opts.speed ?? 330),
    vy: Math.sin(angle) * (opts.speed ?? 330),
    r: opts.r ?? 5,
    dmg: opts.dmg ?? 20,
    life: opts.life ?? 3,
    color: opts.color ?? PALETTE.hero,
    arrow: opts.arrow ?? false,
  };
  heroBullets.push(b);
  return b;
}

function nearestHero(heroes, x, y) {
  let best = null, bd = Infinity;
  for (const h of heroes) {
    if (h.dead || h.entering) continue;
    const d = dist2(x, y, h.x, h.y);
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}

export function update(dt, run, W, H) {
  // Boss bullets
  for (let i = bossBullets.length - 1; i >= 0; i--) {
    const b = bossBullets[i];
    b.life -= dt;
    if (b.homing > 0) {
      const t = nearestHero(run.heroes, b.x, b.y);
      if (t) {
        const cur = Math.atan2(b.vy, b.vx);
        const want = angleTo(b.x, b.y, t.x, t.y);
        const na = lerpAngle(cur, want, Math.min(1, b.homing * dt));
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    const out = b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30;
    if (b.life <= 0 || out) {
      if (b.split && !out) {
        const base = Math.atan2(b.vy, b.vx);
        for (let k = -1; k <= 1; k += 2) {
          spawnBoss(b.x, b.y, base + k * 0.5, { speed: 300, r: 4, dmg: b.dmg * 0.5, life: 0.9, color: b.color });
        }
        particles.spawn(b.x, b.y, { color: b.color, count: 4, speed: 90, life: 0.3, size: 2 });
      }
      bossBullets.splice(i, 1);
      continue;
    }
    if (b.trail) particles.spawn(b.x, b.y, { color: b.color, count: 1, speed: 10, life: 0.25, size: 2 });
  }

  // Hero bullets
  for (let i = heroBullets.length - 1; i >= 0; i--) {
    const b = heroBullets[i];
    b.life -= dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.life <= 0 || b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30) {
      heroBullets.splice(i, 1);
    }
  }
}

// Destroy hero projectiles inside a radius (slam / ultimate clears bullets).
export function clearHeroBulletsNear(x, y, radius) {
  let n = 0;
  for (let i = heroBullets.length - 1; i >= 0; i--) {
    const b = heroBullets[i];
    if (dist2(x, y, b.x, b.y) < radius * radius) {
      particles.spawn(b.x, b.y, { color: b.color, count: 3, speed: 80, life: 0.25, size: 2 });
      heroBullets.splice(i, 1);
      n++;
    }
  }
  return n;
}

export function draw(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of bossBullets) {
    if (b.wisp) {
      // wisps: flickering diamond
      const t = performance.now() / 90 + b.x;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      const r = b.r * (1 + Math.sin(t) * 0.25);
      ctx.moveTo(b.x, b.y - r); ctx.lineTo(b.x + r, b.y); ctx.lineTo(b.x, b.y + r); ctx.lineTo(b.x - r, b.y);
      ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.arc(b.x, b.y, r * 2, 0, TAU); ctx.fill();
    } else {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.9, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    }
  }
  for (const b of heroBullets) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.8, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    if (b.arrow) {
      const a = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(b.x, b.y); ctx.rotate(a);
      ctx.fillRect(-8, -1.5, 14, 3);
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

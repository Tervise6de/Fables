// Pooled particle system. One global pool is plenty for this game.
import { rand, range } from '../core/rng.js';

const MAX = 900;
const pool = [];
let count = 0;

// Pre-allocate.
for (let i = 0; i < MAX; i++) {
  pool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', drag: 0.9, gravity: 0, shrink: true });
}

export function spawn(x, y, { color = '#fff', speed = 120, spread = Math.PI * 2, angle = 0, count: n = 8, life = 0.5, size = 3, drag = 3, gravity = 0 } = {}) {
  for (let i = 0; i < n; i++) {
    if (count >= MAX) return;
    const p = pool[count++];
    const a = angle + (rand() - 0.5) * spread;
    const s = speed * range(0.35, 1);
    p.x = x; p.y = y;
    p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
    p.maxLife = life * range(0.6, 1.2);
    p.life = p.maxLife;
    p.size = size * range(0.6, 1.3);
    p.color = color;
    p.drag = drag;
    p.gravity = gravity;
  }
}

export function update(dt) {
  for (let i = count - 1; i >= 0; i--) {
    const p = pool[i];
    p.life -= dt;
    if (p.life <= 0) {
      count--;
      // swap-remove: copy the last live particle into this slot
      const last = pool[count];
      pool[count] = p;
      pool[i] = last;
      continue;
    }
    const d = Math.max(0, 1 - p.drag * dt);
    p.vx *= d; p.vy *= d;
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

export function draw(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const p = pool[i];
    const t = p.life / p.maxLife;
    ctx.globalAlpha = t * 0.9;
    ctx.fillStyle = p.color;
    const s = p.size * (0.4 + t * 0.6);
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.restore();
}

export function clear() { count = 0; }
export function activeCount() { return count; }

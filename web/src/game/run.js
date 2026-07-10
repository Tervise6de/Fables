// One run: wave flow, collisions, hazards, scoring, HUD. The scene layer
// (main.js) drives update() and reacts to the events it returns.
import { TAU, dist, dist2, angleTo, clamp } from '../core/math.js';
import { chance } from '../core/rng.js';
import * as input from '../core/input.js';
import * as bulletsMod from './bullets.js';
import * as particles from '../render/particles.js';
import * as camera from '../core/camera.js';
import { sfx, setIntensity } from '../audio/sound.js';
import { createBoss, updateBoss, drawBoss } from './boss.js';
import { updateHero, drawHero, heroCost } from './heroes.js';
import { buildSpawns, spawnFromDescriptor } from './waves.js';
import { isEvolutionWave, evolutionChoices } from './forms.js';
import { glowCircle, ring, text, bar, PALETTE } from '../render/draw.js';
import { get as getSave } from '../core/save.js';

export const W = 1280, H = 720;

export function newRun() {
  bulletsMod.clear();
  particles.clear();
  const run = {
    boss: createBoss(W / 2, H / 2),
    heroes: [],
    spawnQueue: [],
    hazards: [],
    motes: [],          // dread pickups flying to the boss
    numbers: [],        // floating damage numbers
    banners: [],
    wave: 0,
    waveClearT: 0,      // countdown between clear and pick screen
    betweenWaves: true,
    kills: 0,
    dread: 0,
    dreadMul: 1,
    heroSpeedMul: 1,
    mutations: [],      // mutation ids picked this run
    time: 0,
    over: false,

    banner(txt, color = PALETTE.white) {
      this.banners.push({ txt, color, life: 2.2, maxLife: 2.2 });
      if (this.banners.length > 2) this.banners.shift();
    },

    number(x, y, txt, color, size = 14) {
      if (this.numbers.length > 60) this.numbers.shift();
      this.numbers.push({ x: x + (Math.random() - 0.5) * 18, y, txt, color, size, life: 0.8 });
    },

    damageBoss(dmg) {
      this.boss.hurt(dmg, this);
    },

    damageHero(h, dmg, crit) {
      if (h.dead || h.entering) return;
      h.hp -= dmg;
      h.flash = 0.1;
      sfx.heroHit();
      this.number(h.x, h.y - h.radius - 16, String(Math.round(dmg)), crit ? PALETTE.gold : PALETTE.white, crit ? 18 : 13);
      this.boss.ultCharge = Math.min(1, this.boss.ultCharge + (dmg / 700) * this.boss.stats.ultRate);
      if (h.hp <= 0) this.killHero(h);
    },

    killHero(h) {
      if (h.dead) return;
      h.dead = true;
      this.kills++;
      camera.shake(0.12);
      camera.stop(0.02);
      sfx.heroDie();
      particles.spawn(h.x, h.y, { color: h.color, count: 22, speed: 260, life: 0.6, size: 3 });
      if (this.boss.stats.lifesteal > 0) {
        this.boss.heal(this.boss.stats.lifesteal);
        this.number(this.boss.x, this.boss.y - this.boss.radius - 14, '+' + this.boss.stats.lifesteal, PALETTE.heal);
      }
      const amount = Math.round(heroCost(h.type) * 2 * this.dreadMul);
      this.motes.push({ x: h.x, y: h.y, vx: 0, vy: 0, amount, t: 0.4 });
      if (h.type === 'paladin') this.banner(`${h.name} HAS FALLEN`, h.color);
    },
  };
  return run;
}

export function startNextWave(run) {
  run.wave++;
  run.betweenWaves = false;
  run.spawnQueue = buildSpawns(run.wave, W, H);
  run.banner(`WAVE ${run.wave} — ${partyLabel(run.spawnQueue.length)}`, PALETTE.hero);
  sfx.waveStart();
  setIntensity(Math.min(1, run.wave / 12));
}

function partyLabel(n) {
  if (n <= 2) return 'SCOUTING PARTY';
  if (n <= 4) return 'A BOLD PARTY APPROACHES';
  if (n <= 6) return 'A FULL RAID PARTY';
  return 'A DESPERATE ARMY';
}

// Returns 'pick' | 'evolve' | 'dead' | null
export function update(run, dt) {
  run.time += dt;

  // spawn queue
  for (const s of run.spawnQueue) s.delay -= dt;
  while (run.spawnQueue.length && run.spawnQueue[0].delay <= 0) {
    run.heroes.push(spawnFromDescriptor(run.spawnQueue.shift()));
  }

  updateBoss(run.boss, run, dt, W, H);

  for (const h of run.heroes) {
    if (!h.dead) updateHero(h, run, dt, W, H);
  }
  // prune dead heroes occasionally
  if (run.heroes.length > 24) run.heroes = run.heroes.filter((h) => !h.dead);

  bulletsMod.update(dt, run, W, H);
  collide(run, dt);
  updateHazards(run, dt);
  updateMotes(run, dt);

  // floating numbers & banners
  for (let i = run.numbers.length - 1; i >= 0; i--) {
    const n = run.numbers[i];
    n.life -= dt; n.y -= 34 * dt;
    if (n.life <= 0) run.numbers.splice(i, 1);
  }
  for (let i = run.banners.length - 1; i >= 0; i--) {
    const b = run.banners[i];
    b.life -= dt;
    if (b.life <= 0) run.banners.splice(i, 1);
  }

  particles.update(dt);
  camera.update(dt);

  if (run.boss.dead && !run.over) {
    run.over = true;
    sfx.death();
    camera.shake(1);
    particles.spawn(run.boss.x, run.boss.y, { color: run.boss.form.color, count: 120, speed: 480, life: 1.4, size: 5 });
    return 'dead';
  }
  if (run.over) return null;

  // wave clear?
  const anyAlive = run.heroes.some((h) => !h.dead);
  if (!run.betweenWaves && !anyAlive && run.spawnQueue.length === 0) {
    run.betweenWaves = true;
    run.waveClearT = 0.9;
    const bonus = Math.round(run.wave * 2 * run.dreadMul);
    run.dread += bonus;
    run.banner(`WAVE ${run.wave} WIPED — +${bonus} DREAD`, PALETTE.gold);
  }
  if (run.betweenWaves && run.wave > 0 && run.waveClearT > 0) {
    run.waveClearT -= dt;
    if (run.waveClearT <= 0) {
      const evolving = isEvolutionWave(run.wave) && evolutionChoices(run.boss.form).length > 0;
      return evolving ? 'evolve' : 'pick';
    }
  }
  return null;
}

// ---- collisions -----------------------------------------------------------

function collide(run, dt) {
  const boss = run.boss;
  const bb = bulletsMod.bossBullets;
  const hb = bulletsMod.heroBullets;

  // boss bullets vs heroes
  for (let i = bb.length - 1; i >= 0; i--) {
    const b = bb[i];
    for (const h of run.heroes) {
      if (h.dead || h.entering || h.iframes > 0) continue;
      if (b.hitIds && b.hitIds.has(h)) continue;
      const rr = b.r + h.radius;
      if (dist2(b.x, b.y, h.x, h.y) < rr * rr) {
        // knight shield blocks frontal non-wisp projectiles
        if (h.shielded && !b.wisp) {
          const inc = angleTo(h.x, h.y, b.x, b.y);
          let diff = Math.abs(((inc - h.facing) % TAU + TAU) % TAU);
          if (diff > Math.PI) diff = TAU - diff;
          if (diff < 1.15) {
            particles.spawn(b.x, b.y, { color: '#aef4ff', count: 5, speed: 120, life: 0.25 });
            run.number(h.x, h.y - h.radius - 16, 'BLOCK', '#aef4ff', 11);
            bb.splice(i, 1);
            break;
          }
        }
        run.damageHero(h, b.dmg, b.crit);
        if (b.wisp) { // wisps detonate on contact
          particles.spawn(b.x, b.y, { color: b.color, count: 10, speed: 180, life: 0.4 });
          bb.splice(i, 1);
          break;
        }
        if (b.pierce > 0) {
          b.pierce--;
          (b.hitIds ??= new Set()).add(h);
        } else {
          bb.splice(i, 1);
          break;
        }
      }
    }
  }

  // hero bullets vs boss
  for (let i = hb.length - 1; i >= 0; i--) {
    const b = hb[i];
    const rr = b.r + boss.radius * 0.85;
    if (!boss.dead && dist2(b.x, b.y, boss.x, boss.y) < rr * rr) {
      run.damageBoss(b.dmg);
      hb.splice(i, 1);
    }
  }

  // contact: thorns + body push
  for (const h of run.heroes) {
    if (h.dead || h.entering) continue;
    const d = dist(h.x, h.y, boss.x, boss.y);
    const min = h.radius + boss.radius;
    if (d < min + 4) {
      if (boss.stats.thorns > 0) {
        h.thornAcc = (h.thornAcc || 0) + boss.stats.thorns * boss.stats.damageMul * dt;
        if (h.thornAcc >= 6) { run.damageHero(h, h.thornAcc, false); h.thornAcc = 0; }
      }
      // push hero out of the boss body
      const a = angleTo(boss.x, boss.y, h.x, h.y);
      const push = (min + 4 - d);
      h.x += Math.cos(a) * push;
      h.y += Math.sin(a) * push;
    }
  }
}

// ---- hazards ---------------------------------------------------------------

function updateHazards(run, dt) {
  const boss = run.boss;
  for (let i = run.hazards.length - 1; i >= 0; i--) {
    const hz = run.hazards[i];
    switch (hz.type) {
      case 'slamring':
      case 'magicblast':
        hz.life -= dt;
        if (hz.life <= 0) run.hazards.splice(i, 1);
        break;
      case 'burnring': {
        hz.life -= dt;
        for (const h of run.heroes) {
          if (h.dead || h.entering) continue;
          if (Math.abs(dist(h.x, h.y, hz.x, hz.y) - hz.r) < 26) {
            h.burnAcc = (h.burnAcc || 0) + hz.dps * dt;
            if (h.burnAcc >= 8) { run.damageHero(h, h.burnAcc, false); h.burnAcc = 0; }
          }
        }
        if (chance(dt * 20)) {
          const a = Math.random() * TAU;
          particles.spawn(hz.x + Math.cos(a) * hz.r, hz.y + Math.sin(a) * hz.r,
            { color: PALETTE.danger, count: 1, speed: 30, life: 0.5, gravity: -70 });
        }
        if (hz.life <= 0) run.hazards.splice(i, 1);
        break;
      }
      case 'flame': {
        hz.angle += dt * 2.4;
        hz.px = boss.x + Math.cos(hz.angle) * (boss.radius + hz.dist);
        hz.py = boss.y + Math.sin(hz.angle) * (boss.radius + hz.dist);
        for (const h of run.heroes) {
          if (h.dead || h.entering) continue;
          if (dist(h.x, h.y, hz.px, hz.py) < hz.r + h.radius) {
            h.flameAcc = (h.flameAcc || 0) + hz.dps * boss.stats.damageMul * dt;
            if (h.flameAcc >= 7) { run.damageHero(h, h.flameAcc, false); h.flameAcc = 0; }
          }
        }
        if (chance(dt * 30)) particles.spawn(hz.px, hz.py, { color: PALETTE.danger, count: 1, speed: 40, life: 0.4, gravity: -80 });
        break;
      }
      case 'shockwave': {
        if (hz.delay > 0) { hz.delay -= dt; break; }
        hz.r += hz.speed * dt;
        for (const h of run.heroes) {
          if (h.dead || h.entering || hz.hit.has(h)) continue;
          if (Math.abs(dist(h.x, h.y, hz.x, hz.y) - hz.r) < 34) {
            hz.hit.add(h);
            run.damageHero(h, hz.dmg, false);
            const a = angleTo(hz.x, hz.y, h.x, h.y);
            h.kbx += Math.cos(a) * 300; h.kby += Math.sin(a) * 300;
          }
        }
        bulletsMod.clearHeroBulletsNear(hz.x, hz.y, hz.r * 0.2 + 40);
        if (hz.r > 950) run.hazards.splice(i, 1);
        break;
      }
    }
  }
}

function updateMotes(run, dt) {
  const boss = run.boss;
  for (let i = run.motes.length - 1; i >= 0; i--) {
    const m = run.motes[i];
    m.t -= dt;
    if (m.t <= 0) {
      const a = angleTo(m.x, m.y, boss.x, boss.y);
      const sp = 620;
      m.x += Math.cos(a) * sp * dt;
      m.y += Math.sin(a) * sp * dt;
      if (dist(m.x, m.y, boss.x, boss.y) < boss.radius + 8) {
        run.dread += m.amount;
        sfx.pickup();
        run.number(boss.x, boss.y - boss.radius - 26, `+${m.amount} DREAD`, PALETTE.gold, 12);
        run.motes.splice(i, 1);
      }
    }
  }
}

// ---- drawing ----------------------------------------------------------------

export function draw(ctx, run, time) {
  drawArena(ctx, time);

  // hazards under entities
  for (const hz of run.hazards) {
    if (hz.type === 'slamring') {
      const p = 1 - hz.life / hz.maxLife;
      ring(ctx, hz.x, hz.y, hz.r + (hz.maxR - hz.r) * p, PALETTE.white, 4 * (1 - p) + 1, 1 - p * 0.7);
    } else if (hz.type === 'magicblast') {
      const p = 1 - hz.life / hz.maxLife;
      glowCircle(ctx, hz.x, hz.y, hz.r * (0.6 + p * 0.4), '#b58cff', (1 - p) * 0.8);
    } else if (hz.type === 'burnring') {
      ring(ctx, hz.x, hz.y, hz.r, PALETTE.danger, 5, 0.25 + 0.1 * Math.sin(time * 8));
      ring(ctx, hz.x, hz.y, hz.r, '#ffb14d', 2, 0.5);
    } else if (hz.type === 'flame') {
      glowCircle(ctx, hz.px ?? run.boss.x, hz.py ?? run.boss.y, hz.r, PALETTE.danger, 0.9);
    } else if (hz.type === 'shockwave' && hz.delay <= 0) {
      ring(ctx, hz.x, hz.y, hz.r, run.boss.form.color, 6, clamp(1 - hz.r / 950, 0, 1));
    }
  }

  // dread motes
  for (const m of run.motes) {
    glowCircle(ctx, m.x, m.y, 4, PALETTE.gold, 0.9);
  }

  for (const h of run.heroes) drawHero(ctx, h, time);
  bulletsMod.draw(ctx);
  drawBoss(ctx, run.boss, time);
  particles.draw(ctx);

  // floating numbers
  for (const n of run.numbers) {
    text(ctx, n.txt, n.x, n.y, { size: n.size, color: n.color, alpha: Math.min(1, n.life * 2.5) });
  }

  drawHUD(ctx, run, time);

  // banners
  let by = 170;
  for (const b of run.banners) {
    const a = Math.min(1, b.life * 1.5) * Math.min(1, (b.maxLife - b.life) * 6 + 0.1);
    text(ctx, b.txt, W / 2, by, { size: 26, color: b.color, alpha: a, glow: b.color });
    by += 36;
  }
}

function drawArena(ctx, time) {
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, W, H);
  // faint grid
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 64) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += 64) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  // center sigil (very faint)
  ring(ctx, W / 2, H / 2, 230 + Math.sin(time * 0.4) * 8, '#a86bff', 2, 0.07);
  ring(ctx, W / 2, H / 2, 160, '#a86bff', 1.5, 0.05);
  // walls
  ctx.strokeStyle = 'rgba(160, 90, 255, 0.35)';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  // gates
  ctx.strokeStyle = 'rgba(55, 226, 255, 0.5)';
  ctx.lineWidth = 4;
  const g = 60;
  ctx.beginPath();
  ctx.moveTo(W / 2 - g / 2, 6); ctx.lineTo(W / 2 + g / 2, 6);
  ctx.moveTo(W / 2 - g / 2, H - 6); ctx.lineTo(W / 2 + g / 2, H - 6);
  ctx.moveTo(6, H / 2 - g / 2); ctx.lineTo(6, H / 2 + g / 2);
  ctx.moveTo(W - 6, H / 2 - g / 2); ctx.lineTo(W - 6, H / 2 + g / 2);
  ctx.stroke();
}

function drawHUD(ctx, run, time) {
  const boss = run.boss;
  // THE boss bar — you get the boss bar this time.
  const bw = 620, bx = W / 2 - bw / 2, byy = 34;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(bx - 4, byy - 4, bw + 8, 26);
  const frac = clamp(boss.hp / boss.maxHp, 0, 1);
  const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  grad.addColorStop(0, boss.form.color);
  grad.addColorStop(1, '#7c1f66');
  ctx.fillStyle = grad;
  ctx.fillRect(bx, byy, bw * frac, 18);
  // phase notches at 66% / 33%
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(bx + bw * 0.66 - 1, byy - 2, 2, 22);
  ctx.fillRect(bx + bw * 0.33 - 1, byy - 2, 2, 22);
  ctx.strokeStyle = boss.form.color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx - 4, byy - 4, bw + 8, 26);
  ctx.restore();
  text(ctx, boss.form.name, W / 2, byy - 14, { size: 14, color: boss.form.color, glow: boss.form.color });
  text(ctx, `${Math.ceil(boss.hp)} / ${boss.maxHp}`, W / 2, byy + 9, { size: 11, color: PALETTE.white, alpha: 0.9 });

  // wave + kills, top right
  text(ctx, `WAVE ${run.wave}`, W - 90, 24, { size: 20, color: PALETTE.hero, align: 'center' });
  text(ctx, `${run.kills} SLAIN`, W - 90, 46, { size: 12, color: PALETTE.white, alpha: 0.7 });
  // dread top left
  text(ctx, `DREAD ${run.dread}`, 90, 24, { size: 16, color: PALETTE.gold });

  // slam + ult meters bottom left
  const mx = 24, my = H - 30;
  const slamFrac = 1 - boss.slamCd / boss.stats.slamCooldown;
  bar(ctx, mx + 60, my - 6, 120, 10, clamp(slamFrac, 0, 1), slamFrac >= 1 ? PALETTE.white : 'rgba(255,255,255,0.45)');
  text(ctx, 'SLAM [SPC]', mx + 60, my - 16, { size: 10, color: PALETTE.white, alpha: 0.7 });
  bar(ctx, mx + 220, my - 6, 120, 10, boss.ultCharge, boss.ultCharge >= 1 ? PALETTE.gold : 'rgba(255,201,77,0.5)');
  text(ctx, `${boss.form.ult.name.toUpperCase()} [Q]`, mx + 220, my - 16, { size: 10, color: PALETTE.gold, alpha: 0.8 });
  if (boss.ultCharge >= 1 && Math.sin(time * 8) > 0) {
    text(ctx, 'READY', mx + 220, my + 12, { size: 11, color: PALETTE.gold, glow: PALETTE.gold });
  }
}

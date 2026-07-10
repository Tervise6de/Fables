// Full-screen states: title, pause, death, and the mutation/evolution pick.
// Simple immediate-mode buttons driven by the shared input module.
import { clamp } from '../core/math.js';
import * as input from '../core/input.js';
import { text, ring, sigil, glowCircle, PALETTE } from '../render/draw.js';
import { get as getSave, save as persist } from '../core/save.js';
import { UNLOCKS } from '../game/mutations.js';
import { sfx, setVolume, setMusicVolume } from '../audio/sound.js';
import { setShakeEnabled } from '../core/camera.js';

const W = 1280, H = 720;

// Immediate-mode button; returns true when clicked this frame.
export function button(ctx, x, y, w, h, label, { size = 18, color = PALETTE.boss, hotkey = null } = {}) {
  const m = input.mouse;
  const hover = m.x > x - w / 2 && m.x < x + w / 2 && m.y > y - h / 2 && m.y < y + h / 2;
  ctx.save();
  ctx.globalAlpha = hover ? 1 : 0.75;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = hover ? 2.5 : 1.5;
  ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  ctx.restore();
  text(ctx, label, x, y, { size, color: hover ? '#fff' : color, glow: hover ? color : null });
  const clicked = (hover && input.mouse.clicked) || (hotkey && input.pressed(hotkey));
  if (clicked) sfx.click();
  return clicked;
}

// ---- title -------------------------------------------------------------

// Returns 'start' or null.
export function drawTitle(ctx, time) {
  const s = getSave();
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, W, H);

  // slow occult backdrop
  sigil(ctx, W / 2, H / 2 - 40, 190 + Math.sin(time * 0.5) * 6, time * 0.12, '#5a2a9c', 0.35);
  sigil(ctx, W / 2, H / 2 - 40, 260, -time * 0.07, '#3c1d6e', 0.22);
  glowCircle(ctx, W / 2, H / 2 - 40, 40 + Math.sin(time * 2) * 4, PALETTE.boss, 0.7);

  text(ctx, 'F I N A L   F O R M', W / 2, 150, { size: 64, color: PALETTE.boss, glow: PALETTE.boss });
  text(ctx, 'YOU ARE THE BOSS FIGHT', W / 2, 205, { size: 20, color: PALETTE.hero, alpha: 0.9 });

  let action = null;
  if (button(ctx, W / 2, 400, 320, 54, 'RAISE THE BOSS', { size: 24, hotkey: 'Enter' })) action = 'start';

  // settings row
  const volPct = Math.round(s.settings.volume * 100);
  const musPct = Math.round(s.settings.music * 100);
  const cycle = (v) => ((Math.round(v * 10) + 2) % 12) / 10; // 0 → .2 → … → 1 → 0
  if (button(ctx, W / 2 - 220, 480, 180, 36, `SFX ${volPct}%`, { size: 13, color: PALETTE.white })) {
    s.settings.volume = clamp(cycle(s.settings.volume), 0, 1);
    setVolume(s.settings.volume); persist();
  }
  if (button(ctx, W / 2, 480, 180, 36, `MUSIC ${musPct}%`, { size: 13, color: PALETTE.white })) {
    s.settings.music = clamp(cycle(s.settings.music), 0, 1);
    setMusicVolume(s.settings.music); persist();
  }
  if (button(ctx, W / 2 + 220, 480, 180, 36, `SHAKE ${s.settings.shake ? 'ON' : 'OFF'}`, { size: 13, color: PALETTE.white })) {
    s.settings.shake = !s.settings.shake;
    setShakeEnabled(s.settings.shake);
    persist();
  }

  // stats + unlocks
  text(ctx, `LIFETIME DREAD ${s.dread}   ·   BEST WAVE ${s.bestWave}   ·   HEROES SLAIN ${s.totalKills}`, W / 2, 545, { size: 13, color: PALETTE.gold, alpha: 0.85 });
  let ux = W / 2 - ((UNLOCKS.length - 1) * 150) / 2;
  for (const u of UNLOCKS) {
    const got = s.unlocked.includes(u.id);
    text(ctx, got ? u.name : `${u.name} (${u.at})`, ux, 585, { size: 10, color: got ? PALETTE.heal : 'rgba(255,255,255,0.35)' });
    ux += 150;
  }

  text(ctx, 'WASD move · MOUSE aim · HOLD LMB unleash pattern · SPACE slam · Q ultimate · ESC pause', W / 2, 650, { size: 13, color: PALETTE.white, alpha: 0.55 });
  return action;
}

// ---- pick screens ---------------------------------------------------------

// options: array of {name, desc, tag?, cursed?, color?}; returns index or -1.
export function drawPick(ctx, time, title, options, accent) {
  ctx.fillStyle = 'rgba(3, 2, 10, 0.82)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, title, W / 2, 130, { size: 34, color: accent, glow: accent });
  text(ctx, 'choose one', W / 2, 168, { size: 14, color: PALETTE.white, alpha: 0.6 });

  const n = options.length;
  const cw = 300, ch = 260;
  const totalW = n * cw + (n - 1) * 40;
  let picked = -1;
  for (let i = 0; i < n; i++) {
    const x = W / 2 - totalW / 2 + i * (cw + 40) + cw / 2;
    const y = H / 2 + 40;
    const o = options[i];
    const col = o.cursed ? PALETTE.danger : (o.color ?? accent);
    const m = input.mouse;
    const hover = m.x > x - cw / 2 && m.x < x + cw / 2 && m.y > y - ch / 2 && m.y < y + ch / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(8, 5, 22, 0.95)';
    ctx.fillRect(x - cw / 2, y - ch / 2, cw, ch);
    ctx.strokeStyle = col;
    ctx.lineWidth = hover ? 3 : 1.5;
    ctx.strokeRect(x - cw / 2, y - ch / 2, cw, ch);
    if (hover) {
      ctx.strokeStyle = col; ctx.globalAlpha = 0.25;
      ctx.strokeRect(x - cw / 2 - 5, y - ch / 2 - 5, cw + 10, ch + 10);
    }
    ctx.restore();

    sigil(ctx, x, y - 55, 42, time * (0.4 + i * 0.13), col, hover ? 0.9 : 0.5);
    text(ctx, `[${i + 1}]`, x, y - ch / 2 + 22, { size: 13, color: PALETTE.white, alpha: 0.5 });
    text(ctx, o.name, x, y + 20, { size: 17, color: col, glow: hover ? col : null });
    wrapText(ctx, o.desc, x, y + 55, cw - 40, 13);
    if (o.tag) text(ctx, o.tag.toUpperCase(), x, y + ch / 2 - 20, { size: 10, color: PALETTE.white, alpha: 0.4 });

    if ((hover && input.mouse.clicked) || input.pressed('Digit' + (i + 1))) picked = i;
  }
  if (picked >= 0) sfx.choose();
  return picked;
}

function wrapText(ctx, str, x, y, maxW, size) {
  ctx.save();
  ctx.font = `${size}px 'Courier New', monospace`;
  const words = str.split(' ');
  let line = '', lines = [];
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW) { lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);
  ctx.restore();
  lines.forEach((l, i) => text(ctx, l, x, y + i * (size + 5), { size, color: PALETTE.white, alpha: 0.85, bold: false }));
}

// ---- pause ------------------------------------------------------------------

// Returns 'resume' | 'quit' | null.
export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(3, 2, 10, 0.7)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, 'PAUSED', W / 2, 220, { size: 42, color: PALETTE.boss, glow: PALETTE.boss });
  let action = null;
  if (button(ctx, W / 2, 330, 260, 48, 'RESUME', { size: 20, hotkey: 'Escape' })) action = 'resume';
  if (button(ctx, W / 2, 400, 260, 48, 'ABANDON RUN', { size: 16, color: PALETTE.danger })) action = 'quit';
  text(ctx, 'WASD move · MOUSE aim · HOLD LMB fire · SPACE slam · Q ultimate', W / 2, 500, { size: 13, color: PALETTE.white, alpha: 0.55 });
  return action;
}

// ---- death ---------------------------------------------------------------------

// Returns 'again' | 'title' | null.
export function drawDeath(ctx, time, stats) {
  ctx.fillStyle = 'rgba(3, 2, 10, 0.88)';
  ctx.fillRect(0, 0, W, H);
  sigil(ctx, W / 2, 200, 90, time * 0.2, PALETTE.danger, 0.4);
  text(ctx, 'THE BOSS HAS FALLEN', W / 2, 160, { size: 40, color: PALETTE.danger, glow: PALETTE.danger });
  text(ctx, 'they will sing of the party that felled you', W / 2, 205, { size: 15, color: PALETTE.white, alpha: 0.6, bold: false });

  text(ctx, `WAVES WIPED  ${stats.wave - 1}`, W / 2, 290, { size: 22, color: PALETTE.hero });
  text(ctx, `HEROES SLAIN  ${stats.kills}`, W / 2, 325, { size: 22, color: PALETTE.hero });
  text(ctx, `DREAD CLAIMED  +${stats.dread}`, W / 2, 360, { size: 22, color: PALETTE.gold });
  if (stats.newBest) text(ctx, '— NEW BEST —', W / 2, 395, { size: 15, color: PALETTE.gold, glow: PALETTE.gold });

  let uy = 435;
  for (const u of stats.newUnlocks) {
    text(ctx, `UNLOCKED: ${u.name} — ${u.desc}`, W / 2, uy, { size: 14, color: PALETTE.heal, glow: PALETTE.heal });
    uy += 26;
  }

  let action = null;
  if (button(ctx, W / 2 - 150, 560, 260, 50, 'RISE AGAIN', { size: 20, hotkey: 'Enter' })) action = 'again';
  if (button(ctx, W / 2 + 150, 560, 260, 50, 'RETURN TO LAIR', { size: 16, color: PALETTE.white })) action = 'title';
  return action;
}

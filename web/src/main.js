// Bootstrap: fixed-timestep loop, state machine, canvas scaling, test API.
// URL flags: ?seed=N (deterministic RNG) ?fast=N (timescale) ?auto=1 (autopilot bot)
import * as input from './core/input.js';
import * as rng from './core/rng.js';
import * as camera from './core/camera.js';
import * as saveMod from './core/save.js';
import * as sound from './audio/sound.js';
import * as particles from './render/particles.js';
import { newRun, startNextWave, update as updateRun, draw as drawRun, W, H } from './game/run.js';
import { dealMutations, MUTATIONS, checkUnlocks } from './game/mutations.js';
import { evolutionChoices } from './game/forms.js';
import { drawTitle, drawPick, drawPause, drawDeath } from './ui/screens.js';
import { updateAutopilot } from './autopilot.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
if (params.has('seed')) rng.seed(parseInt(params.get('seed'), 10) || 1);
const timescale = parseFloat(params.get('fast') || '1') || 1;
const autopilot = params.get('auto') === '1';

const save = saveMod.load();
camera.setShakeEnabled(save.settings.shake);
sound.setVolume(save.settings.volume);
sound.setMusicVolume(save.settings.music);

// ---- state machine ----------------------------------------------------------

const game = {
  state: 'title', // title | run | pick | evolve | pause | dead
  run: null,
  pickOptions: [],
  pickKind: 'mutation',
  deathStats: null,
  time: 0,
};

function startRun() {
  game.run = newRun();
  game.state = 'run';
  // AWAKENED unlock: free mutation pick before wave 1.
  if (save.unlocked.includes('headstart')) {
    offerMutations();
  } else {
    startNextWave(game.run);
  }
}

function offerMutations() {
  game.pickOptions = dealMutations(game.run);
  if (game.pickOptions.length === 0) { startNextWave(game.run); return; }
  game.pickKind = 'mutation';
  game.state = 'pick';
}

function offerEvolution() {
  const choices = evolutionChoices(game.run.boss.form);
  if (choices.length === 0) { offerMutations(); return; }
  game.pickOptions = choices.map((f) => ({ name: f.name, desc: f.desc + '  ULT: ' + f.ult.desc, color: f.color, tag: 'evolution', form: f }));
  game.pickKind = 'evolve';
  game.state = 'pick';
}

function applyPick(i) {
  const o = game.pickOptions[i];
  if (game.pickKind === 'evolve') {
    game.run.boss.setForm(o.form);
    game.run.banner(`YOU HAVE BECOME ${o.form.name}`, o.form.color);
  } else {
    o.apply(game.run.boss.stats, game.run.boss, game.run);
    game.run.mutations.push(o.id);
    game.run.banner(o.name, o.cursed ? '#ff5346' : '#e239b7');
  }
  game.state = 'run';
  startNextWave(game.run);
}

function onDeath() {
  const run = game.run;
  const newBest = run.wave - 1 > save.bestWave;
  save.bestWave = Math.max(save.bestWave, run.wave - 1);
  save.bestKills = Math.max(save.bestKills, run.kills);
  save.totalRuns += 1;
  save.totalKills += run.kills;
  save.dread += run.dread;
  const newUnlocks = checkUnlocks(save);
  saveMod.save();
  game.deathStats = { wave: run.wave, kills: run.kills, dread: run.dread, newBest, newUnlocks };
  game.state = 'dead';
  console.log('[PLAYTEST]', JSON.stringify({ event: 'death', wave: run.wave, kills: run.kills, dread: run.dread, time: Math.round(run.time) }));
}

// ---- fixed-timestep loop ------------------------------------------------------

const STEP = 1 / 60;
let acc = 0;
let last = performance.now();
let audioStarted = false;

function ensureAudio() {
  if (!audioStarted) { sound.init(); audioStarted = true; }
  sound.resume();
}
window.addEventListener('pointerdown', ensureAudio);
window.addEventListener('keydown', ensureAudio);

function tick(dtRaw) {
  const dt = camera.consume(dtRaw);
  game.time += dtRaw;

  if (autopilot) updateAutopilot(game, save);

  switch (game.state) {
    case 'run': {
      if (input.pressed('Escape')) { game.state = 'pause'; break; }
      const ev = dt > 0 ? updateRun(game.run, dt) : null;
      if (ev === 'pick') {
        console.log('[PLAYTEST]', JSON.stringify({ event: 'waveClear', wave: game.run.wave, hp: Math.round(game.run.boss.hp), kills: game.run.kills, time: Math.round(game.run.time) }));
        offerMutations();
      } else if (ev === 'evolve') {
        console.log('[PLAYTEST]', JSON.stringify({ event: 'waveClear', wave: game.run.wave, hp: Math.round(game.run.boss.hp), kills: game.run.kills, time: Math.round(game.run.time) }));
        offerEvolution();
      } else if (ev === 'dead') onDeath();
      break;
    }
    case 'dead':
      // let the death particles keep playing behind the overlay
      particles.update(dt);
      camera.update(dt);
      break;
    default:
      break;
  }
  sound.updateMusic(dtRaw);
}

function render() {
  const off = camera.offset();
  ctx.save();
  ctx.translate(off.x, off.y);
  if (off.r) { ctx.translate(W / 2, H / 2); ctx.rotate(off.r); ctx.translate(-W / 2, -H / 2); }

  switch (game.state) {
    case 'title': {
      const a = drawTitle(ctx, game.time);
      if (a === 'start') { ensureAudio(); startRun(); }
      break;
    }
    case 'run':
      drawRun(ctx, game.run, game.time);
      break;
    case 'pick': {
      drawRun(ctx, game.run, game.time);
      const title = game.pickKind === 'evolve' ? 'E V O L V E' : 'M U T A T E';
      const accent = game.pickKind === 'evolve' ? game.run.boss.form.color : '#e239b7';
      const i = drawPick(ctx, game.time, title, game.pickOptions, accent);
      if (i >= 0) applyPick(i);
      break;
    }
    case 'pause': {
      drawRun(ctx, game.run, game.time);
      const a = drawPause(ctx);
      if (a === 'resume') game.state = 'run';
      else if (a === 'quit') { game.state = 'title'; game.run = null; }
      break;
    }
    case 'dead': {
      if (game.run) drawRun(ctx, game.run, game.time);
      const a = drawDeath(ctx, game.time, game.deathStats);
      if (a === 'again') startRun();
      else if (a === 'title') { game.state = 'title'; game.run = null; }
      break;
    }
  }
  ctx.restore();
}

function frame(now) {
  let dt = Math.min(0.1, (now - last) / 1000) * timescale;
  last = now;
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 12) {
    tick(STEP);
    acc -= STEP;
    steps++;
  }
  if (steps === 12) acc = 0; // don't spiral after a long tab-out
  render();
  // Clear one-frame input (clicks/pressed) only after BOTH sim and UI ran,
  // since immediate-mode buttons are hit-tested during render.
  input.endFrame();
  requestAnimationFrame(frame);
}

// ---- canvas scaling ------------------------------------------------------------

function fit() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = `${Math.floor(W * s)}px`;
  canvas.style.height = `${Math.floor(H * s)}px`;
}
window.addEventListener('resize', fit);
fit();

input.init(canvas);
requestAnimationFrame((n) => { last = n; requestAnimationFrame(frame); });

// ---- test API --------------------------------------------------------------------

window.__FF = {
  version: 1,
  game,
  input,
  startRun,
  get run() { return game.run; },
  state: () => game.state,
  snapshot: () => ({
    state: game.state,
    wave: game.run?.wave ?? 0,
    hp: game.run ? Math.round(game.run.boss.hp) : 0,
    maxHp: game.run?.boss.maxHp ?? 0,
    kills: game.run?.kills ?? 0,
    heroes: game.run ? game.run.heroes.filter((h) => !h.dead).length : 0,
    dread: game.run?.dread ?? 0,
    form: game.run?.boss.form.id ?? null,
    mutations: game.run ? [...game.run.mutations] : [],
    over: game.run?.over ?? false,
  }),
};
console.log('[FF] FINAL FORM booted', { autopilot, timescale });

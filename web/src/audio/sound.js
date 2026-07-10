// Procedural audio: synthesized SFX + an adaptive dark-synth drone.
// Everything is generated — no audio assets. All calls are safe before
// init (they just no-op), and init must follow a user gesture.

let ctx = null;
let master = null, sfxGain = null, musicGain = null;
let volume = 0.7, musicVolume = 0.7;

// Music state
let musicNodes = null;
let intensity = 0; // 0..1, rises with waves

export function init() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = volume;
    sfxGain.connect(master);
    musicGain = ctx.createGain();
    musicGain.gain.value = musicVolume * 0.5;
    musicGain.connect(master);
    startMusic();
  } catch (e) { ctx = null; }
}

export function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
export function setVolume(v) { volume = v; if (sfxGain) sfxGain.gain.value = v; }
export function setMusicVolume(v) { musicVolume = v; if (musicGain) musicGain.gain.value = v * 0.5; }
export function setIntensity(v) { intensity = Math.max(0, Math.min(1, v)); }

// ---- SFX --------------------------------------------------------------

function env(node, t0, attack, decay, peak = 1) {
  node.gain.setValueAtTime(0.0001, t0);
  node.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  node.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
}

function blip({ type = 'square', freq = 440, slide = 0, attack = 0.005, decay = 0.12, gain = 0.25, filterFreq = 0 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + attack + decay);
  env(g, t0, attack, decay, gain);
  let out = g;
  if (filterFreq) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq;
    g.connect(f); out = f;
  }
  osc.connect(g);
  out.connect(sfxGain);
  osc.start(t0);
  osc.stop(t0 + attack + decay + 0.05);
}

function noiseBurst({ decay = 0.2, gain = 0.3, filterFreq = 1200, filterType = 'lowpass' }) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * (decay + 0.05)));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = filterType; f.frequency.value = filterFreq;
  const g = ctx.createGain();
  env(g, t0, 0.004, decay, gain);
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start(t0);
}

// Throttle the firehose sounds so holding fire doesn't clip.
const lastPlayed = {};
function throttled(id, minGap, fn) {
  const now = ctx ? ctx.currentTime : 0;
  if (lastPlayed[id] && now - lastPlayed[id] < minGap) return;
  lastPlayed[id] = now;
  fn();
}

export const sfx = {
  shoot() { if (ctx) throttled('shoot', 0.05, () => blip({ type: 'sawtooth', freq: 220, slide: -160, decay: 0.07, gain: 0.06, filterFreq: 900 })); },
  heroHit() { if (ctx) throttled('hhit', 0.03, () => blip({ type: 'square', freq: 520, slide: -200, decay: 0.05, gain: 0.08, filterFreq: 2200 })); },
  heroDie() { noiseBurst({ decay: 0.25, gain: 0.22, filterFreq: 900 }); blip({ type: 'triangle', freq: 300, slide: -260, decay: 0.3, gain: 0.15 }); },
  bossHurt() { if (ctx) throttled('bhurt', 0.08, () => blip({ type: 'sawtooth', freq: 120, slide: -60, decay: 0.15, gain: 0.16, filterFreq: 500 })); },
  slam() { noiseBurst({ decay: 0.4, gain: 0.35, filterFreq: 300 }); blip({ type: 'sine', freq: 90, slide: -60, decay: 0.4, gain: 0.4 }); },
  ult() {
    noiseBurst({ decay: 0.9, gain: 0.4, filterFreq: 600 });
    blip({ type: 'sawtooth', freq: 60, slide: 500, attack: 0.3, decay: 0.7, gain: 0.3, filterFreq: 800 });
  },
  phase() {
    blip({ type: 'sawtooth', freq: 55, slide: 110, attack: 0.15, decay: 0.9, gain: 0.35, filterFreq: 700 });
    noiseBurst({ decay: 0.6, gain: 0.2, filterFreq: 2000, filterType: 'highpass' });
  },
  waveStart() { blip({ type: 'square', freq: 165, slide: 165, attack: 0.02, decay: 0.35, gain: 0.18, filterFreq: 1200 }); },
  pickup() { blip({ type: 'sine', freq: 660, slide: 330, decay: 0.12, gain: 0.12 }); },
  heal() { blip({ type: 'sine', freq: 880, slide: 220, decay: 0.2, gain: 0.07 }); },
  click() { blip({ type: 'square', freq: 700, decay: 0.04, gain: 0.1, filterFreq: 2500 }); },
  choose() { blip({ type: 'triangle', freq: 440, slide: 440, decay: 0.25, gain: 0.18 }); },
  death() {
    noiseBurst({ decay: 1.6, gain: 0.5, filterFreq: 400 });
    blip({ type: 'sawtooth', freq: 200, slide: -170, attack: 0.05, decay: 1.8, gain: 0.35, filterFreq: 600 });
  },
  arrow() { if (ctx) throttled('arrow', 0.06, () => noiseBurst({ decay: 0.08, gain: 0.08, filterFreq: 3500, filterType: 'highpass' })); },
  magic() { if (ctx) throttled('magic', 0.1, () => blip({ type: 'sine', freq: 990, slide: -700, decay: 0.3, gain: 0.09 })); },
};

// ---- Music: two detuned saw drones + slow LFO filter + pulsing sub ----

function startMusic() {
  if (!ctx || musicNodes) return;
  const t0 = ctx.currentTime;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 220;
  filter.Q.value = 4;
  filter.connect(musicGain);

  const mk = (freq, detune, type = 'sawtooth', g = 0.05) => {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    const og = ctx.createGain(); og.gain.value = g;
    o.connect(og); og.connect(filter);
    o.start(t0);
    return { o, og };
  };
  const a = mk(55, -6);           // A1 drone
  const b = mk(55, +7);
  const c = mk(82.4, -3, 'sawtooth', 0.03); // E2 fifth
  const sub = mk(27.5, 0, 'sine', 0.12);    // A0 sub

  // Slow LFO on the filter for the "breathing dread" feel.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.06;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 90;
  lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
  lfo.start(t0);

  musicNodes = { filter, oscs: [a, b, c, sub], lfo };
}

// Call every frame; opens the filter and adds tremolo as intensity rises.
export function updateMusic(dt) {
  if (!ctx || !musicNodes) return;
  const target = 200 + intensity * 1400;
  const f = musicNodes.filter.frequency;
  f.value += (target - f.value) * Math.min(1, dt * 2);
}

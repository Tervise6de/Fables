// Screen shake + hit-stop. Both feed the "juice" layer; shake can be
// disabled in settings for accessibility.
import { rand } from './rng.js';

let trauma = 0;          // 0..1, decays; shake amplitude = trauma^2
let hitstop = 0;         // seconds of frozen gameplay remaining
let enabled = true;

export function setShakeEnabled(v) { enabled = v; }
export function shake(amount) { trauma = Math.min(1, trauma + amount); }
export function stop(seconds) { hitstop = Math.max(hitstop, seconds); }

// Returns the dt the simulation should actually consume this tick.
export function consume(dt) {
  if (hitstop > 0) { hitstop -= dt; return 0; }
  return dt;
}

export function update(dt) {
  trauma = Math.max(0, trauma - dt * 1.6);
}

export function offset() {
  if (!enabled || trauma <= 0) return { x: 0, y: 0, r: 0 };
  const a = trauma * trauma * 14;
  return {
    x: (rand() * 2 - 1) * a,
    y: (rand() * 2 - 1) * a,
    r: (rand() * 2 - 1) * trauma * trauma * 0.015,
  };
}

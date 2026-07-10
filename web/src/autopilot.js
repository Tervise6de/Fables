// Scripted playtest bot (?auto=1). Plays competently but not perfectly:
// kites away from hero clusters, aims at the nearest hero (healers first),
// slams when crowded, ults when charged, always picks option 1.
// Used with ?fast=N + [PLAYTEST] console lines to gather balance data.
import * as input from './core/input.js';
import { dist2 } from './core/math.js';

let pickDelay = 0;

export function updateAutopilot(game, save) {
  if (game.state === 'title') {
    // click the start button (center 400)
    input.setMouse(640, 400, false);
    input.setMouse(640, 400, true);
    input.setMouse(640, 400, false);
    return;
  }
  if (game.state === 'pick') {
    // small human-ish delay, then choose option 1
    pickDelay++;
    if (pickDelay > 12) { input.setKey('Digit1', true); pickDelay = 0; }
    else input.setKey('Digit1', false);
    return;
  }
  input.setKey('Digit1', false);
  if (game.state === 'dead') {
    pickDelay++;
    if (pickDelay > 30) { input.setKey('Enter', true); pickDelay = 0; }
    else input.setKey('Enter', false);
    return;
  }
  if (game.state !== 'run' || !game.run) return;

  const run = game.run;
  const boss = run.boss;
  const live = run.heroes.filter((h) => !h.dead && !h.entering);

  // aim: prefer healers, then nearest
  let target = null, bd = Infinity;
  for (const h of live) {
    const d = dist2(boss.x, boss.y, h.x, h.y) * (h.type === 'healer' ? 0.35 : 1);
    if (d < bd) { bd = d; target = h; }
  }
  if (target) {
    input.setMouse(target.x, target.y, true);
  } else {
    input.setMouse(boss.x + 100, boss.y, false);
  }

  // movement: flee the center of mass of nearby heroes; drift to arena center when safe
  let fx = 0, fy = 0, n = 0;
  for (const h of live) {
    const d2 = dist2(boss.x, boss.y, h.x, h.y);
    if (d2 < 260 * 260) {
      const d = Math.sqrt(d2) || 1;
      fx += (boss.x - h.x) / d; fy += (boss.y - h.y) / d; n++;
    }
  }
  if (n === 0) { fx = (640 - boss.x) / 400; fy = (360 - boss.y) / 400; }
  // avoid walls
  if (boss.x < 140) fx += 1; if (boss.x > 1140) fx -= 1;
  if (boss.y < 140) fy += 1; if (boss.y > 580) fy -= 1;
  input.setKey('KeyA', fx < -0.25);
  input.setKey('KeyD', fx > 0.25);
  input.setKey('KeyW', fy < -0.25);
  input.setKey('KeyS', fy > 0.25);

  // slam when crowded
  let close = 0;
  for (const h of live) {
    if (dist2(boss.x, boss.y, h.x, h.y) < 130 * 130) close++;
  }
  input.setKey('Space', close >= 2 && boss.slamCd <= 0);
  if (close < 2 || boss.slamCd > 0) input.setKey('Space', false);

  // ult when charged and there are targets
  input.setKey('KeyQ', boss.ultCharge >= 1 && live.length >= 2);
  if (boss.ultCharge < 1) input.setKey('KeyQ', false);
}

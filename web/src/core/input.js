// Keyboard + mouse input, in internal canvas coordinates (1280x720).
// Tests can inject input through the same API (see setKey/setMouse).

const keys = new Set();
const pressedThisFrame = new Set();
export const mouse = { x: 640, y: 360, down: false, clicked: false };

let canvas = null;

export function init(cv) {
  canvas = cv;
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    pressedThisFrame.add(e.code);
    // Keep the page from scrolling / triggering browser shortcuts mid-game.
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => updateMouseFromEvent(e));
  canvas.addEventListener('mousedown', (e) => {
    updateMouseFromEvent(e);
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function updateMouseFromEvent(e) {
  const r = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
  mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
}

export function down(code) { return keys.has(code); }
export function pressed(code) { return pressedThisFrame.has(code); }

// Movement axis from WASD + arrows, normalized.
export function axis() {
  let x = 0, y = 0;
  if (down('KeyA') || down('ArrowLeft')) x -= 1;
  if (down('KeyD') || down('ArrowRight')) x += 1;
  if (down('KeyW') || down('ArrowUp')) y -= 1;
  if (down('KeyS') || down('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) { const s = Math.SQRT1_2; x *= s; y *= s; }
  return { x, y };
}

// Called by the game loop at the end of every update tick.
export function endFrame() {
  pressedThisFrame.clear();
  mouse.clicked = false;
}

// ---- test hooks -------------------------------------------------------
export function setKey(code, isDown) {
  if (isDown) { if (!keys.has(code)) pressedThisFrame.add(code); keys.add(code); }
  else keys.delete(code);
}
export function setMouse(x, y, isDown) {
  mouse.x = x; mouse.y = y;
  if (isDown !== undefined) {
    if (isDown && !mouse.down) mouse.clicked = true;
    mouse.down = isDown;
  }
}

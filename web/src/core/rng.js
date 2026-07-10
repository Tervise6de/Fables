// Seedable RNG (mulberry32). A fixed seed via ?seed= makes runs
// deterministic, which the scripted playtests rely on.
let state = (Math.random() * 0xffffffff) >>> 0;

export function seed(n) { state = n >>> 0; }

export function rand() {
  state = (state + 0x6D2B79F5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function range(a, b) { return a + rand() * (b - a); }
export function irange(a, b) { return Math.floor(range(a, b + 1)); }
export function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
export function chance(p) { return rand() < p; }

// Fisher-Yates shuffle (in place) using the seeded stream.
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

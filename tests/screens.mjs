// Capture every screen state: mutation pick, evolution, pause, death.
import { chromium } from 'playwright';

const dir = './shots';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// Bot plays, but we intercept pick states before the bot's auto-pick by polling fast.
await page.goto('http://127.0.0.1:8123/?seed=5&auto=1&fast=4');
await page.waitForTimeout(800);

const wanted = new Set(['pick-mutation', 'pick-evolve', 'dead']);
const t0 = Date.now();
while (wanted.size > 0 && Date.now() - t0 < 180000) {
  const st = await page.evaluate(() => ({ s: window.__FF.game.state, k: window.__FF.game.pickKind, w: window.__FF.game.run?.wave ?? 0 }));
  const key = st.s === 'pick' ? `pick-${st.k === 'evolve' ? 'evolve' : 'mutation'}` : st.s;
  if (wanted.has(key)) {
    await page.screenshot({ path: `${dir}/scr-${key}.png` });
    wanted.delete(key);
    console.log('captured', key, 'wave', st.w);
  }
  await page.waitForTimeout(60);
}

// paladin wave (wave 5) mid-fight shot on a fresh page without autopilot pick rush
console.log('missing:', [...wanted]);
console.log('errors:', errors.length ? errors : 'none');
await browser.close();

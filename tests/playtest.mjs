// Autopilot balance run: bot plays at high speed; we collect [PLAYTEST]
// telemetry lines, console errors, and periodic snapshots.
import { chromium } from 'playwright';

const seed = process.argv[2] || '7';
const seconds = parseInt(process.argv[3] || '90', 10);
const fast = process.argv[4] || '6';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], telemetry = [];
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error') errors.push(t);
  if (t.startsWith('[PLAYTEST]')) telemetry.push(t.slice(11).trim());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(`http://127.0.0.1:8123/?seed=${seed}&auto=1&fast=${fast}`);
await page.waitForTimeout(1000);

const t0 = Date.now();
let lastSnap = '';
while (Date.now() - t0 < seconds * 1000) {
  await page.waitForTimeout(3000);
  const snap = await page.evaluate(() => window.__FF.snapshot());
  const s = JSON.stringify(snap);
  if (s !== lastSnap) { console.log('snap:', s); lastSnap = s; }
  if (errors.length) break;
}
await page.screenshot({ path: `./shots/playtest-${seed}.png` });

console.log('--- telemetry ---');
for (const t of telemetry) console.log(t);
console.log('--- errors ---');
console.log(errors.length ? errors.join('\n') : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);

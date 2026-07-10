// Smoke test: boot the game, click start, verify a run begins, screenshot.
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:8123/?seed=42';
const shotDir = process.argv[3] || './shots';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url);
await page.waitForTimeout(1500);
const booted = await page.evaluate(() => !!window.__FF);
console.log('booted:', booted);
await page.screenshot({ path: `${shotDir}/01-title.png` });

// click RAISE THE BOSS (canvas center-x, y=400 in internal coords; canvas is fit to viewport)
const box = await page.locator('#game').boundingBox();
const sx = box.width / 1280, sy = box.height / 720;
await page.mouse.click(box.x + 640 * sx, box.y + 400 * sy);
await page.waitForTimeout(2500);
const snap1 = await page.evaluate(() => window.__FF.snapshot());
console.log('after start:', JSON.stringify(snap1));
await page.screenshot({ path: `${shotDir}/02-run.png` });

// hold fire toward a corner + move for 3 seconds
await page.mouse.move(box.x + 900 * sx, box.y + 300 * sy);
await page.mouse.down();
await page.keyboard.down('KeyD');
await page.waitForTimeout(1500);
await page.keyboard.up('KeyD');
await page.keyboard.press('Space');
await page.waitForTimeout(1500);
await page.mouse.up();
const snap2 = await page.evaluate(() => window.__FF.snapshot());
console.log('after combat:', JSON.stringify(snap2));
await page.screenshot({ path: `${shotDir}/03-combat.png` });

console.log('console errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);

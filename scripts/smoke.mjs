// Smoke test: drive the built app in headless Chromium at iPhone size and take screenshots.
// Usage: node scripts/smoke.mjs <baseUrl> <outDir>
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'screenshots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

const shot = async (name) => page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
const go = async (hash) => { await page.evaluate((h) => (location.hash = h), hash); await page.waitForTimeout(300); };

await page.goto(base);
await page.waitForTimeout(500);
await shot('01-onboarding');
await page.getByText("Let's set up").click();
await page.locator('input.answer').fill('שלום');
await shot('02-keyboard');
await page.getByText('Next →').click();
await page.getByText(/Start at/).click();
await page.waitForTimeout(300);
await shot('03-today');

const routes = process.argv.slice(4);
for (const r of routes) {
  await go(r);
  await shot(r.replace(/[#/]+/g, '_').replace(/^_/, ''));
}
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();

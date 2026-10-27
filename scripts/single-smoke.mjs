// Smoke test for the single-file build (in-memory routing, no service worker).
// Usage: npm run build:single && node scripts/single-smoke.mjs
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.setDefaultTimeout(5000);
await page.goto('file:///home/user/hebrew/dist-single/index.html');
await page.getByText("Let's set up").click();
await page.getByText('Next →').click();
await page.getByText(/Start at/).click();
await page.getByRole('button', { name: 'Read', exact: true }).click();
await page.locator('.item').nth(1).click();
const title = await page.locator('.topbar h1').textContent();
await page.getByRole('button', { name: 'Back' }).click();
const back = await page.locator('.topbar h1').textContent();
await page.getByRole('button', { name: 'Practice', exact: true }).click();
await page.getByText('Mistake bank').click();
const mb = await page.locator('.topbar h1').textContent();
console.log({ title, back, mb, hash: await page.evaluate(() => location.hash), inArtifact: await page.evaluate(() => document.documentElement.classList.contains('in-artifact')), errors });
await browser.close();

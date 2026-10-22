// Checks that the built app keeps working with no network once the service
// worker has cached it (what happens on an iPhone after "Add to Home Screen").
// Usage: npm run build && npx vite preview --port 4173 & node scripts/offline-smoke.mjs
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.setDefaultTimeout(5000);

await page.goto(base);
await page.evaluate(async () => {
  await navigator.serviceWorker.ready;
});
await page.waitForTimeout(1500); // let precaching finish
const cachedFiles = await page.evaluate(async () => {
  const keys = await caches.keys();
  const cache = await caches.open(keys[0]);
  return (await cache.keys()).length;
});

await ctx.setOffline(true);
await page.reload();
await page.waitForTimeout(800);
const appLoads = await page.getByText("Let's set up").isVisible();
await page.getByText("Let's set up").click();
await page.getByText('Next →').click();
await page.getByText(/Start at/).click();
await page.evaluate(() => (location.hash = '#/read/r_b1_dugri'));
await page.waitForTimeout(300);
const readingParagraphs = await page.locator('.para').count();
await page.evaluate(() => (location.hash = '#/session/words'));
await page.waitForTimeout(300);
const wordSession = await page.locator('.card .badge').first().textContent();

console.log({ cachedFiles, offlineAppLoads: appLoads, readingParagraphs, wordSession, errors });
await browser.close();
process.exit(appLoads && readingParagraphs > 0 && !errors.length ? 0 : 1);

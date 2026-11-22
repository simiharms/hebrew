// Helpers for the Shoresh Play end-to-end checks. scripts/e2e.mjs builds
// `t = { page, check, nav, playTap, shot, verbs, vocab, grammar, readings, scenes }`
// and hands it to every scripts/e2e-play/<name>.mjs (export default async (t) => …).

export const STATE_KEY = 'shoresh-state-v1';
export const ROUND_KEY = 'shoresh-play-round-v1';

// Something to act on: the result card, Continue once it takes taps, or a right answer past its bump guard.
const READY = '.result-card, .game-continue:not([disabled]), .game-controls [data-ok="true"]:not([disabled])';

/**
 * Plays a round of a tap game (one answer tap per item, as with ChoiceGrid) by
 * always tapping a right answer, pressing Continue whenever it shows, until the
 * result card appears. Each of the `max` steps waits for something tappable
 * (so the 250 ms bump guard and the reveal are waited out, not skipped) and
 * taps it once. `hash` (e.g. '#/play/snap') opens the game first; null plays
 * the game already on screen. Resolves to true once the result card shows.
 */
export async function playTap(page, hash, max = 60) {
  if (hash) await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForSelector('.game', { timeout: 5000 });
  for (let i = 0; i < max; i++) {
    const found = await page.waitForSelector(READY, { timeout: 4000 }).then(
      () => true,
      () => false,
    );
    if (!found) break;
    if (await page.locator('.result-card').count()) return true;
    const cont = page.locator('.game-continue:not([disabled])');
    const target = (await cont.count()) ? cont.first() : page.locator('.game-controls [data-ok="true"]:not([disabled])').first();
    await target.click({ timeout: 1500 }).catch(() => {});
    // Let the tap re-render (lock the grid) before looking again.
    await page.waitForTimeout(80);
  }
  return (await page.locator('.result-card').count()) > 0;
}

/** Taps one right answer in the game on screen and waits until it counts. */
export async function answerOne(page) {
  const before = Number(await page.locator('.game').getAttribute('data-answered'));
  await page.locator('.game-controls [data-ok="true"]:not([disabled])').first().click();
  await page.waitForFunction((n) => Number(document.querySelector('.game')?.getAttribute('data-answered')) > n, before, { timeout: 3000 });
}

/** The saved app state, as the app keeps it in localStorage. */
export function readState(page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), STATE_KEY);
}

/** Replaces the saved state and reloads, so the app starts from it. */
export async function writeState(page, s) {
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [STATE_KEY, JSON.stringify(s)]);
  await page.reload();
  await page.waitForSelector('.app');
  await page.waitForTimeout(250);
}

/** Today's date as the app writes it (local time, YYYY-MM-DD). */
export function todayKey(page) {
  return page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
}

export const hashOf = (page) => page.evaluate(() => location.hash);

// Who's talking? (snap): a clean round to ★★★, then a round with a miss that
// marks ✕ and ✓, shows who says the form, holds on Continue and lands on the
// result card's list of things to look at again.
import { readState, ROUND_KEY } from './helpers.mjs';

export default async function snap(t) {
  const { page, check, nav, playTap, shot } = t;
  await nav('#/today');
  await page.evaluate((k) => localStorage.removeItem(k), ROUND_KEY);
  await nav('#/play/snap');
  await page.waitForSelector('.game[data-game="snap"]');
  check((await page.locator('.game').getAttribute('data-total')) === '12', "Who's talking? deals 12 forms");
  check((await page.locator('.snap-bubble .he-game').textContent())?.trim().length > 0 && (await page.locator('.tense-band').count()) === 1, 'the form shows in a speech bubble under its tense');

  // The pronoun keys: exactly one right, in the bottom half, 64 px or taller.
  const opts = page.locator('.game-controls .opt');
  const n = await opts.count();
  check(n === 3 || n === 4, `${n} pronoun buttons`);
  check((await page.locator('.game-controls .opt[data-ok="true"]').count()) === 1, 'exactly one pronoun is right');
  const boxes = await opts.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ y: r.top, h: r.height })));
  check(boxes.every((b) => b.y > 844 / 2 && b.h >= 64), 'the pronoun buttons sit in the bottom half and are 64 px or taller');
  await shot('play-snap');

  check(await playTap(null, 60), "Who's talking? plays to the result card");
  await page.waitForTimeout(700);
  check((await page.locator('.result-card .star.on').count()) === 3, 'all right first try gives ★★★');
  const s = await readState(page);
  check(s.play.xp > 0 && s.play.best.snap?.stars === 3, `XP and the best are saved (xp ${s.play.xp}, best ${JSON.stringify(s.play.best.snap)})`);
  await shot('play-snap-result');

  // Again, with a miss on the first form.
  await page.getByRole('button', { name: /Again/ }).click();
  await page.waitForSelector('.game-controls .opt:not([data-ok]):not([disabled])');
  check((await page.locator('.game').getAttribute('data-answered')) === '0', 'Again starts a fresh round');
  await page.locator('.game-controls .opt:not([data-ok]):not([disabled])').first().click();
  await page.waitForSelector('.game-continue');
  check((await page.locator('.opt.bad').count()) === 1 && (await page.locator('.opt.ok').count()) === 1, 'a wrong pronoun is marked ✕ and the right one ✓');
  check(await page.locator('.snap-say').isVisible(), `the reveal says who says it (${(await page.locator('.snap-say').textContent())?.trim()})`);
  await shot('play-snap-miss');
  check(await playTap(null, 60), 'the round with a miss plays to the result card');
  await page.waitForTimeout(700);
  check((await page.locator('.result-card .star.on').count()) === 2, '11 of 12 first try gives ★★');
  check((await page.locator('.result-misses li').count()) === 1, `the miss is listed to look at again (${(await page.locator('.result-misses li').first().textContent().catch(() => ''))?.trim()})`);
}

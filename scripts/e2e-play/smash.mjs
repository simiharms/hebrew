// Table Smash (smash): the table and chip bank are laid out for thumbs, a wrong
// chip is a miss that ends nothing, both tables fill to the result card, the
// result links to the typed table challenge, and the terminus plays too.
import { readState, ROUND_KEY } from './helpers.mjs';

export default async function smash(t) {
  const { page, check, nav, playTap, shot, verbs } = t;
  await nav('#/today');
  await page.evaluate((k) => localStorage.removeItem(k), ROUND_KEY);
  await nav('#/play/smash');
  await page.waitForSelector('.game[data-game="smash"] .smash-table');

  const inf = (await page.locator('.smash-inf').textContent())?.trim() ?? '';
  const verb = verbs.find((v) => v.inf === inf);
  const rows = await page.locator('.smash-table .row').count();
  check(!!verb && rows >= 4, `the first table is a real verb table (${inf}, ${rows} rows)`);
  check((await page.locator('.smash-table .row.now').count()) === 1, 'one row glows');
  const chips = await page.locator('.smash-bank .smash-chip').count();
  check(chips >= rows && chips <= rows + 3, `the bank has a chip per row plus up to 3 decoys (${chips} for ${rows} rows)`);
  const boxes = await page.locator('.smash-bank button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ y: r.top, h: r.height })));
  check(boxes.every((b) => b.y > 844 / 2 && b.h >= 54), 'the chips sit in the bottom half and are big');
  const total = Number(await page.locator('.game').getAttribute('data-total'));
  await shot('play-smash');

  // A wrong chip: it flashes ✕, the row stays open.
  await page.waitForSelector('.smash-bank button:not([data-ok]):not([disabled])');
  await page.locator('.smash-bank button:not([data-ok]):not([disabled])').first().click();
  check((await page.locator('.game').getAttribute('data-answered')) === '0' && (await page.locator('.smash-chip.bad').count()) === 1, 'a wrong chip is a miss and the row stays open');
  await shot('play-smash-miss');

  // Fill both tables (each tap fills one row; a row with a twin chip takes either twin).
  check(await playTap(null, total * 3), `Table Smash fills ${total} rows to the result card`);
  await page.waitForTimeout(700);
  check((await page.locator('.result-misses li').count()) === 1, `the row with the miss is listed (${(await page.locator('.result-misses li').first().textContent().catch(() => ''))?.trim()})`);
  const s = await readState(page);
  check((s.play.plays.smash ?? 0) >= 1 && s.play.best.smash?.score > 0, 'the round is booked');
  await shot('play-smash-result');

  // The way to full credit: the typed table challenge for the same verb and tense.
  await page.getByRole('button', { name: /Type it for full credit/ }).click();
  await page.waitForTimeout(250);
  const hash = await page.evaluate(() => location.hash);
  check(hash.startsWith(`#/verbs/table/${verb?.id}/`) && (await page.getByText('Table challenge').first().isVisible()), `the result links to the typed table (${hash})`);

  // The terminus is Table Smash too.
  await nav('#/play/smash/terminus');
  await page.waitForSelector('.game[data-mode="terminus"] .smash-table');
  check(((await page.locator('.game-title .sub').textContent()) ?? '').includes('Terminus'), `the terminus is marked (${(await page.locator('.game-title .sub').textContent())?.trim()})`);
  const tTotal = Number(await page.locator('.game').getAttribute('data-total'));
  check(await playTap(null, tTotal * 3), 'a terminus round plays to the result card');
}

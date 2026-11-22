// Verb Forge (forge): chips and Check sit in the bottom half, the word builds
// on the anvil, a wrong build holds on Continue with the right chips marked,
// a clean round reaches the result card, and a due verb card gets its review.
import { readState, ROUND_KEY, writeState } from './helpers.mjs';

const forms = (v) => ['present', 'past', 'future'].flatMap((t) => Object.values(v?.[t] ?? {}).map((f) => f[0]));

// Taps one chip in a row once it takes taps; `ok` picks the right one or a wrong one.
async function pickIn(page, row, ok) {
  const sel = ok ? '.tile[data-ok="true"]:not([disabled])' : '.tile:not([data-ok]):not([disabled])';
  await row.locator(sel).first().click();
}

// Builds the right form for every item left and checks it, until the result card shows.
async function forgeRight(page, max) {
  for (let i = 0; i < max; i++) {
    await page.waitForSelector('.result-card, .forge-check', { timeout: 4000 });
    if (await page.locator('.result-card').count()) return true;
    const rows = page.locator('.game-controls .tile-row');
    for (let r = 0; r < (await rows.count()); r++) await pickIn(page, rows.nth(r), true);
    const before = Number(await page.locator('.game').getAttribute('data-answered'));
    await page.locator('.forge-check:not([disabled])').click();
    await page.waitForFunction((n) => !!document.querySelector('.result-card') || Number(document.querySelector('.game')?.getAttribute('data-answered')) > n, before, { timeout: 3000 });
    // the right answer moves on by itself after its reveal
    await page.waitForSelector('.result-card, .forge-check', { timeout: 3000 });
  }
  return (await page.locator('.result-card').count()) > 0;
}

export default async function forge(t) {
  const { page, check, nav, shot, verbs } = t;
  await nav('#/today');
  const start = await readState(page);
  await page.evaluate((k) => localStorage.removeItem(k), ROUND_KEY);
  await nav('#/play/forge');
  await page.waitForSelector('.game[data-game="forge"] .forge-anvil');
  const total = Number(await page.locator('.game').getAttribute('data-total'));
  check(total === 8, `Verb Forge deals 8 forms (${total})`);

  // The prompt: pronoun, infinitive, a slot per row; Check waits for the chips.
  const inf = (await page.locator('.forge-inf').textContent())?.trim();
  const verb = verbs.find((v) => v.inf === inf);
  const rows = page.locator('.game-controls .tile-row');
  const nRows = await rows.count();
  check(!!verb && (nRows === 1 || nRows === 2), `a real verb (${inf}) with ${nRows} chip row(s)`);
  check((await page.locator('.forge-part.slot').count()) === nRows, 'an empty slot waits on the anvil for each row');
  check(await page.locator('.forge-check').isDisabled(), 'Check waits until every row has a pick');
  const boxes = await page.locator('.game-controls .tile, .forge-check').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ y: r.top, h: r.height })));
  check(boxes.every((b) => b.y > 844 / 2 && b.h >= 56), 'chips and Check sit in the bottom half and are 56 px or taller');
  check(boxes.every((b) => b.y + b.h <= 844), 'nothing in the controls falls below the screen');
  await shot('play-forge');

  // A wrong build: the right chip before the stem (if there is a row for it), a wrong one after.
  for (let r = 0; r < nRows - 1; r++) await pickIn(page, rows.nth(r), true);
  await pickIn(page, rows.nth(nRows - 1), false);
  const built = (await page.locator('.forge-anvil .forge-word').textContent())?.trim() ?? '';
  check(built.length > 1 && (await page.locator('.forge-part.slot').count()) === 0, `the picks assemble in place (${built})`);
  await page.locator('.forge-check:not([disabled])').click();
  await page.waitForSelector('.game-continue');
  check((await page.locator('.forge-anvil.bad').count()) === 1, 'a wrong build turns the anvil red');
  check((await page.locator('.tile.bad').count()) === 1 && (await page.locator('.tile.ok').count()) === nRows, 'the wrong chip is ✕ and the right chips are ✓');
  const fix = (await page.locator('.forge-fix .forge-word').textContent())?.trim() ?? '';
  check(forms(verb).includes(fix) && fix !== built, `the right form is shown (${fix})`);
  check((await page.locator('.forge-check').count()) === 0, 'Check is gone while Continue shows');
  check((await page.locator('.game').getAttribute('data-answered')) === '1', 'the miss counts as answered');
  await shot('play-forge-miss');
  await page.waitForTimeout(450);
  await page.locator('.game-continue:not([disabled])').click();

  // The rest right, to the result card.
  check(await forgeRight(page, total + 2), 'Verb Forge plays to the result card');
  await page.waitForTimeout(700);
  check(await page.locator('.result-stats').getByText('Strengthened').isVisible(), 'the result shows Strengthened');
  check((await page.locator('.result-misses li').count()) === 1, `the miss is listed (${(await page.locator('.result-misses li').first().textContent().catch(() => ''))?.trim()})`);
  const noCards = !Object.keys(start.cards).some((k) => k.startsWith('c:'));
  if (noCards) check(await page.locator('.forge-note').isVisible(), 'with no verb cards the result says new verbs start in Verb forms');
  let s = await readState(page);
  check((s.play.plays.forge ?? 0) >= 1 && s.play.best.forge?.score > 0, 'the round is booked');
  check(s.mistakes.some((m) => m.kind === 'verb' && m.given === built), 'the wrong build goes to the mistake bank');
  check(Object.keys(s.cards).length === Object.keys(start.cards).length, 'building forms never creates cards');
  await shot('play-forge-result');

  // A due card: a clean round reviews it once (build g 3) and counts as Strengthened.
  const now = Date.now();
  const card = 'c:verb_likhtov:past';
  s.cards[card] = { due: now - 86_400_000, s: 2, d: 5, reps: 2, lapses: 0, last: now - 5 * 86_400_000 };
  await page.evaluate((k) => localStorage.removeItem(k), ROUND_KEY);
  await writeState(page, s);
  await nav('#/play/forge');
  await page.waitForSelector('.game[data-game="forge"] .forge-anvil');
  check((await page.locator('.forge-inf').textContent())?.trim() === 'לכתוב', 'the due card comes first');
  check(await forgeRight(page, 12), 'a round with a due card plays to the result card');
  await page.waitForTimeout(700);
  const strengthened = Number((await page.locator('.result-stats > div').nth(1).locator('b').textContent())?.trim());
  s = await readState(page);
  check(strengthened === 1 && s.cards[card].reps === 3 && s.cards[card].due > now, `the due card is reviewed once (Strengthened ${strengthened}, reps ${s.cards[card].reps})`);
  check(await page.locator('.result-card .star.on').count() === 3, 'all right first try gives ★★★');

  // Keyboard (Mac): Enter on a focused chip picks it, even when a pick is in;
  // Enter on the chip already picked hammers.
  await page.evaluate((k) => localStorage.removeItem(k), ROUND_KEY);
  await nav('#/play');
  await nav('#/play/forge');
  await page.waitForSelector('.game[data-game="forge"] .forge-anvil');
  const kRows = page.locator('.game-controls .tile-row');
  const nk = await kRows.count();
  for (let r = 0; r < nk - 1; r++) await pickIn(page, kRows.nth(r), true);
  const lastRow = kRows.nth(nk - 1);
  await page.waitForTimeout(350);
  await lastRow.locator('.tile:not([data-ok])').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(350);
  await lastRow.locator('.tile[data-ok="true"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(350);
  check(
    (await page.locator('.game').getAttribute('data-answered')) === '0' && (await lastRow.locator('.tile[data-ok="true"][aria-pressed="true"]').count()) === 1,
    'Enter on a focused chip changes the pick instead of checking the old one',
  );
  await lastRow.locator('.tile[data-ok="true"]').focus();
  await page.keyboard.press('Enter');
  const hammered = await page.waitForSelector('.forge-anvil.ok', { timeout: 2000 }).then(
    () => true,
    () => false,
  );
  check(hammered && (await page.locator('.game').getAttribute('data-answered')) === '1', 'Enter on the picked chip hammers the right build');
  await page.evaluate((k) => localStorage.removeItem(k), ROUND_KEY);

  // Leave the cards and mistakes as they were for the checks that follow.
  s.cards = start.cards;
  s.mistakes = start.mistakes;
  await writeState(page, s);
}

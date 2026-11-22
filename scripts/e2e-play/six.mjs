// Verb of the Day (six): six typed forms of one verb. A clean grid gives six
// 🟩 and a share line; the input stays the same focused element all round (so
// the iOS keyboard stays up); a reopened finished grid shows the grid and
// Share instead of a new round; a second try is 🟨 and two misses are 🟥.
import { readState, ROUND_KEY, todayKey, writeState } from './helpers.mjs';

// The form the active row asks for, looked up in the verb tables.
async function wanted(page, verbs) {
  const id = await page.locator('.six-board').getAttribute('data-verb');
  const row = page.locator('.six-row.now');
  const tense = await row.getAttribute('data-tense');
  const person = await row.getAttribute('data-person');
  const v = verbs.find((x) => x.id === id);
  return { v, tense, person, form: v?.[tense]?.[person]?.[0] };
}

async function freshGrid(page) {
  const s = await readState(page);
  s.play.daily = null;
  await page.evaluate((k) => localStorage.removeItem(k), ROUND_KEY);
  await writeState(page, s);
}

// Types into whatever has focus (no tap on the input) and presses Enter.
async function typeEnter(page, text) {
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

async function nextRow(page, answered) {
  await page.waitForFunction((n) => !!document.querySelector('.result-card') || (Number(document.querySelector('.game')?.getAttribute('data-answered')) > n && !!document.querySelector('.six-row.now:not(.g):not(.y):not(.r)')), answered, { timeout: 3000 });
}

export default async function six(t) {
  const { page, check, nav, shot, verbs } = t;
  await nav('#/today');
  await freshGrid(page);
  await nav('#/play/six');
  await page.waitForSelector('.game[data-game="six"] .six-board[data-verb]');
  const date = await todayKey(page);
  check((await page.locator('.six-row').count()) === 6 && (await page.locator('.six-row.now').count()) === 1, 'six rows, one active');
  const first = await wanted(page, verbs);
  check(!!first.form, `the active row names a real form (${first.v?.inf} · ${first.tense} ${first.person} → ${first.form})`);
  const box = await page.locator('.six-entry').boundingBox();
  check(!!box && box.y > 844 / 2 && box.height >= 56, 'the input and Check sit in the bottom half');
  let s = await readState(page);
  check(s.play.daily?.date === date && s.play.daily.marks.length === 6 && s.play.daily.marks.every((m) => m === ''), 'opening the game saves today’s grid');
  await page.locator('input.answer').click();
  await page.evaluate(() => (window.__sixInput = document.querySelector('input.answer')));
  await page.keyboard.type(first.form.slice(0, 2));
  check(((await page.locator('.six-row.now .six-typed').textContent()) ?? '') === first.form.slice(0, 2), 'what you type shows in the active row');
  await shot('play-six');
  await page.locator('input.answer').fill('');

  // A clean grid: six right first try, typed without touching the input again.
  let kept = 0;
  for (let i = 0; i < 6; i++) {
    const w = await wanted(page, verbs);
    const n = Number(await page.locator('.game').getAttribute('data-answered'));
    await typeEnter(page, w.form);
    await nextRow(page, n);
    if (i < 5 && (await page.evaluate(() => document.querySelector('input.answer') === window.__sixInput && document.activeElement === window.__sixInput))) kept++;
    if (i === 4) await shot('play-six-typing');
  }
  check(kept === 5, `one input, focused all round, took all six answers (${kept + 1}/6)`);
  await page.waitForSelector('.result-card');
  await page.waitForTimeout(700);
  check((await page.locator('.result-card .six-share .sq.g').count()) === 6, 'six 🟩 on the result card');
  check((await page.locator('.result-card .star.on').count()) === 3, 'six right first try gives ★★★');
  const share = await page.locator('.six-share').getAttribute('data-share');
  const inf = verbs.find((v) => v.id === first.v.id)?.inf;
  check(share === `Shoresh · פועל היום ${date}\n${inf} 🟩🟩🟩🟩🟩🟩 6/6`, `the share line (${JSON.stringify(share)})`);
  await page.getByRole('button', { name: /Share today/ }).click();
  await page.waitForTimeout(300);
  const msg = (await page.locator('.six-share-msg').textContent().catch(() => ''))?.trim() ?? '';
  check(/Copied|Press and hold/.test(msg) || (await page.evaluate(() => typeof navigator.share === 'function')), `Share copies the line or explains how (${msg})`);
  s = await readState(page);
  check(s.play.daily.marks.join('') === 'gggggg' && s.days.find((d) => d.date === date)?.tasks.includes('play:six'), 'the grid and the day’s task are saved');
  await shot('play-six-result');

  // Reopened: today's grid and Share, no new round.
  await nav('#/play');
  await nav('#/play/six');
  await page.waitForSelector('.six-done');
  check((await page.locator('.six-done .six-grid .sq.g').count()) === 6 && (await page.locator('input.answer').count()) === 0, 'a finished day shows its grid instead of a new round');
  check(await page.getByRole('button', { name: /Share today/ }).isVisible(), 'and offers Share');
  await shot('play-six-done');

  // Second tries and misses.
  await freshGrid(page);
  await nav('#/play/six');
  await page.waitForSelector('.six-board[data-verb] .six-row.now');
  await page.locator('input.answer').click();
  let w = await wanted(page, verbs);
  // Another form of the verb, not even a spelling variant of the right one.
  const loose = (f) => f.replace(/[ךםןףץ]/g, (c) => ({ ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' })[c]).replace(/יי/g, 'י').replace(/וו/g, 'ו');
  const wrongOf = (v, form) => ['present', 'past', 'future'].flatMap((x) => Object.values(v[x] ?? {}).map((f) => f[0])).find((f) => loose(f) !== loose(form) && f.length > 1);
  await typeEnter(page, wrongOf(w.v, w.form));
  await page.waitForTimeout(150);
  check((await page.locator('.game').getAttribute('data-answered')) === '0' && (await page.locator('.six-row.now:not(.g):not(.y):not(.r)').count()) === 1, 'a first miss reveals nothing and keeps the row open');
  check(/Not quite|Very close/.test((await page.locator('.six-note').textContent()) ?? ''), `a hint for the second try (${(await page.locator('.six-note').textContent())?.trim()})`);
  await shot('play-six-retry');
  await page.locator('input.answer').fill('');
  await typeEnter(page, w.form);
  await nextRow(page, 0);
  check((await page.locator('.six-grid .sq.y').count()) === 1, 'right on the second try is 🟨');

  w = await wanted(page, verbs);
  await typeEnter(page, wrongOf(w.v, w.form));
  await page.waitForTimeout(150);
  await page.locator('input.answer').fill('');
  await typeEnter(page, wrongOf(w.v, w.form));
  await page.waitForSelector('.six-row.r');
  check(((await page.locator('.six-row.r .six-form').textContent()) ?? '').trim() === w.form, `two misses are 🟥 and show the form (${w.form})`);
  check(((await page.locator('.six-go').textContent()) ?? '').includes('Next'), 'Check turns into Next');
  await shot('play-six-miss');
  await page.waitForTimeout(450);
  await page.keyboard.press('Enter');
  await nextRow(page, 1);
  for (let i = 2; i < 6; i++) {
    w = await wanted(page, verbs);
    await typeEnter(page, w.form);
    await nextRow(page, i);
  }
  await page.waitForSelector('.result-card');
  await page.waitForTimeout(700);
  check((await page.locator('.result-misses li').count()) === 2, 'both rows are listed to look at again');
  s = await readState(page);
  check(s.play.daily.marks.join('') === 'yrgggg', `the grid is saved (${s.play.daily.marks.join('')})`);
  const line = await page.locator('.six-share').getAttribute('data-share');
  check(!!line?.endsWith('🟨🟥🟩🟩🟩🟩 5/6'), `the share line counts second tries as right (${JSON.stringify(line)})`);
}

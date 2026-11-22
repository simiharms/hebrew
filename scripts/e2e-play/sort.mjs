// Time Machine (sort): lanes run right to left (עבר first), every right lane is
// marked for each form (cross-checked against the verb tables, so a form in two
// tables has two), a clean round gives ★★★, and the 60 s sprint resumes with its
// time left and ends when the clock runs out.
import { readState, ROUND_KEY } from './helpers.mjs';

const UNFINAL = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
// Like lenient() in src/lib/hebrew.ts: no points, no final letters, no doubled vav/yod.
const lenient = (s) =>
  s
    .replace(/[֑-ׇֽֿׁׂׅׄ'׳]/g, '')
    .replace(/[ךםןףץ]/g, (c) => UNFINAL[c])
    .replace(/יי/g, 'י')
    .replace(/וו/g, 'ו')
    .trim();
const LANE = { עבר: 'past', הווה: 'present', עתיד: 'future', ציווי: 'imp' };

export default async function sort(t) {
  const { page, check, nav, playTap, shot, verbs } = t;
  const lanesOnScreen = async () => {
    const lanes = await page.locator('.sort-lanes .opt').evaluateAll((els) =>
      els.map((e) => ({ he: e.querySelector('.lane-he')?.textContent?.trim() ?? '', x: e.getBoundingClientRect().left, y: e.getBoundingClientRect().top, h: e.getBoundingClientRect().height, ok: e.dataset.ok === 'true' })),
    );
    return lanes.sort((a, b) => b.x - a.x); // right to left
  };
  // The tenses a form belongs to, from the verb tables (the verb found by its gloss).
  const tensesOf = (form, en) => {
    const out = new Set();
    for (const v of verbs.filter((x) => x.en === en)) {
      for (const tense of ['present', 'past', 'future', 'imp']) {
        for (const f of Object.values(v[tense] ?? {})) if (lenient(f[0]) === lenient(form)) out.add(tense);
      }
    }
    return out;
  };

  await nav('#/today');
  await page.evaluate((k) => localStorage.removeItem(k), ROUND_KEY);
  await nav('#/play/sort');
  await page.waitForSelector('.game[data-game="sort"] .sort-lanes .opt');
  const lanes = await lanesOnScreen();
  check(lanes.map((l) => l.he).join(' ') === 'עבר הווה עתיד ציווי', `B1 lanes read right to left: ${lanes.map((l) => l.he).join(' | ')}`);
  check(lanes.every((l) => l.y > 844 / 2 && l.h >= 56), 'the lanes sit in the bottom half and are tall');
  check((await page.locator('.game').getAttribute('data-total')) === '15', 'Time Machine deals 15 forms');
  await shot('play-sort');
  check(await playTap(null, 80), 'Time Machine plays to the result card');
  await page.waitForTimeout(700);
  check((await page.locator('.result-card .star.on').count()) === 3, 'all right first try gives ★★★');
  check((await readState(page)).play.best.sort?.stars === 3, 'the best is saved');

  // Again: check every form's right lanes against the tables, and see a "both" reveal if one comes up.
  await page.getByRole('button', { name: /Again/ }).click();
  let checked = 0;
  let agree = 0;
  let both = 0;
  for (let i = 0; i < 80 && !(await page.locator('.result-card').count()); i++) {
    const ready = await page.waitForSelector('.result-card, .game-continue:not([disabled]), .sort-lanes .opt[data-ok="true"]:not([disabled])', { timeout: 4000 }).then(() => true, () => false);
    if (!ready || (await page.locator('.result-card').count())) break;
    if (await page.locator('.game-continue:not([disabled])').count()) {
      await page.locator('.game-continue').click();
      continue;
    }
    const form = (await page.locator('.sort-card .he-game').textContent())?.trim() ?? '';
    const en = (await page.locator('.sort-card .sort-en').textContent())?.trim() ?? '';
    const want = tensesOf(form, en);
    const marked = new Set((await lanesOnScreen()).filter((l) => l.ok).map((l) => LANE[l.he]));
    checked++;
    if (want.size === marked.size && [...want].every((x) => marked.has(x))) agree++;
    else console.log(`     lanes for ${form} (${en}): marked ${[...marked]} but the tables say ${[...want]}`);
    await page.locator('.sort-lanes .opt[data-ok="true"]:not([disabled])').first().click();
    await page.waitForTimeout(80);
    if (want.size > 1 && (await page.locator('.sort-both').count())) {
      if (!both) await shot('play-sort-both');
      both++;
    }
  }
  check(checked === 15 && agree === checked, `every form's right lanes match the verb tables (${agree}/${checked}${both ? `, ${both} in two tables` : ''})`);
  check(await page.locator('.result-card').isVisible(), 'the second round reaches the result card');

  // Sprint: 60 s on the clock; leave after 3, come back to 1.5 s left, and it ends.
  await nav('#/play/sort/sprint');
  await page.waitForSelector('.game[data-mode="sprint"]');
  check(((await page.locator('.game-count').textContent()) ?? '').startsWith('⏱'), `the sprint runs a clock (${(await page.locator('.game-count').textContent())?.trim()})`);
  check((await page.locator('.game').getAttribute('data-total')) === '60', 'the sprint has 60 forms ready');
  for (let k = 0; k < 3; k++) {
    await page.locator('.sort-lanes .opt[data-ok="true"]:not([disabled])').first().click();
    await page.waitForFunction((n) => Number(document.querySelector('.game')?.getAttribute('data-answered')) > n, k);
  }
  await shot('play-sort-sprint');
  await nav('#/today');
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), ROUND_KEY);
  check(saved?.mode === 'sprint' && saved.timeLeftMs > 0 && saved.timeLeftMs <= 60000, `leaving keeps the sprint's time left (${saved?.timeLeftMs} ms)`);
  await page.evaluate((k) => {
    const r = JSON.parse(localStorage.getItem(k));
    r.timeLeftMs = 1500;
    localStorage.setItem(k, JSON.stringify(r));
  }, ROUND_KEY);
  await nav('#/play/sort/sprint');
  await page.waitForSelector('.game[data-mode="sprint"]');
  check((await page.locator('.game').getAttribute('data-answered')) === '3', 'the sprint resumes with its 3 answers');
  await page.waitForSelector('.result-card', { timeout: 6000 });
  await page.waitForTimeout(700);
  check(((await page.locator('.result-sub').textContent()) ?? '').includes('3 answered'), `the sprint ends when time runs out (${(await page.locator('.result-sub').textContent())?.trim()})`);
  check((await readState(page)).play.best['sort:sprint']?.score === 3, 'the sprint best is the number right');
  await shot('play-sort-sprint-result');
}

// Match Rush (match): two columns (English left, Hebrew right) of real words
// and their glosses in another order, a wrong pair shakes both tiles and ends
// nothing, matched pairs fade out in place and waves of five follow each other
// to the result card; a clean round gives ★★★, the 60 s sprint resumes with its
// pairs and time left, and the A1 letters and verbs-only variants deal their own pairs.
import { readState, ROUND_KEY, writeState } from './helpers.mjs';

// The tiles on the board, top to bottom: pair key, side, text, place.
const board = (page) =>
  page.locator('.match-board .match-tile').evaluateAll((els) =>
    els
      .map((e) => {
        const r = e.getBoundingClientRect();
        return {
          pair: e.dataset.pair ?? e.dataset.gone,
          side: e.classList.contains('he') ? 'he' : 'en',
          text: e.textContent.trim(),
          lang: e.getAttribute('lang'),
          gone: e.classList.contains('gone'),
          x: r.left,
          y: r.top,
          h: r.height,
        };
      })
      .sort((a, b) => a.y - b.y),
  );

const answered = async (page) => Number(await page.locator('.game').getAttribute('data-answered'));

/** Matches one pair through the UI (its Hebrew tile, then its English twin) and waits until it counts. */
async function matchPair(page, pair) {
  const before = await answered(page);
  await page.locator(`button.match-tile.he[data-pair="${pair}"]:not([disabled])`).click();
  await page.locator(`button.match-tile.en[data-pair="${pair}"]:not([disabled])`).click();
  await page.waitForFunction((n) => Number(document.querySelector('.game')?.getAttribute('data-answered')) > n || !!document.querySelector('.result-card'), before, { timeout: 3000 });
}

/** The Hebrew tile to match next (past the bump guard), or null once the result card shows. */
async function nextPair(page) {
  // Matched tiles stay on the board as <span>s (data-gone), so look at buttons only.
  await page.waitForSelector('.result-card, button.match-tile.he:not([disabled])', { timeout: 4000 });
  if (await page.locator('.result-card').count()) return null;
  return page.locator('button.match-tile.he:not([disabled])').first().getAttribute('data-pair');
}

export default async function match(t) {
  const { page, check, nav, playTap, shot, vocab, verbs } = t;
  await nav('#/today');
  await page.evaluate((k) => localStorage.removeItem(k), ROUND_KEY);
  const start = await readState(page);
  await nav('#/play/match');
  await page.waitForSelector('.game[data-game="match"] button.match-tile.he:not([disabled])');
  check((await page.locator('.game').getAttribute('data-total')) === '15', `Match Rush deals 15 pairs (${await page.locator('.game').getAttribute('data-total')})`);
  check((await page.locator('.match-waves li').count()) === 3 && (await page.locator('.match-waves li.now').count()) === 1, 'three waves, the first one on');

  // The first wave: five Hebrew words on the right, their glosses on the left in another order.
  const tiles = await board(page);
  const he = tiles.filter((x) => x.side === 'he');
  const en = tiles.filter((x) => x.side === 'en');
  const firstWave = he.map((x) => x.pair);
  check(he.length === 5 && en.length === 5 && [...firstWave].sort().join() === en.map((x) => x.pair).sort().join(), `a wave is 5 Hebrew tiles and their 5 English twins (${he.length} + ${en.length})`);
  check(Math.min(...he.map((x) => x.x)) > Math.max(...en.map((x) => x.x)) && he.every((x) => x.lang === 'he'), 'Hebrew on the right (lang="he"), English on the left');
  check(firstWave.join() !== en.map((x) => x.pair).join(), 'the English column is in another order');
  check(tiles.every((b) => b.y > 844 / 2 && b.h >= 56), 'the tiles sit in the bottom half and are 56 px or taller');
  const real = he.every((h) => {
    const v = vocab.find((x) => `v:${x.id}` === h.pair);
    const gloss = en.find((x) => x.pair === h.pair)?.text ?? '';
    return !!v && v.he.trim() === h.text && gloss.length > 0 && v.en.trim().startsWith(gloss);
  });
  check(real, `every pair is a word and its own gloss (${he.map((h) => `${h.text} = ${en.find((x) => x.pair === h.pair)?.text}`).join(', ')})`);
  await shot('play-match');

  // A wrong pair: both tiles shake with ✕, nothing is matched, nothing ends.
  const [a, b] = firstWave;
  await page.locator(`.match-tile.he[data-pair="${a}"]`).click();
  check((await page.locator(`.match-tile.he.sel[data-pair="${a}"][aria-pressed="true"]`).count()) === 1, 'a tapped tile waits for its twin');
  await page.locator(`.match-tile.en[data-pair="${b}"]`).click();
  // A bump: the wrong English tile tapped again while it shakes picks nothing (or the next tap would be blamed).
  await page.locator(`.match-tile.en[data-pair="${b}"]`).click();
  await page.waitForSelector('.match-tile.bad');
  check(
    (await page.locator(`.match-tile.he.bad[data-pair="${a}"], .match-tile.en.bad[data-pair="${b}"]`).count()) === 2 && (await answered(page)) === 0 && (await page.locator('.match-board button.match-tile').count()) === 10,
    'a wrong pair shakes both tiles and matches nothing',
  );
  check((await page.locator('.match-tile.sel').count()) === 0, 'a bumped second tap on the wrong tile picks nothing');
  await page.waitForTimeout(500); // the shake is over
  await shot('play-match-miss');

  // Match every pair: Hebrew tile, then its English twin, wave after wave.
  let matched = 0;
  let faded = false;
  let nextWave = false;
  for (let k = 0; k < 30; k++) {
    const pair = await nextPair(page);
    if (!pair) break;
    if (matched === 5) {
      const now = (await board(page)).filter((x) => x.side === 'he' && !x.gone).map((x) => x.pair);
      nextWave = now.length === 5 && now.every((p) => !firstWave.includes(p)) && (await page.locator('.match-waves li.done').count()) === 1;
    }
    await matchPair(page, pair);
    matched++;
    if (matched === 1) {
      const gone = await board(page);
      faded = gone.filter((x) => x.gone && x.pair === pair).length === 2 && gone.length === 10;
    }
  }
  check(faded, 'a matched pair fades out and keeps its place');
  check(nextWave, 'a cleared wave makes way for five new pairs');
  check(matched === 15 && (await page.locator('.result-card').count()) === 1, `Match Rush plays to the result card (${matched} pairs)`);
  await page.waitForTimeout(700);
  check((await page.locator('.result-card .star.on').count()) === 2, '14 of 15 first try gives ★★');
  check((await page.locator('.result-misses li').count()) === 1, `the pair with the miss is listed (${(await page.locator('.result-misses li').first().textContent().catch(() => ''))?.trim()})`);
  const s = await readState(page);
  check((s.play.plays.match ?? 0) >= 1 && s.play.best.match?.score > 0, 'the round is booked');
  check(Object.keys(s.cards).length === Object.keys(start.cards).length, 'matching pairs never creates cards');
  await shot('play-match-result');

  // Again, all clean: the right next tap is marked (any Hebrew tile, then the twin).
  await page.getByRole('button', { name: /Again/ }).click();
  await page.waitForSelector('button.match-tile.he:not([disabled])');
  check((await answered(page)) === 0, 'Again starts a fresh round');
  check(await playTap(null, 90), 'a clean round plays to the result card');
  await page.waitForTimeout(700);
  check((await page.locator('.result-card .star.on').count()) === 3, 'all pairs right first try gives ★★★');

  // Sprint: 40 pairs and a clock; leave after 2, come back with 3 s left, and it ends.
  await nav('#/play/match/sprint');
  await page.waitForSelector('.game[data-mode="sprint"] button.match-tile.he:not([disabled])');
  check(((await page.locator('.game-count').textContent()) ?? '').startsWith('⏱'), `the sprint runs a clock (${(await page.locator('.game-count').textContent())?.trim()})`);
  check((await page.locator('.game').getAttribute('data-total')) === '40', 'the sprint has 40 pairs ready');
  for (let k = 0; k < 2; k++) await matchPair(page, await nextPair(page));
  await shot('play-match-sprint');
  await nav('#/today');
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null')?.rounds?.['match:sprint'], ROUND_KEY);
  check(saved?.game === 'match' && saved.mode === 'sprint' && saved.timeLeftMs > 0 && saved.timeLeftMs <= 60000, `leaving keeps the sprint's time left (${saved?.timeLeftMs} ms)`);
  await page.evaluate((k) => {
    const all = JSON.parse(localStorage.getItem(k)); // { v: 2, rounds: { 'game:mode': snapshot } }
    all.rounds['match:sprint'].timeLeftMs = 3000;
    localStorage.setItem(k, JSON.stringify(all));
  }, ROUND_KEY);
  await nav('#/play/match/sprint');
  await page.waitForSelector('.game[data-mode="sprint"] .match-board');
  check((await answered(page)) === 2 && (await page.locator('.match-tile.gone').count()) === 4, 'the sprint resumes with its 2 pairs matched and off the board');
  await page.waitForSelector('.result-card', { timeout: 8000 });
  await page.waitForTimeout(700);
  check(((await page.locator('.result-sub').textContent()) ?? '').includes('2 answered'), `the sprint ends when time runs out (${(await page.locator('.result-sub').textContent())?.trim()})`);
  check((await readState(page)).play.best['match:sprint']?.score === 2, 'the sprint best is the number right');

  // Variants: an A1 beginner with few words matches the letters to their names;
  // verbs-only learners match infinitives. Then the state goes back as it was.
  await nav('#/today');
  const base = await readState(page);
  await page.evaluate((k) => localStorage.removeItem(k), ROUND_KEY);
  await writeState(page, { ...base, level: 'A1', cards: Object.fromEntries(Object.entries(base.cards).filter(([k]) => !k.startsWith('v:'))) });
  await nav('#/play/match');
  await page.waitForSelector('button.match-tile.he.letter:not([disabled])');
  const letters = (await board(page)).filter((x) => x.side === 'he');
  check(letters.length === 5 && letters.every((x) => x.pair === `a:${x.text}` && /^[א-ת]$/.test(x.text)), `A1 with few words: letters ↔ their names (${letters.map((x) => x.text).join(' ')})`);
  await shot('play-match-letters');
  check(await playTap(null, 90), 'a letters round plays to the result card');

  await page.evaluate((k) => localStorage.removeItem(k), ROUND_KEY);
  await writeState(page, { ...base, settings: { ...base.settings, verbsOnly: true } });
  await nav('#/play/match');
  await page.waitForSelector('.game[data-game="match"] button.match-tile.he:not([disabled])');
  const infs = (await board(page)).filter((x) => x.side === 'he');
  check(infs.length === 5 && infs.every((x) => verbs.find((v) => `vp:${v.id}` === x.pair)?.inf === x.text), `verbs only: infinitives ↔ English (${infs.map((x) => x.text).join(' ')})`);
  await shot('play-match-verbs');
  await nav('#/today');
  await writeState(page, base);
}

// He or She? (gender): a real noun on the scale, נקבה ♀ on the left and זכר ♂
// on the right (always there, big, in the bottom half), every right key checked
// against the noun's gender in the content, every 5th noun a plural question
// (the real plural or the ים↔ות swap), a miss tips the scale and holds on
// Continue, surprises get their note, and the round reaches the result card.
import { readState, ROUND_KEY } from './helpers.mjs';

const isSurprise = (v) => (v.gender === 'f' ? !/[הת]$/.test(v.he.trim()) : /[הת]$/.test(v.he.trim()));
const swapOf = (p) => (/ים$/.test(p) ? `${p.slice(0, -2)}ות` : /ות$/.test(p) ? `${p.slice(0, -2)}ים` : null);

export default async function gender(t) {
  const { page, check, nav, shot, vocab } = t;
  const byId = new Map(vocab.map((v) => [v.id, v]));
  const current = async () => {
    const scale = page.locator('.gender-scale');
    const v = byId.get((await scale.getAttribute('data-vocab')) ?? '');
    return { v, kind: await scale.getAttribute('data-kind'), he: (await page.locator('.gender-word .he-game').textContent())?.trim() ?? '' };
  };

  await nav('#/today');
  await page.evaluate((k) => localStorage.removeItem(k), ROUND_KEY);
  const start = await readState(page);
  await nav('#/play/gender');
  await page.waitForSelector('.game[data-game="gender"] .gender-keys .opt:not([disabled])');
  check((await page.locator('.game').getAttribute('data-total')) === '15', 'He or She? deals 15 nouns');

  // The first noun: a real noun with a gender; the two keys never move.
  const first = await current();
  check(!!first.v && first.v.pos === 'noun' && !!first.v.gender && first.v.he.trim() === first.he && first.kind === 'gender', `the noun is a real noun with a gender (${first.he}, ${first.v?.gender})`);
  const keys = await page.locator('.gender-keys .opt').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { text: e.textContent ?? '', ok: e.dataset.ok === 'true', x: r.left, y: r.top, w: r.width, h: r.height };
    }),
  );
  check(keys.length === 2 && keys[0].text.includes('נקבה') && keys[1].text.includes('זכר') && keys[0].x < keys[1].x, 'נקבה ♀ on the left, זכר ♂ on the right');
  check(keys.every((k) => k.y > 844 / 2 && k.h >= 64 && k.w >= 150), 'two big half-width keys in the bottom half');
  check(keys.filter((k) => k.ok).length === 1 && keys.find((k) => k.ok).text.includes(first.v?.gender === 'f' ? 'נקבה' : 'זכר'), "the right key is the noun's gender in the content");
  await shot('play-gender');

  // A miss: the wrong key ✕, the right one ✓, the scale tips to the real gender, Continue holds.
  await page.locator('.gender-keys .opt:not([data-ok]):not([disabled])').click();
  await page.waitForSelector('.game-continue');
  check((await page.locator('.gender-keys .opt.bad').count()) === 1 && (await page.locator('.gender-keys .opt.ok').count()) === 1, 'a wrong key is marked ✕ and the right one ✓');
  check((await page.locator(`.gender-scale.tilt-${first.v?.gender}`).count()) === 1, "the scale tips to the noun's gender");
  const say = (await page.locator('.gender-say').textContent())?.trim() ?? '';
  check(say.includes(first.he) && say.includes(first.v?.gender === 'f' ? 'אחת' : 'אחד'), `the reveal says it with אחד/אחת (${say})`);
  check((await page.locator('.gender-surprise').count()) === (first.v && isSurprise(first.v) ? 1 : 0), `a surprise note only for a surprise (${first.v && isSurprise(first.v) ? 'surprise' : 'regular'})`);
  await shot('play-gender-miss');
  await page.locator('.game-continue:not([disabled])').click();

  // The rest: each right answer checked against the content, then tapped.
  let checked = 0;
  let agree = 0;
  let plurals = 0;
  let surprises = 0;
  for (let i = 0; i < 40 && !(await page.locator('.result-card').count()); i++) {
    const ready = await page.waitForSelector('.result-card, .game-continue:not([disabled]), .gender-keys .opt[data-ok="true"]:not([disabled])', { timeout: 4000 }).then(
      () => true,
      () => false,
    );
    if (!ready || (await page.locator('.result-card').count())) break;
    if (await page.locator('.game-continue:not([disabled])').count()) {
      await page.locator('.game-continue').click();
      continue;
    }
    const { v, kind, he } = await current();
    const opts = (await page.locator('.gender-keys .opt').allTextContents()).map((x) => x.trim());
    const right = (await page.locator('.gender-keys .opt[data-ok="true"]').allTextContents()).map((x) => x.trim());
    let ok = !!v && v.he.trim() === he && right.length === 1 && opts.length === 2;
    if (kind === 'plural') {
      plurals++;
      const p = v?.plural?.trim() ?? '';
      ok = ok && right[0] === p && opts.includes(swapOf(p) ?? '') && checked % 5 === 3;
      if (plurals === 1) await shot('play-gender-plural');
    } else ok = ok && right[0].includes(v?.gender === 'f' ? 'נקבה' : 'זכר');
    checked++;
    if (ok) agree++;
    else console.log(`     ${kind} ${he}: options ${opts.join(' | ')}, marked ${right.join(' | ')}, content ${v?.gender} ${v?.plural ?? ''}`);
    await page.locator('.gender-keys .opt[data-ok="true"]:not([disabled])').click();
    await page.waitForTimeout(80);
    if (await page.locator('.gender-surprise').count()) {
      if (!surprises) await shot('play-gender-surprise');
      surprises++;
    }
  }
  check(checked === 14 && agree === checked, `every right answer matches the content (${agree}/${checked})`);
  check(plurals === 3, `every 5th noun asks for its plural (${plurals} of 15)`);
  check(surprises >= 3, `surprising nouns get their note (${surprises})`);
  check(await page.locator('.result-card').isVisible(), 'He or She? plays to the result card');
  await page.waitForTimeout(700);
  check((await page.locator('.result-card .star.on').count()) === 2, '14 of 15 first try gives ★★');
  check((await page.locator('.result-misses li').count()) === 1, `the miss is listed (${(await page.locator('.result-misses li').first().textContent().catch(() => ''))?.trim()})`);
  const s = await readState(page);
  check((s.play.plays.gender ?? 0) >= 1 && s.play.best.gender?.score > 0, 'the round is booked');
  check((s.profile?.topics?.g_a1_gender_plural?.n ?? 0) > (start.profile?.topics?.g_a1_gender_plural?.n ?? 0), 'the taps count toward the gender and plural lesson');
  check(Object.keys(s.cards).length === Object.keys(start.cards).length, 'sorting nouns never creates cards');
  await shot('play-gender-result');
}

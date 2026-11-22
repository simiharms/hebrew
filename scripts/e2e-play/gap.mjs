// Gap Dash (gap): a real drill's sentence with its gap, three answers stacked
// in the bottom half with exactly one of them the drill's answer (checked
// against the grammar content for every item), the hint behind 💡, a miss that
// fills the gap with the answer and its explanation and holds on Continue, the
// "Both fit?" flag that keeps the drill out of later rounds, and the result card.
import { readState, ROUND_KEY, writeState } from './helpers.mjs';

const UNFINAL = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
// Like lenient() in src/lib/hebrew.ts: no points, no final letters, no doubled vav/yod.
const lenient = (s) =>
  s
    .replace(/[֑-ׇֽֿׁׂׅׄ'׳]/g, '')
    .replace(/[ךםןףץ]/g, (c) => UNFINAL[c])
    .replace(/יי/g, 'י')
    .replace(/וו/g, 'ו')
    .replace(/\s+/g, ' ')
    .trim();

export default async function gap(t) {
  const { page, check, nav, shot, grammar } = t;
  const drillOf = (key) => {
    const [id, i] = (key ?? '').split('#');
    const lesson = grammar.find((g) => g.id === id);
    return { lesson, drill: lesson?.drills[Number(i)] };
  };
  const current = async () => {
    const key = await page.locator('.gap-card').getAttribute('data-key');
    const opts = await page.locator('.gap-opts .opt').evaluateAll((els) => els.map((e) => ({ text: e.querySelector('.he')?.textContent?.trim() ?? '', ok: e.dataset.ok === 'true' })));
    return { key, ...drillOf(key), opts };
  };
  // Exactly one option is the drill's answer, and no other is any answer the drill accepts.
  const sound = ({ drill, opts }) =>
    !!drill &&
    opts.length === 3 &&
    new Set(opts.map((o) => lenient(o.text))).size === 3 &&
    opts.filter((o) => o.ok).length === 1 &&
    lenient(opts.find((o) => o.ok).text) === lenient(drill.answer[0]) &&
    opts.filter((o) => !o.ok).every((o) => drill.answer.every((a) => lenient(a) !== lenient(o.text)));
  // Plays the round on screen with right answers, checking each item against the content.
  const playChecked = async () => {
    const keys = [];
    let agree = 0;
    for (let i = 0; i < 40 && !(await page.locator('.result-card').count()); i++) {
      const ready = await page.waitForSelector('.result-card, .game-continue:not([disabled]), .gap-opts .opt[data-ok="true"]:not([disabled])', { timeout: 4000 }).then(
        () => true,
        () => false,
      );
      if (!ready || (await page.locator('.result-card').count())) break;
      if (await page.locator('.game-continue:not([disabled])').count()) {
        await page.locator('.game-continue').click();
        continue;
      }
      const it = await current();
      keys.push(it.key);
      if (sound(it)) agree++;
      else console.log(`     ${it.key}: ${it.drill?.prompt} — options ${it.opts.map((o) => `${o.text}${o.ok ? ' ✓' : ''}`).join(' | ')}, answers ${it.drill?.answer.join(' / ')}`);
      await page.locator('.gap-opts .opt[data-ok="true"]:not([disabled])').click();
      await page.waitForTimeout(80);
    }
    return { keys, agree };
  };

  await nav('#/today');
  await page.evaluate((k) => localStorage.removeItem(k), ROUND_KEY);
  const start = await readState(page);
  await nav('#/play/gap');
  await page.waitForSelector('.game[data-game="gap"] .gap-opts .opt:not([disabled])');
  check((await page.locator('.game').getAttribute('data-total')) === '10', 'Gap Dash deals 10 drills');

  // The first drill: its sentence with the gap, its lesson, three stacked answers.
  const first = await current();
  const sentence = (await page.locator('.gap-card .he-lg').textContent()) ?? '';
  check(!!first.drill && first.drill.prompt.split('___').every((part) => sentence.includes(part.trim())), `the card shows a real drill (${first.key}: ${first.drill?.prompt})`);
  check(((await page.locator('.gap-lesson .he').textContent()) ?? '').trim() === first.lesson?.titleHe, `the lesson is named (${first.lesson?.titleHe})`);
  check(((await page.locator('.gap-en').textContent()) ?? '').trim() === first.drill?.en?.trim(), 'the English is under the sentence');
  check(sound(first), `exactly one answer is right (${first.opts.map((o) => `${o.text}${o.ok ? ' ✓' : ''}`).join(' | ')}; the drill takes ${first.drill?.answer.join(' / ')})`);
  const boxes = await page.locator('.gap-opts .opt').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height })));
  check(boxes.every((b) => b.y > 844 / 2 && b.h >= 56 && b.w > 300 && Math.abs(b.x - boxes[0].x) < 1), 'three full-width answers stacked in the bottom half, 56 px or taller');
  check((await page.locator('.gap-opts .opt .he[lang="he"][dir="rtl"]').count()) === 3, 'the answers are marked as Hebrew, right to left');

  // The hint is behind 💡.
  check((await page.locator('.gap-hint').count()) === 0, 'the hint starts hidden');
  await page.locator('.gap-hint-btn').click();
  check(((await page.locator('.gap-hint').textContent()) ?? '').includes(first.drill?.hint ?? '???'), `💡 shows the hint (${first.drill?.hint})`);
  await shot('play-gap');

  // A miss: ✕ and ✓, the gap filled with the answer, the explanation, Continue holds.
  await page.locator('.gap-opts .opt:not([data-ok]):not([disabled])').first().click();
  await page.waitForSelector('.game-continue');
  const answer = first.opts.find((o) => o.ok)?.text ?? '';
  check((await page.locator('.gap-opts .opt.bad').count()) === 1 && (await page.locator('.gap-opts .opt.ok').count()) === 1, 'a wrong answer is marked ✕ and the right one ✓');
  check((await page.locator('.gap-card.bad').count()) === 1 && ((await page.locator('.gap-card .he-lg').textContent()) ?? '').includes(answer), `the gap is filled with the answer (${answer})`);
  check(((await page.locator('.gap-explain').textContent()) ?? '').trim() === first.drill?.explain?.trim(), 'the explanation shows');
  await shot('play-gap-miss');

  // "Both fit?": the drill is remembered and stays out of later rounds.
  await page.locator('.gap-flag').click();
  check(await page.locator('.gap-flagged').isVisible(), 'Both fit? thanks the learner');
  check((await readState(page)).play.flagged.includes(first.key), `the flagged drill is saved (${first.key})`);
  await page.locator('.game-continue:not([disabled])').click();

  const rest = await playChecked();
  check(rest.keys.length === 9 && rest.agree === 9, `every drill has one right answer among three (${rest.agree}/${rest.keys.length})`);
  check(new Set([first.key, ...rest.keys]).size === 10 && new Set([first.key, ...rest.keys].map((k) => k.split('#')[0])).size <= 3, 'ten different drills from at most three lessons');
  check(await page.locator('.result-card').isVisible(), 'Gap Dash plays to the result card');
  await page.waitForTimeout(700);
  check((await page.locator('.result-card .star.on').count()) === 2, '9 of 10 first try gives ★★');
  check((await page.locator('.result-misses li').count()) === 1, `the miss is listed (${(await page.locator('.result-misses li').first().textContent().catch(() => ''))?.trim()})`);
  const s = await readState(page);
  check((s.play.plays.gap ?? 0) >= 1 && s.play.best.gap?.score > 0, 'the round is booked');
  check(Object.keys(s.cards).length === Object.keys(start.cards).length, 'tapping answers never creates cards');
  await shot('play-gap-result');

  // Again: a clean round, and the flagged drill doesn't come back.
  await page.getByRole('button', { name: /Again/ }).click();
  await page.waitForSelector('.gap-opts .opt:not([disabled])');
  const again = await playChecked();
  check(again.keys.length === 10 && again.agree === 10 && !again.keys.includes(first.key), `the next round is sound and skips the flagged drill (${again.agree}/${again.keys.length})`);
  await page.waitForTimeout(700);
  check((await page.locator('.result-card .star.on').count()) === 3, 'all right first try gives ★★★');

  // A right answer stays up long enough to read its explanation, and the
  // lesson title (some end in Hebrew) is isolated from its count.
  await nav('#/play');
  await nav('#/play/gap');
  await page.waitForSelector('.gap-opts .opt[data-ok="true"]:not([disabled])');
  check((await page.locator('.gap-lesson-en bdi').count()) === 1 && (await page.locator('.gap-lesson-en [dir="ltr"]').count()) === 1, 'the lesson title is isolated from its count');
  await page.locator('.gap-opts .opt[data-ok="true"]').click();
  await page.waitForTimeout(1000);
  check((await page.locator('.gap-card.ok').count()) === 1 && (await page.locator('.gap-explain').isVisible()), 'a right answer keeps its explanation on screen');
  // A short screen (an iPhone SE Home-Screen app): Continue scrolls into view after a miss.
  await page.setViewportSize({ width: 375, height: 647 });
  await page.waitForSelector('.gap-opts .opt:not([data-ok]):not([disabled])', { timeout: 4000 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('.gap-opts .opt:not([data-ok]):not([disabled])').first().click();
  await page.waitForSelector('.game-continue');
  await page.waitForTimeout(200);
  const cb = await page.evaluate(() => Math.round(document.querySelector('.game-continue').getBoundingClientRect().bottom));
  check(cb <= 647, `on a short screen Continue is in view after a miss (bottom ${cb}/647)`);
  await shot('play-gap-short');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate((k) => localStorage.removeItem(k), ROUND_KEY);

  // Leave the flags as they were for the checks that follow.
  await nav('#/today');
  const end = await readState(page);
  end.play.flagged = start.play.flagged;
  await writeState(page, end);
}

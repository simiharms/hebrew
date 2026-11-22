// Echo (echo): works with or without a Hebrew voice (headless Chromium has
// none). Start unlocks speech, each sentence is spoken (captured in
// window.__spoken), the verb is blanked, three forms sit at the bottom, a miss
// fills in the right form and the English, and the round reaches the result
// card. Without a Hebrew voice the English is the clue and nothing counts as
// listening.
import { readState, ROUND_KEY } from './helpers.mjs';

export default async function echo(t) {
  const { page, check, nav, playTap, shot, verbs } = t;
  await nav('#/today');
  await page.evaluate((k) => localStorage.removeItem(k), ROUND_KEY);
  const before = await readState(page);
  await nav('#/play/echo');
  await page.waitForSelector('.game[data-game="echo"]');
  const env = await page.evaluate(() => ({
    tts: !!window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined',
    voice: (window.speechSynthesis?.getVoices() ?? []).some((v) => /^(he|iw)([-_]|$)/i.test(v.lang)),
  }));
  console.log(`     (echo: speech ${env.tts ? 'yes' : 'no'}, Hebrew voice ${env.voice ? 'yes' : 'no'})`);
  check((await page.locator('.game').getAttribute('data-total')) === '8', 'Echo deals 8 sentences');

  if (!env.tts) {
    check(await page.getByText('No speech output here').isVisible(), 'without speech output Echo says so');
    await page.getByRole('button', { name: /Play by reading/ }).click();
  } else {
    check(await page.locator('.echo-start').isVisible(), 'the first screen is a Start button');
    check((await page.locator('.echo-warn').count()) === (env.voice ? 0 : 1), env.voice ? 'a Hebrew voice: no warning' : 'no Hebrew voice: a warning, and play still allowed');
    await shot('play-echo-start');
    await page.locator('.echo-start').click();
  }

  await page.waitForSelector('.echo-sentence');
  const listening = env.tts && env.voice;
  const sentence = (await page.locator('.echo-sentence').textContent()) ?? '';
  const [pre, post] = await page.locator('.echo-sentence').evaluate((el) => {
    const nodes = [...el.childNodes];
    const k = nodes.findIndex((n) => n.nodeName === 'SPAN');
    return [nodes.slice(0, k).map((n) => n.textContent).join(''), nodes.slice(k + 1).map((n) => n.textContent).join('')];
  });
  const ex = verbs.flatMap((v) => (v.exs ?? []).map((e) => ({ v, e }))).find(({ e }) => e.he === pre + e.form + post);
  check(!!ex, `the sentence is a verb example with its form blanked (${sentence.trim()})`);
  const opts = page.locator('.game-controls .opt');
  check((await opts.count()) === 3 && (await page.locator('.game-controls .opt[data-ok="true"]').count()) === 1, 'three forms, exactly one right');
  check(((await page.locator('.game-controls .opt[data-ok="true"]').textContent()) ?? '').trim() === ex?.e.form, 'the right one is the form in the sentence');
  const boxes = await page.locator('.game-controls button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ y: r.top, h: r.height })));
  check(boxes.every((b) => b.y > 844 / 2 && b.h >= 52), 'replay keys and forms sit in the bottom half');
  if (listening) check(!(await page.locator('.echo-en.clue').count()), 'the English stays hidden until the answer');
  else check(((await page.locator('.echo-en.clue').textContent()) ?? '').includes(ex?.e.en ?? '?'), 'without a Hebrew voice the English is the clue');
  if (env.tts) {
    await page.waitForFunction((he) => (window.__spoken ?? []).includes(he), ex?.e.he ?? '', { timeout: 3000 }).then(
      () => check(true, 'the sentence is spoken by itself'),
      () => check(false, 'the sentence is spoken by itself'),
    );
    const n = await page.evaluate(() => window.__spoken.length);
    await page.getByRole('button', { name: /slowly/ }).click();
    await page.waitForFunction((k) => window.__spoken.length > k, n, { timeout: 3000 }).then(
      () => check(true, '🐢 plays it again'),
      () => check(false, '🐢 plays it again'),
    );
  }
  await shot('play-echo');

  // A miss: ✕ and ✓, the right form fills the gap, the English and tense show, Continue holds.
  await page.locator('.game-controls .opt:not([data-ok]):not([disabled])').first().click();
  await page.waitForSelector('.game-continue');
  check((await page.locator('.opt.bad').count()) === 1 && (await page.locator('.opt.ok').count()) === 1, 'a wrong form is ✕ and the right one ✓');
  check(((await page.locator('.echo-gap.filled').textContent()) ?? '').trim() === ex?.e.form, 'the right form fills the gap');
  check(((await page.locator('.echo-en').textContent()) ?? '').includes(ex?.e.en ?? '?'), 'the English shows after the answer');
  check((await page.locator('.echo-after .tense-band, .echo-after .echo-inf').count()) === 1, 'and so does the tense');
  await shot('play-echo-miss');

  check(await playTap(null, 40), 'Echo plays to the result card');
  await page.waitForTimeout(700);
  check((await page.locator('.result-card .star.on').count()) === 2, '7 of 8 first try gives ★★');
  check((await page.locator('.result-misses li').count()) === 1, 'the miss is listed to look at again');
  const s = await readState(page);
  check((s.play.plays.echo ?? 0) >= 1, 'the round is booked');
  const n0 = before.profile.skills.listening?.n ?? 0;
  const n1 = s.profile.skills.listening?.n ?? 0;
  check(listening ? n1 > n0 : n1 === n0, listening ? 'answers count as listening' : 'reading mode records no listening');
  await shot('play-echo-result');
}

// Shoresh Play rides: resuming a round after a reload, riding today's line from
// the Today dock, finishing it into the 👑 terminus, and reduced motion.
import { answerOne, hashOf, playTap, readState, ROUND_KEY, todayKey, writeState } from './helpers.mjs';

const TAP_WARMUPS = ['snap', 'sort'];

export default async function ride(t) {
  const { page, check, nav, shot } = t;
  const dock = page.locator('.dock');
  const date = await todayKey(page);

  // Start from a clean day: earlier checks may have left a round or a terminus behind.
  {
    const s = await readState(page);
    s.play.ride = null;
    const log = s.days.find((d) => d.date === date);
    if (log) log.tasks = log.tasks.filter((x) => x !== 'ride');
    await page.evaluate((k) => localStorage.removeItem(k), ROUND_KEY);
    await writeState(page, s);
  }

  // --- resume: answer 3, reload, the dock offers Resume, and it picks up at 4
  await nav('#/play/snap');
  for (let k = 0; k < 3; k++) await answerOne(page);
  const total = await page.locator('.game').getAttribute('data-total');
  await page.reload();
  await page.waitForSelector('.app');
  await nav('#/today');
  check(((await dock.textContent()) ?? '').includes('Resume'), `after a reload the dock offers Resume (${(await dock.textContent())?.trim()})`);
  await shot('play-dock-resume');
  await dock.click();
  await page.waitForSelector('.game');
  check((await page.locator('.game-count').textContent())?.trim() === `4/${total}`, `Resume picks up at 4/${total}`);
  check(await playTap(page, null, 60), 'the resumed round plays to the end');
  check((await page.evaluate((k) => localStorage.getItem(k), ROUND_KEY)) === null, 'a finished round leaves nothing to resume');

  // --- ride: the dock opens stop 1, Next stop opens stop 2, the line shows 1 done
  await nav('#/today');
  check(/Stop 1\/\d/.test((await dock.textContent()) ?? ''), `the dock offers the first stop (${(await dock.textContent())?.trim()})`);
  await dock.click();
  await page.waitForSelector('.game');
  const m = (await hashOf(page)).match(/^#\/play\/(\w+)\/ride$/);
  check(!!m, `the dock opens play/<game>/ride (${await hashOf(page)})`);
  const first = m?.[1] ?? '';
  let s = await readState(page);
  const plan = s.play.ride?.plan ?? [];
  check(s.play.ride?.date === date && plan[0] === first && plan.includes('forge') && new Set(plan).size === plan.length, `today's ride is saved: ${plan.join(' → ')}`);
  check(TAP_WARMUPS.includes(first), `the first stop is a tap warm-up (${first})`);
  check(((await page.locator('.game-title .sub').textContent()) ?? '').includes(`Stop 1/${plan.length}`), 'the game header shows the stop');
  check(await playTap(page, null, 60), `stop 1 (${first}) plays to the end`);
  const nextBtn = page.getByRole('button', { name: /Next stop/ });
  check(await nextBtn.isVisible(), 'the result card offers the next stop');
  await shot('play-ride-result');
  await page.waitForTimeout(450); // the result buttons ignore taps for 400 ms
  await nextBtn.click();
  await page.waitForTimeout(300);
  check((await hashOf(page)) === `#/play/${plan[1]}/ride`, `Next stop opens stop 2 (${await hashOf(page)})`);
  await nav('#/today');
  check((await page.locator('.hero-card .line-map .stop.done').count()) === 1, 'the line map shows 1 stop done');
  check(((await dock.textContent()) ?? '').includes(`Stop 2/${plan.length}`), `the dock moves on to stop 2 (${(await dock.textContent())?.trim()})`);
  await shot('play-today-ride');
  await nav('#/play');
  check((await page.locator('.ride-card .line-map .stop.done').count()) === 1, 'the hub line map shows 1 stop done too');

  // --- finishing the line: with the other stops done, replaying stop 1 ends the line
  s = await readState(page);
  s.play.ride.done = plan.filter((g) => g !== first);
  await writeState(page, s);
  const xpBefore = (await readState(page)).play.xp;
  check(await playTap(page, `#/play/${first}/ride`, 60), 'the last stop plays to the end');
  check(await page.getByText('Line finished').first().isVisible(), 'the result card celebrates the finished line');
  s = await readState(page);
  check(s.days.find((d) => d.date === date)?.tasks.includes('ride') && s.play.xp >= xpBefore + 50, 'the line marks the ride task and pays its +50 XP');
  await shot('play-line-finished');
  const term = page.getByRole('button', { name: /Terminus/ });
  check(await term.isVisible(), 'the result card opens the terminus');
  await page.waitForTimeout(450);
  await term.click();
  await page.waitForTimeout(300);
  check((await hashOf(page)) === '#/play/smash/terminus', 'the terminus is Table Smash');
  check(((await page.locator('.game-title .sub').textContent()) ?? '').includes('XP ×2'), 'the terminus pays XP ×2');
  await nav('#/today');
  check((await dock.getAttribute('data-kind')) === 'terminus', `the dock offers the terminus (${(await dock.textContent())?.trim()})`);
  s = await readState(page);
  s.play.ride.terminus = true;
  await writeState(page, s);
  await nav('#/today');
  check(['six', 'free'].includes((await dock.getAttribute('data-kind')) ?? ''), `after the terminus the dock offers Verb of the Day or free play (${(await dock.textContent())?.trim()})`);

  // --- reduced motion: a ★★★ round draws no confetti
  await page.emulateMedia({ reducedMotion: 'reduce' });
  check(await playTap(page, '#/play/snap', 60), 'a round plays with reduced motion');
  check((await page.locator('.game[data-calm]').count()) === 1, 'reduced motion puts the game in calm mode');
  check((await page.locator('.star.on').count()) === 3 && (await page.locator('.burst').count()) === 0, '★★★ with reduced motion: no confetti');
  await page.emulateMedia({ reducedMotion: null });
  await nav('#/today');
}

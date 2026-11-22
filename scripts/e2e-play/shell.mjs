// Shoresh Play shell: the tab bar, the Today hero and dock, the Play hub, the
// verb collection, Stories (Read ↔ Listen), focus mode and the Games settings.
import { hashOf, readState } from './helpers.mjs';

export default async function shell(t) {
  const { page, check, nav, shot } = t;

  // --- tab bar: Today · Words · Play (centre) · Stories · Practice
  await nav('#/today');
  const tabs = (await page.locator('.tabbar .tab').allTextContents()).map((x) => x.replace(/\p{Extended_Pictographic}|️/gu, '').trim());
  check(tabs.join(',') === 'Today,Words,Play,Stories,Practice', `tab bar: ${tabs.join(' · ')}`);
  check((await page.locator('.tabbar .tab').nth(2).getAttribute('class'))?.includes('tab-play'), 'Play is the middle tab');

  // --- Today: one hero card and the dock above the tab bar
  check((await page.locator('.hero-card').count()) === 1 && (await page.locator('.hero-card .line-map').isVisible()), 'Today shows the play hero with the line map');
  const dock = page.locator('.dock');
  check(await dock.isVisible(), `Today shows the dock (${(await dock.textContent().catch(() => ''))?.trim()})`);
  const db = await dock.boundingBox();
  const tb = await page.locator('.tabbar').boundingBox();
  check(!!db && !!tb && db.y + db.height <= tb.y && db.y > 844 / 2, 'the dock sits in the bottom half, above the tab bar');
  await shot('play-today');

  // --- Play hub
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForTimeout(250);
  check((await hashOf(page)) === '#/play', 'the Play tab opens the hub');
  check((await page.locator('.tab-play.active').count()) === 1, 'the Play tab is active on the hub');
  const tiles = await page.locator('.game-tile').count();
  check(tiles >= 9, `the hub lists every game (${tiles} tiles)`);
  check(await page.locator('.ride-card .line-map').isVisible(), 'the hub shows the ride card with the line map');
  check((await page.locator('.game-sprint').count()) === 2, 'Time Machine and Match Rush offer a sprint');
  await shot('play-hub');
  await page.emulateMedia({ colorScheme: 'dark' });
  await shot('play-hub-dark');
  await page.emulateMedia({ colorScheme: 'light' });

  // --- bus settings on the hub
  await page.getByRole('button', { name: /Calm/ }).click();
  check((await readState(page)).settings.calm === true, 'the Calm chip turns calm motion on');
  await page.getByRole('button', { name: /Calm/ }).click();
  check((await readState(page)).settings.calm === false, '…and off again');

  // --- verb collection
  await page.getByRole('button', { name: /Verb collection/ }).click();
  await page.waitForTimeout(250);
  check((await hashOf(page)) === '#/play/collection', 'the hub links to the verb collection');
  check((await page.locator('.vchip').count()) === t.verbs.length, `the collection lists all ${t.verbs.length} verbs`);
  check(await page.getByText('Medals come only from typed and built answers').isVisible(), 'the collection says where medals come from');
  check((await page.locator('.badge-tile').count()) === 9, 'the collection shows the 9 badges');
  check((await page.locator('.tabbar').count()) === 1, 'the collection keeps the tab bar');
  await shot('play-collection');
  await page.locator('.vchip').first().click();
  await page.waitForTimeout(250);
  check((await hashOf(page)).startsWith('#/verb/'), 'a verb chip opens its verb page');

  // --- a game is focus mode: no tab bar, ✕ goes back to the hub
  await nav('#/play/snap');
  check((await page.locator('.game').count()) === 1 && (await page.locator('.tabbar').count()) === 0, 'a game hides the tab bar');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(250);
  check((await hashOf(page)) === '#/play', '✕ in free play goes back to the hub');
  await nav('#/play/nonsense');
  check((await page.locator('.game-tile').count()) >= 9, 'an unknown game falls back to the hub');

  // --- Stories: Read ↔ Listen
  await page.getByRole('button', { name: 'Stories', exact: true }).click();
  await page.waitForTimeout(250);
  check((await hashOf(page)) === '#/read' && (await page.locator('.stories-switch').isVisible()), 'Stories opens the reading list with the switch');
  await page.locator('.stories-switch').getByRole('button', { name: /Listen/ }).click();
  await page.waitForTimeout(250);
  check((await hashOf(page)) === '#/listen' && (await page.locator('.tab-read.active').count()) === 1, 'the switch opens Listen, still under Stories');
  await shot('play-stories-listen');
  await page.locator('.stories-switch').getByRole('button', { name: /Read/ }).click();
  await page.waitForTimeout(250);
  check((await hashOf(page)) === '#/read', 'the switch goes back to Read');

  // --- Games settings
  await nav('#/me');
  check(await page.getByText('Stops per ride').isVisible(), 'settings have a Games section');
  await page.getByRole('button', { name: '4 stops', exact: true }).click();
  check((await readState(page)).settings.rideStops === 4, 'stops per ride can be set to 4');
  await page.getByRole('button', { name: '3 stops', exact: true }).click();
  check((await readState(page)).settings.rideStops === 3, '…and back to 3');
  await nav('#/today');
}

// End-to-end check of the built app in headless Chromium at iPhone size.
// Builds nothing: run `npm run build` first. Starts `vite preview` itself.
// Usage: node scripts/e2e.mjs [--shots <dir>]
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const shotsIdx = process.argv.indexOf('--shots');
const SHOTS = shotsIdx > 0 ? process.argv[shotsIdx + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;

const lessons = readdirSync('src/content')
  .filter((f) => /^lesson-\d\d\.json$/.test(f))
  .sort()
  .map((f) => JSON.parse(readFileSync(`src/content/${f}`, 'utf8')));

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
// npx starts vite as a child: stop the whole process group.
const stopServer = () => {
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    // already gone
  }
};
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('preview did not start')), 20000);
  server.stdout.on('data', (d) => {
    if (String(d).includes(String(PORT))) {
      clearTimeout(t);
      resolve();
    }
  });
});

// Stop the preview server however this script ends.
process.on('exit', stopServer);
process.on('uncaughtException', (e) => {
  console.error(e);
  stopServer();
  process.exit(1);
});

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE' });
const page = await ctx.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));

let step = 0;
async function shot(name) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${String(++step).padStart(2, '0')}-${name}.png`, fullPage: false });
}
async function visit(hash) {
  // Same-document navigation, like tapping a link in the app.
  await page.evaluate((h) => {
    location.hash = `#/${h}`;
  }, hash);
  await page.waitForTimeout(150);
  const at = await page.evaluate(() => decodeURIComponent(location.hash));
  if (at !== `#/${hash}`) problems.push(`navigation to #/${hash} ended at ${at}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) problems.push(`horizontal overflow ${overflow}px on #/${hash}`);
  const text = await page.evaluate(() => document.body.innerText);
  if (/Nicht gefunden|undefined|NaN|\[object Object\]/.test(text)) problems.push(`suspicious text on #/${hash}: ${text.match(/.{0,40}(Nicht gefunden|undefined|NaN|\[object Object\]).{0,40}/)?.[0]}`);
}
const expect = async (selector, what) => {
  if (!(await page.locator(selector).first().isVisible().catch(() => false))) problems.push(`missing: ${what} (${selector})`);
};

// 1. Onboarding
await page.goto(BASE);
await page.waitForSelector('text=Velkommen!');
await shot('welcome');
await page.click('text=Los geht');
await page.click('.lesson-pick >> nth=0');
await shot('pick-lesson');
await page.click('text=Weiter');
await page.click('text=Fertig – zur App');
await page.waitForSelector('text=Deine Lektion');
await shot('today');

// 2. Lesson 1 walk-through
const L1 = lessons[0];
await visit('lektion/1');
await expect('.item', 'lesson steps');
await shot('lesson');
await visit('lektion/1/text');
await expect('.text-card .line', 'text lines');
await page.locator('.text-card .w').nth(2).click();
await expect('.sheet', 'gloss sheet');
await shot('gloss');
const glossText = await page.locator('.sheet').innerText();
if (/noch nicht im Wörterbuch/.test(glossText)) problems.push(`gloss: tapped word not in dictionary: ${glossText.split('\n')[0]}`);
await page.click('.sheet-backdrop', { position: { x: 20, y: 20 } });

// Word session: flip cards
await visit('lernen/lektion/1');
for (let i = 0; i < 4; i++) {
  const intro = page.locator('text=Weiter – abfragen');
  if (await intro.isVisible().catch(() => false)) {
    if (i === 0) await shot('new-word');
    await intro.click();
  }
  await page.click('text=Umdrehen');
  if (i === 0) await shot('card-back');
  await page.click('.btn.rate >> nth=2');
}

// Grammar drill: type the canonical answer of the first drill
const g = L1.grammar[0];
await visit(`lektion/1/grammatik/${g.id}`);
await shot('grammar');
await page.click('text=Üben');
await page.locator('input.answer').first().fill(g.drills[0].answer[0]);
await page.locator('text=Prüfen').first().click();
await expect('.feedback.ok', 'drill accepted');
await shot('drill');

// Exercises
await visit('lektion/1/uebungen');
await page.locator('.btn.choice').first().click();
await expect('.feedback', 'true/false feedback');
await shot('exercises');

// Other screens
for (const h of ['lektion/1/woerterkiste', 'lektion/1/hoeren', 'lektion/1/schreiben', 'lektion/1/test', 'woerter', 'woerter/1', 'verben', 'grammatik', 'ueben', 'zahlen', 'hoertraining', 'aussprache', 'fehler', 'einstellungen', 'ueber', 'lektionen']) {
  await visit(h);
  if (['lektion/1/test', 'verben', 'zahlen', 'einstellungen', 'lektionen'].includes(h)) await shot(h.replace(/\//g, '-'));
}
await visit('verben/training');
await page.locator('input.answer').fill('xxx');
await page.click('text=Prüfen');
await expect('.feedback', 'verb feedback');
await shot('verb-training');
const firstVerb = await page.evaluate(() => location.hash);
void firstVerb;

// 2b. Whole flows: each must reach its end screen.
const vocab = Object.fromEntries(
  readdirSync('src/content')
    .filter((f) => /^vocab-\d\d\.json$/.test(f))
    .map((f) => [f, JSON.parse(readFileSync(`src/content/${f}`, 'utf8'))]),
);
const allWords = Object.values(vocab).flat();

// Phrase cards (Wörterkiste): flip and rate until done.
await visit('lernen/wk/1');
for (let k = 0; k < 40 && !(await page.locator('text=Bra jobba!').isVisible().catch(() => false)); k++) {
  const intro = page.locator('text=Weiter – abfragen');
  if (await intro.isVisible().catch(() => false)) await intro.click();
  await page.click('text=Umdrehen');
  await page.click('.btn.rate >> nth=2');
}
await expect('text=Bra jobba!', 'phrase session end screen');

// Typed reviews: answer every card from the vocabulary.
await page.waitForTimeout(500); // let the session's own last save land first
await page.evaluate(() => {
  const k = 'nordlys-state-v1';
  const s = JSON.parse(localStorage.getItem(k));
  s.settings.reviewMode = 'type';
  localStorage.setItem(k, JSON.stringify(s));
});
await page.reload();
await visit('lernen/lektion/2');
let typed = 0;
for (let k = 0; k < 30 && !(await page.locator('text=Bra jobba!').isVisible().catch(() => false)); k++) {
  const intro = page.locator('text=Weiter – abfragen');
  if (await intro.isVisible().catch(() => false)) await intro.click();
  const no = await page.locator('.prompt-box .no-xl').first().textContent().catch(() => null);
  const de = await page.locator('.prompt-box .big-de').first().textContent().catch(() => null);
  let answer = 'xxx';
  if (no) {
    const bare = no.replace(/^(en|ei|et|å) /, '');
    answer = allWords.find((w) => w.no === bare)?.de ?? 'xxx';
  } else if (de) answer = allWords.find((w) => w.de === de)?.no ?? 'xxx';
  if (!(await page.locator('input.answer').isVisible().catch(() => false))) {
    problems.push(`typed review: no input. Screen: ${(await page.evaluate(() => document.body.innerText)).slice(0, 300)}`);
    break;
  }
  await page.locator('input.answer').fill(answer);
  await page.click('text=Prüfen');
  if (answer !== 'xxx' && (await page.locator('.feedback.ok, .feedback.close').count()) === 0) problems.push(`typed review rejected "${answer}" for ${no ?? de}`);
  typed++;
  if (k === 0) await shot('typed-review');
  await page.click('button:text-is("Weiter")');
}
await expect('text=Bra jobba!', `typed session end screen (after ${typed} cards)`);

// Lesson test: wrong answers all the way to the result.
await visit('lektion/2/test');
for (let k = 0; k < 10; k++) {
  await page.locator('input.answer').fill('feil');
  await page.click('text=Prüfen');
  await page.click('.btn-row .btn.primary');
}
await expect('text=von 10', 'lesson test result');

// Verb trainer: a full round.
await visit('verben/training');
for (let k = 0; k < 12; k++) {
  await page.locator('input.answer').fill('feil');
  await page.click('text=Prüfen');
  await page.click('button:text-is("Weiter")');
}
await expect('text=Noch eine Runde', 'verb trainer result');

// Listening trainer (choose the meaning): a full round.
await visit('hoertraining');
for (let k = 0; k < 8; k++) {
  await page.locator('.choice-grid .btn.choice').first().click();
  await page.click('button:text-is("Weiter")');
}
await expect('text=Neue Runde', 'listening trainer result');

// Numbers: every mode answers and moves on.
for (const mode of ['Hören', 'Schreiben', 'Uhrzeit', 'Datum']) {
  await visit('zahlen');
  await page.click(`.seg button:has-text("${mode}")`);
  await page.locator('input.answer').fill('17');
  await page.click('text=Prüfen');
  await expect('.feedback', `numbers feedback (${mode})`);
  await page.click('text=Nächste');
}

// Backup: export a file, import it again.
await visit('einstellungen');
const [download] = await Promise.all([page.waitForEvent('download'), page.click('text=Sicherung speichern')]);
const backupPath = await download.path();
await page.setInputFiles('input[type=file]', backupPath);
await page.waitForTimeout(200);
if (!(await page.locator('text=Sicherung geladen').isVisible().catch(() => false))) problems.push('backup import gave no confirmation');

// 3. Every lesson: all its screens render without errors
for (const L of lessons) {
  const n = L.n;
  await visit(`lektion/${n}`);
  await visit(`lektion/${n}/text`);
  for (const x of L.extra) await visit(`lektion/${n}/lesen/${x.id}`);
  for (const gr of L.grammar) await visit(`lektion/${n}/grammatik/${gr.id}`);
  await visit(`lektion/${n}/uebungen`);
  await visit(`lektion/${n}/woerterkiste`);
  await visit(`lektion/${n}/hoeren`);
  await visit(`lektion/${n}/schreiben`);
  await visit(`lektion/${n}/test`);
  await visit(`woerter/${n}`);
}

// 4. Dark mode and big text don't break the layout
await page.emulateMedia({ colorScheme: 'dark' });
await page.evaluate(() => {
  const k = 'nordlys-state-v1';
  const s = JSON.parse(localStorage.getItem(k));
  s.settings.fontScale = 1.3;
  localStorage.setItem(k, JSON.stringify(s));
});
await visit('heute');
await page.reload();
await shot('today-dark-big');
await visit('lektion/3/text');
await shot('text-dark-big');

await browser.close();
stopServer();
if (problems.length) {
  console.log(`✗ ${problems.length} problem(s):`);
  for (const p of [...new Set(problems)]) console.log('  - ' + p);
  process.exit(1);
}
console.log(`✓ e2e OK (${lessons.length} lessons checked)`);

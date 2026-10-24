// End-to-end test: drives the built app in headless Chromium (iPhone viewport)
// through the main flows, typing correct answers taken from the content files.
// Usage: node scripts/e2e.mjs [baseUrl] [screenshotDir]
import { chromium } from 'playwright-core';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3];
if (out) mkdirSync(out, { recursive: true });

const dir = new URL('../src/content/', import.meta.url);
const load = (prefix) =>
  readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
const vocab = load('vocab');
const verbs = load('verbs');
const readings = load('readings');
const scenes = load('scenes');
const grammar = load('grammar');

const byEn = new Map();
for (const v of vocab) if (!byEn.has(v.en)) byEn.set(v.en, v);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
// Remember what the app reads aloud, so listening exercises can be answered.
await ctx.addInitScript(() => {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const orig = synth.speak.bind(synth);
  window.__spoken = [];
  synth.speak = (u) => {
    window.__spoken.push(u.text);
    orig(u);
  };
});
const page = await ctx.newPage();
const lastSpoken = () => page.evaluate(() => window.__spoken?.at(-1) ?? '');
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};
const shot = async (name) => out && page.screenshot({ path: `${out}/${name}.png` });
const nav = async (hash) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForTimeout(250);
};

// --- onboarding
await page.goto(base);
await page.getByText("Let's set up").click();
await page.getByText('Next →').click();
await page.getByRole('button', { name: 'B1', exact: true }).click();
await page.getByText(/Start at B1/).click();
await page.waitForTimeout(200);
check(await page.getByText("Today's plan").isVisible(), 'onboarding leads to Today');
await shot('e2e-today');

// --- word session: answer every prompt correctly
await nav('#/session/words');
let steps = 0;
let typed = 0;
let correct = 0;
page.setDefaultTimeout(5000);
const noWords = await page.getByText('All caught up').isVisible().catch(() => false);
while (!noWords && steps++ < 60) {
  if (await page.getByText('Session done').isVisible().catch(() => false)) break;
  const gotIt = page.getByRole('button', { name: 'Got it →' });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click();
    continue;
  }
  const cont = page.getByRole('button', { name: 'Continue →' });
  if (await cont.isVisible().catch(() => false)) {
    await cont.click();
    continue;
  }
  const badge = (await page.locator('.card .badge').first().textContent()) ?? '';
  let answer = null;
  if (badge.includes('English → Hebrew')) {
    const en = (await page.locator('.big-en').textContent())?.trim();
    const hint = page.locator('.prompt-box .hint .he');
    const first = (await hint.count()) ? (await hint.textContent())?.trim() : null;
    const cands = vocab.filter((v) => v.en === en && (!first || v.he.startsWith(first)));
    answer = cands.length === 1 ? cands[0].he.split('/')[0] : (byEn.get(en)?.he.split('/')[0] ?? null);
  } else if (badge.includes('What does it mean')) {
    const he = (await page.locator('.prompt-box .he-xl').textContent())?.trim();
    answer = vocab.find((v) => v.he === he)?.en ?? null;
  }
  if (answer) {
    await page.locator('input.answer').fill(answer);
    await page.getByRole('button', { name: 'Check' }).click();
    typed++;
    if (await page.getByText('✓ Correct').isVisible().catch(() => false)) correct++;
    if (typed === 1) await shot('e2e-word-feedback');
  } else {
    await page.getByRole('button', { name: "I don't know" }).click();
  }
}
if (noWords) check(vocab.length === 0, 'word session has words (no vocab files yet?)');
else {
  check(typed > 0 && correct === typed, `word session: ${correct}/${typed} typed answers accepted`);
  check(await page.getByText('Session done').isVisible(), 'word session completes');
}

// --- verb drill (conjugation only)
await nav('#/session/vkind/conjugate');
let vOk = 0;
let vTotal = 0;
const TENSE = { present: 'present', past: 'past', future: 'future' };
for (let i = 0; i < 4; i++) {
  const inf = (await page.locator('.prompt-box .he-lg').textContent())?.trim();
  const line = (await page.locator('.prompt-box .big-en').textContent())?.trim() ?? '';
  const [who, tense] = line.split(' · ');
  const verb = verbs.find((v) => v.inf === inf);
  const map = {
    present: { 'I (m)': 'ms', 'you (m)': 'ms', he: 'ms', 'I (f)': 'fs', 'you (f)': 'fs', she: 'fs', 'we (m)': 'mp', 'you (m pl)': 'mp', 'they (m)': 'mp', 'we (f)': 'fp', 'you (f pl)': 'fp', 'they (f)': 'fp' },
    past: { I: '1s', 'you (m)': '2ms', 'you (f)': '2fs', he: '3ms', she: '3fs', we: '1p', 'you (pl)': '2mp', 'you (f pl)': '2fp', 'they (m)': '3p', 'they (f)': '3p' },
    future: { I: '1s', 'you (m)': '2ms', 'you (f)': '2fs', he: '3ms', she: '3fs', we: '1p', 'you (m pl)': '2mp', 'you (f pl)': '2mp', 'they (m)': '3p', 'they (f)': '3p' },
  };
  const key = map[TENSE[tense]]?.[who];
  const form = verb?.[tense]?.[key]?.[0];
  if (!form) {
    check(false, `verb prompt parse: ${inf} / ${line}`);
    break;
  }
  await page.locator('input.answer').fill(form);
  await page.getByRole('button', { name: 'Check' }).click();
  vTotal++;
  if (await page.getByText('✓ Correct').isVisible()) vOk++;
  if (i === 0) await shot('e2e-verb');
  await page.getByRole('button', { name: 'Continue →' }).click();
}
check(vTotal === 4 && vOk === 4, `verb drill: ${vOk}/${vTotal} correct`);

const tablesOf = (v) => ['present', 'past', 'future', 'imp'].flatMap((t) => Object.values(v[t] ?? {}).map((f) => [t, f[0]]));

// --- verbs in a sentence: the gap is the form used in one of the verb's examples
await nav('#/session/vkind/context');
let cOk = 0;
for (let i = 0; i < 3; i++) {
  const inf = (await page.locator('.prompt-box .hint .he').textContent())?.trim();
  const verb = verbs.find((v) => v.inf === inf);
  const [before, after] = await page.locator('.prompt-box [dir=rtl]').evaluate((el) => {
    const nodes = [...el.childNodes];
    const k = nodes.findIndex((n) => n.nodeName === 'SPAN');
    const text = (xs) => xs.map((n) => n.textContent).join('');
    return [text(nodes.slice(0, k)), text(nodes.slice(k + 1))];
  });
  const sentences = [verb?.ex, ...(verb?.exs ?? [])].filter(Boolean).map((e) => e.he);
  const form = tablesOf(verb ?? {}).map(([, f]) => f).find((f) => sentences.includes(before + f + after)) ?? tablesOf(verb ?? {}).map(([, f]) => f).find((f) => (before + f + after).trim().endsWith('.') && before.split(' ').length <= 3);
  await page.locator('input.answer').fill(form ?? '?');
  await page.getByRole('button', { name: 'Check' }).click();
  if (await page.getByText('✓ Correct').isVisible()) cOk++;
  if (i === 0) await shot('e2e-verb-context');
  await page.getByRole('button', { name: 'Continue →' }).click();
}
check(cOk === 3, `verbs in a sentence: ${cOk}/3 correct`);

// --- recognise the form: pick the tense and person
await nav('#/session/vkind/identify');
let idOk = 0;
for (let i = 0; i < 3; i++) {
  const form = (await page.locator('.prompt-box .he-xl').textContent())?.trim();
  const en = (await page.locator('.prompt-box .small.muted').first().textContent())?.trim();
  const verb = verbs.find((v) => v.en === en && tablesOf(v).some(([, f]) => f === form));
  const [tense] = tablesOf(verb).find(([, f]) => f === form);
  const label = { present: 'Present', past: 'Past', future: 'Future', imp: 'Command' }[tense];
  await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
  const person = Object.entries(verb[tense]).find(([, f]) => f[0] === form)[0];
  const buttons = page.locator('.choice-grid').nth(1).locator('button');
  const keys = tense === 'present' ? ['ms', 'fs', 'mp', 'fp'] : tense === 'imp' ? ['ms', 'fs', 'mp'] : Object.keys(verb[tense]);
  await buttons.nth(keys.indexOf(person)).click();
  if (await page.getByText('Right!').isVisible()) idOk++;
  if (i === 0) await shot('e2e-verb-identify');
  await page.getByRole('button', { name: 'Continue →' }).click();
}
check(idOk === 3, `recognise the form: ${idOk}/3 right`);

// --- table challenge: fill the whole past tense of the first verb
const tv = verbs.find((v) => v.past && !v.rare?.includes('past'));
await nav(`#/verbs/table/${tv.id}/past`);
const order = ['1s', '2ms', '2fs', '3ms', '3fs', '1p', '2mp', '2fp', '3p'];
const inputs = page.locator('input.answer');
for (let k = 0; k < order.length; k++) await inputs.nth(k).fill(tv.past[order[k]][0]);
await page.getByRole('button', { name: 'Check the table' }).click();
check(await page.getByText(`${order.length} / ${order.length} forms right`).isVisible(), `table challenge: whole past of ${tv.inf}`);
await shot('e2e-table');

// --- card decks: flip through the alphabet
await nav('#/deck/alpha');
await page.getByRole('button', { name: /Flip cards/ }).click();
for (let k = 0; k < 40; k++) {
  if (await page.getByText('Session done').isVisible().catch(() => false)) break;
  await page.getByRole('button', { name: 'Show answer' }).click();
  if (k === 0) await shot('e2e-deck-card');
  await page.getByRole('button', { name: 'Good' }).click();
}
check(await page.getByText('Session done').isVisible(), 'alphabet deck: flip session completes');
const decksSaved = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('shoresh-state-v1') ?? '{}').cards ?? {}).filter((k) => k.startsWith('a:')).length);
check(decksSaved >= 10, `alphabet cards scheduled (${decksSaved})`);

// --- verbs-only mode turns Today into verb practice
await nav('#/today');
await page.getByRole('button', { name: /Verbs only/ }).click();
check(await page.getByText('Today: verbs only').isVisible() && (await page.getByText(/Table challenge:/).isVisible()), 'verbs-only mode: the plan is all verbs');
await shot('e2e-verbs-only');
await page.getByRole('button', { name: /Verbs only/ }).click();

// --- reading: tap a word, answer a question with the model answer
const r = readings.find((x) => x.level === 'B1') ?? readings[0];
if (r) {
  await nav(`#/read/${r.id}`);
  await page.locator('.w').nth(3).click();
  await page.waitForTimeout(150);
  check(await page.locator('.sheet').isVisible(), 'tap-to-gloss sheet opens');
  await shot('e2e-gloss');
  await page.getByRole('button', { name: 'Close' }).click();
  const q = r.questions[0];
  await page.locator('input.answer').first().fill(q.answer);
  await page.getByRole('button', { name: 'Check' }).first().click();
  const bad = await page.locator('.badge.kw.bad').count();
  check(bad === 0, `reading: model answer matches all key ideas (${r.id})`);
  await page.getByRole('button', { name: '✓ Got it' }).first().click();
  await shot('e2e-reading-question');
} else check(false, 'readings present');

// --- reading exercises: true/false, find the word, summary
const rx = readings.find((x) => x.tf?.length && x.find?.length && x.summary?.length);
if (rx) {
  await nav(`#/read/${rx.id}`);
  const tfCards = page.locator('.card.tight', { has: page.locator('.choice-grid') });
  for (let k = 0; k < rx.tf.length; k++) await tfCards.nth(k).getByRole('button', { name: rx.tf[k].a ? /true/ : /false/ }).click();
  check((await page.locator('.feedback.ok', { hasText: /^(True|False)\./ }).count()) === rx.tf.length, `true/false: all ${rx.tf.length} right (${rx.id})`);
  const findCard = page.locator('.card', { hasText: 'Find the Hebrew word' });
  for (let k = 0; k < rx.find.length; k++) {
    await findCard.locator('input.answer').nth(k).fill(rx.find[k].answer[0]);
    await findCard.getByRole('button', { name: 'Check' }).first().click();
  }
  check((await findCard.locator('input.answer.ok').count()) === rx.find.length, `find the word: all ${rx.find.length} found`);
  const sumTitle = page.locator('.section-title', { hasText: 'Complete the summary' });
  await sumTitle.scrollIntoViewIfNeeded();
  const drillCards = page.locator('.section-title:has-text("Complete the summary") ~ .card');
  await drillCards.first().locator('input.answer').fill(rx.summary[0].answer[0]);
  await drillCards.first().getByRole('button', { name: 'Check' }).click();
  check(await drillCards.first().getByText('✓ Correct').isVisible(), 'summary gap accepts the canonical answer');
  await shot('e2e-reading-exercises');
} else check(false, 'a reading with true/false, find and summary');

// --- listening practice: hear a sentence, pick its meaning
const sentences = [
  ...scenes.flatMap((x) => x.lines),
  ...vocab.map((v) => v.ex),
  ...verbs.flatMap((v) => [v.ex, ...(v.exs ?? [])]),
  ...readings.flatMap((x) => x.paragraphs),
];
await nav('#/listen/train');
await page.getByRole('button', { name: /What does it mean/ }).click();
await page.getByRole('button', { name: 'Start' }).click();
let lOk = 0;
for (let k = 0; k < 3; k++) {
  await page.waitForTimeout(400);
  const he = await lastSpoken();
  const en = sentences.find((x) => x.he === he)?.en;
  await page.getByRole('button', { name: en, exact: true }).click();
  if (await page.locator('.btn.choice.right', { hasText: en }).isVisible()) lOk++;
  await page.getByRole('button', { name: 'Next →' }).click();
}
check(lOk === 3, `listening practice: ${lOk}/3 meanings right`);

// --- scene: transcript and dictation
const sc = scenes[0];
if (sc) {
  await nav(`#/listen/${sc.id}`);
  await page.getByRole('button', { name: /Show transcript/ }).click();
  check((await page.locator('.line').count()) === sc.lines.length, 'scene transcript shows every line');
  if (sc.dictation.length) {
    const lineText = sc.lines[sc.dictation[0]].he;
    const dict = page.locator('.card', { hasText: 'Type exactly what you hear' }).first();
    await dict.locator('input.answer').fill(lineText);
    await dict.getByRole('button', { name: 'Check' }).click();
    check(await dict.getByText('100% of words').isVisible(), 'dictation of exact line scores 100%');
  }
  await shot('e2e-scene');
} else check(false, 'scenes present');

// --- grammar drill
const g = grammar[0];
if (g) {
  await nav(`#/grammar/${g.id}`);
  await page.getByRole('button', { name: 'Start practice' }).click();
  await page.locator('input.answer').first().fill(g.drills[0].answer[0]);
  await page.getByRole('button', { name: 'Check' }).first().click();
  check(await page.getByText('✓ Correct').first().isVisible(), `grammar drill accepts canonical answer (${g.id})`);
  await shot('e2e-grammar');
} else check(false, 'grammar present');

// --- numbers: write mode
await nav('#/numbers');
await page.getByRole('button', { name: /Write in words/ }).click();
await page.locator('input.answer').fill('אחת');
await page.getByRole('button', { name: 'Check' }).click();
check(await page.locator('.feedback').isVisible(), 'numbers gives feedback');
await shot('e2e-numbers');

// --- skills check: answer everything with "I don't know" and save the profile
await nav('#/assessment');
await page.getByRole('button', { name: 'Start' }).click();
for (let k = 0; k < 120; k++) {
  if (await page.getByRole('button', { name: 'Save and start' }).isVisible().catch(() => false)) break;
  const next = page.getByRole('button', { name: 'Next →' });
  if (await next.isVisible().catch(() => false)) {
    await next.click();
    continue;
  }
  await page.getByRole('button', { name: "I don't know" }).click();
}
check(await page.getByText('Your Hebrew profile').isVisible(), 'skills check reaches the profile');
await shot('e2e-assessment-result');
await page.getByRole('button', { name: 'Save and start' }).click();
await page.waitForTimeout(300);
const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('shoresh-state-v1') ?? '{}').profile);
check(!!profile?.assessment?.level, `assessment saved (overall ${profile?.assessment?.level})`);
check(await page.locator('.section-title', { hasText: /focus:/i }).isVisible(), 'today plan shows a focus skill');
await shot('e2e-today-tailored');

// --- course
await nav('#/course');
check((await page.locator('.item').count()) >= 36, 'course lists all A1–C1 units');
await nav('#/unit/0/check');
const firstDrill = grammar.find((g) => g.id === 'g_roots') ?? grammar[0];
check(await page.locator('.prompt-box').isVisible(), `unit check opens (${firstDrill.id})`);
await shot('e2e-unit-check');

// --- persistence across reload
await page.reload();
await page.waitForTimeout(300);
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shoresh-state-v1') ?? '{}'));
check(!!saved.profile?.assessment && Object.keys(saved.profile?.skills ?? {}).length > 2 && saved.days?.length > 0, 'progress persisted across reload');

check(errors.length === 0, `no page errors${errors.length ? ':\n' + errors.join('\n') : ''}`);
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);

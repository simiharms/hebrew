import { describe, expect, it } from 'vitest';
import type { Level } from '../src/content/types.ts';
import { buildForgeItems, type ForgeItem, forgeCheck, forgeEvidence, forgeItemFor, forgeParts, rowShown } from '../src/games/forge.tsx';
import { allowedTenses, applyEvidence, finalize, levelOk, pronounsFor, sameForm, seeded, splitTable } from '../src/games/kit.ts';
import { review } from '../src/lib/fsrs.ts';
import { verbById, verbs } from '../src/lib/content.ts';
import { drillable, TENSES } from '../src/lib/session.ts';
import { type AppState, defaultState, getState, restoreState } from '../src/lib/store.ts';
import { tableOf } from '../src/lib/verbdrill.ts';

const DAY = 86_400_000;
const LEVELS: Level[] = ['A1', 'A2', 'B1', 'C1'];

// A learner at `level` with a seeded mix of verb cards: due and not due, plus
// cards on rare tenses and on the one table without a stem (ליפול future).
// Odd seeds at A1 have no cards at all.
function stateAt(level: Level, seed: number): AppState {
  const rnd = seeded(seed * 7919 + level.length);
  const cards: AppState['cards'] = {};
  const now = Date.now();
  if (level !== 'A1' || seed % 2 === 0) {
    const k = level === 'A1' ? 4 : 6 + Math.floor(rnd() * 40);
    for (let i = 0; i < k; i++) {
      const v = verbs[Math.floor(rnd() * verbs.length)];
      const t = level === 'A1' ? (i === 0 ? 'past' : 'present') : TENSES[Math.floor(rnd() * 3)];
      cards[`c:${v.id}:${t}`] = { due: now + (rnd() < 0.5 ? -1 : 1) * (0.1 + rnd() * 10) * DAY, s: rnd() * 40, d: 5, reps: 3, lapses: 0, last: now - DAY };
    }
    if (seed % 3 === 0) {
      cards['c:verb_lipol:future'] = { due: now - 2 * DAY, s: 0.3, d: 5, reps: 1, lapses: 0, last: now - 3 * DAY };
      cards['c:verb_lihyot:present'] = { due: now - DAY, s: 0.5, d: 5, reps: 1, lapses: 0, last: now - 2 * DAY };
    }
  }
  restoreState({ ...defaultState(), onboarded: true, level, cards });
  return getState();
}

// Every (prefix, suffix) pair the item offers that builds its answer.
const builders = (it: ForgeItem) => it.pre.flatMap((p) => it.suf.filter((x) => forgeCheck(it, p, x)).map((x) => [p, x]));

function checkItem(it: ForgeItem) {
  const v = verbById.get(it.verbId)!;
  expect(v, it.key).toBeTruthy();
  expect(TENSES).toContain(it.tense);
  expect(drillable(v, it.tense)).toBe(true);
  expect(it.answer).toBe(tableOf(v, it.tense)![it.person][0]);
  expect(it.inf).toBe(v.inf);
  expect(pronounsFor(it.tense, it.person)).toContainEqual([it.pronoun, it.pronounEn]);
  // the right chips are on offer and build the form; no other pair does
  expect(it.pre).toContain(it.okPre);
  expect(it.suf).toContain(it.okSuf);
  expect(forgeCheck(it, it.okPre, it.okSuf)).toBe(true);
  expect(builders(it)).toEqual([[it.okPre, it.okSuf]]);
  // chips are distinct, unfinalised, and at most 9 in all
  expect(new Set(it.pre).size).toBe(it.pre.length);
  expect(new Set(it.suf).size).toBe(it.suf.length);
  expect([...it.pre, ...it.suf, it.stem].join('')).not.toMatch(/[ךםןףץ]/);
  expect(it.pre.length + it.suf.length).toBeLessThanOrEqual(9);
  expect(it.stem.length).toBeGreaterThanOrEqual(2);
  // a suffix chip is shown with final letters, and the finished word reads as the form
  const p = forgeParts(it, it.okPre, it.okSuf);
  expect(sameForm(`${p.pre}${p.stem}${p.suf}`, it.answer)).toBe(true);
  expect(`${p.pre}${p.stem}${p.suf}`).toBe(finalize(it.answer));
  // a row is hidden only when it has nothing to choose
  if (!rowShown(it.pre)) expect(it.okPre).toBe('');
  if (!rowShown(it.suf)) expect(it.okSuf).toBe('');
  expect(rowShown(it.pre) || rowShown(it.suf)).toBe(true);
}

describe('forgeCheck', () => {
  it('grades by sameForm: final letters and doubled letters do not matter, a wrong chip does', () => {
    const likhtov = verbById.get('verb_likhtov')!;
    const it = forgeItemFor(likhtov, 'past', '2mp', seeded(1))!;
    expect(it.answer).toBe('כתבתם');
    expect(it.okSuf).toBe('תמ');
    expect(forgeCheck(it, '', 'תמ')).toBe(true);
    expect(forgeCheck(it, '', 'תם')).toBe(true);
    expect(forgeCheck(it, '', 'תנ')).toBe(false);
    expect(forgeCheck(it, '', '')).toBe(false);
    const fut = forgeItemFor(likhtov, 'future', '1p', seeded(2))!;
    expect(fut.stem).toBe('כת'); // the longest common substring of the future table
    expect(forgeCheck(fut, 'נ', 'וב')).toBe(true);
    expect(forgeCheck(fut, 'ת', 'וב')).toBe(false);
  });

  it('shows the stem unfinalised until both chips are in, and suffix chips with final letters', () => {
    const v = verbs.find((x) => drillable(x, 'present') && splitTable(x, 'present')?.stem.match(/[כמנפצ]$/) && splitTable(x, 'present')?.suf.includes(''));
    expect(v).toBeTruthy();
    const it = forgeItemFor(v!, 'present', 'ms', seeded(3))!;
    expect(it.okSuf).toBe('');
    expect(forgeParts(it, null, null).stem).toBe(it.stem);
    expect(forgeParts(it, '', null).stem).toBe(it.stem);
    expect(forgeParts(it, '', '').stem).toBe(finalize(it.stem));
    expect(forgeParts({ stem: 'כתב' }, '', 'תמ')).toEqual({ pre: '', stem: 'כתב', suf: 'תם' });
    expect(forgeParts({ stem: 'כתב' }, null, 'ימ')).toEqual({ pre: null, stem: 'כתב', suf: 'ים' });
  });
});

describe('forgeItemFor', () => {
  it('every person of every drillable table builds from its own chips, except the stemless ליפול future', () => {
    let n = 0;
    for (const v of verbs) {
      for (const t of TENSES) {
        if (!drillable(v, t)) continue;
        for (const person of Object.keys(tableOf(v, t)!)) {
          const it = forgeItemFor(v, t, person, seeded(++n));
          if (v.id === 'verb_lipol' && t === 'future') {
            expect(splitTable(v, t)).toBeNull();
            expect(it).toBeNull();
            continue;
          }
          expect(it, `${v.id} ${t} ${person}`).not.toBeNull();
          checkItem(it!);
        }
      }
    }
    // 648 present/past/future tables (the imperative has no card, so Forge leaves it out)
    expect(n).toBeGreaterThan(4500);
  });
});

describe('buildForgeItems', () => {
  for (const level of LEVELS) {
    it(`builds sound rounds at ${level} for seeds 1..200`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const s = stateAt(level, seed);
        const items = buildForgeItems(s, 8, seeded(seed));
        expect(items.length, `seed ${seed}`).toBe(8);
        expect(new Set(items.map((x) => x.key)).size).toBe(items.length);
        const perCard = new Map<string, ForgeItem[]>();
        for (const it of items) {
          checkItem(it);
          const v = verbById.get(it.verbId)!;
          expect(levelOk(v.level, s)).toBe(true);
          expect(allowedTenses(s)).toContain(it.tense);
          expect(splitTable(v, it.tense)).not.toBeNull();
          const card = `${it.verbId}:${it.tense}`;
          perCard.set(card, [...(perCard.get(card) ?? []), it]);
        }
        for (const [card, list] of perCard) {
          expect(list.length, card).toBeLessThanOrEqual(2);
          if (list.length === 2) {
            expect(list[0].person).not.toBe(list[1].person);
            expect(sameForm(list[0].answer, list[1].answer)).toBe(false);
          }
        }
        // never the stemless table, even when its card is due
        expect(items.some((x) => x.verbId === 'verb_lipol' && x.tense === 'future')).toBe(false);
        // A1 without cards stays in the present
        if (level === 'A1' && seed % 2 === 1) expect(items.every((x) => x.tense === 'present')).toBe(true);
        // snapshots resume from JSON
        expect(JSON.parse(JSON.stringify(items))).toEqual(items);
      }
    });
  }

  it('puts due cards first, one item each, and a card second only later in the round', () => {
    const now = Date.now();
    const cards: AppState['cards'] = {};
    const due = verbs.filter((v) => v.level === 'A2' && drillable(v, 'past') && splitTable(v, 'past')).slice(0, 3);
    due.forEach((v, i) => (cards[`c:${v.id}:past`] = { due: now - (i + 1) * DAY, s: 2, d: 5, reps: 2, lapses: 0, last: now - 5 * DAY }));
    restoreState({ ...defaultState(), onboarded: true, level: 'B1', cards });
    const items = buildForgeItems(getState(), 8, seeded(7));
    expect(items).toHaveLength(8);
    // oldest due first
    expect(items.slice(0, 3).map((x) => x.verbId)).toEqual([...due].reverse().map((v) => v.id));
    // four tables, two forms each; the second form of a table comes after all first forms
    const cardsUsed = [...new Set(items.map((x) => `${x.verbId}:${x.tense}`))];
    expect(cardsUsed).toHaveLength(4);
    expect(items.slice(4).map((x) => `${x.verbId}:${x.tense}`)).toEqual(cardsUsed);
  });

  it('uses eight tables, one form each, when eight cards are due', () => {
    const now = Date.now();
    const cards: AppState['cards'] = {};
    for (const v of verbs.filter((x) => x.level === 'A2' && drillable(x, 'future') && splitTable(x, 'future')).slice(0, 10)) {
      cards[`c:${v.id}:future`] = { due: now - DAY, s: 3, d: 5, reps: 2, lapses: 0, last: now - 4 * DAY };
    }
    restoreState({ ...defaultState(), onboarded: true, level: 'B1', cards });
    const items = buildForgeItems(getState(), 8, seeded(8));
    expect(items).toHaveLength(8);
    expect(new Set(items.map((x) => `${x.verbId}:${x.tense}`)).size).toBe(8);
    expect(items.every((x) => x.tense === 'future' && cards[`c:${x.verbId}:future`])).toBe(true);
  });

  it('is deterministic for a seed and varies across seeds', () => {
    const s = stateAt('B1', 4);
    expect(buildForgeItems(s, 8, seeded(5))).toEqual(buildForgeItems(s, 8, seeded(5)));
    const rounds = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) rounds.add(buildForgeItems(stateAt('A2', 1), 8, seeded(seed)).map((x) => x.key).join());
    expect(rounds.size).toBeGreaterThan(5);
  });

  it('shows the prefix row only for tables with prefixes', () => {
    const likhtov = verbById.get('verb_likhtov')!;
    expect(rowShown(forgeItemFor(likhtov, 'past', '1s')!.pre)).toBe(false);
    expect(rowShown(forgeItemFor(likhtov, 'future', '1s')!.pre)).toBe(true);
    expect(rowShown(forgeItemFor(likhtov, 'present', 'ms')!.pre)).toBe(false);
  });
});

describe('Forge evidence', () => {
  const likhtov = verbById.get('verb_likhtov')!;
  const card = 'c:verb_likhtov:past';
  const at = (due: number) => ({ due, s: 3, d: 5, reps: 2, lapses: 0, last: due - 4 * DAY });
  const wrongSuf = (it: ForgeItem) => it.suf.find((x) => !forgeCheck(it, it.okPre, x))!;

  it('builds a build-tier record on the c: card, with the built word for the mistake bank', () => {
    const it = forgeItemFor(likhtov, 'past', '2mp', seeded(1))!;
    const right = forgeEvidence(it, it.okPre, it.okSuf, likhtov.binyan);
    expect(right.ok).toBe(true);
    expect(right.evidence).toHaveLength(1);
    const e = right.evidence[0];
    expect(e).toMatchObject({ tier: 'build', ok: true, skill: 'verbs', cardId: card, topics: ['binyan:paal', 'tense:past'] });
    expect(e.grade).toBeUndefined(); // build is 3 or 1, never 4
    expect(e.mistake).toMatchObject({ kind: 'verb', ref: 'verb_likhtov:past:2mp', answer: 'כתבתם', given: 'כתבתם' });
    expect(e.mistake!.prompt).toBe(`${it.pronoun} (${it.pronounEn}) · לכתוב · עבר`);
    const wrong = forgeEvidence(it, it.okPre, wrongSuf(it));
    expect(wrong.ok).toBe(false);
    expect(wrong.evidence[0].ok).toBe(false);
    expect(wrong.evidence[0].mistake!.given).toBe(finalize(it.okPre + it.stem + wrongSuf(it)));
    expect(wrong.evidence[0].mistake!.given).not.toMatch(/[כמנפצ]$/);
  });

  it('reviews a due card once (g 3 right, g 1 wrong) and never creates or credits a card that is not due', () => {
    const now = Date.now();
    const a = forgeItemFor(likhtov, 'past', '1s', seeded(2))!;
    const b = forgeItemFor(likhtov, 'past', '3p', seeded(3))!;
    // due, right: one review at g 3, then the second item on the same card changes nothing
    restoreState({ ...defaultState(), onboarded: true, level: 'B1', cards: { [card]: at(now - DAY) } });
    const before = getState().cards[card];
    const rated = new Set<string>();
    expect(applyEvidence(forgeEvidence(a, a.okPre, a.okSuf).evidence, rated, now)).toBe(1);
    expect(getState().cards[card]).toEqual(review(before, 3, now, getState().settings.retention));
    expect(getState().days[getState().days.length - 1].reviews).toBe(1);
    expect(getState().mistakes).toHaveLength(0);
    const reviewed = getState().cards[card];
    expect(applyEvidence(forgeEvidence(b, b.okPre, b.okSuf).evidence, rated, now)).toBe(0);
    expect(getState().cards[card]).toEqual(reviewed);
    // due, wrong: a g 1 review and the miss in the mistake bank
    restoreState({ ...defaultState(), onboarded: true, level: 'B1', cards: { [card]: at(now - DAY) } });
    expect(applyEvidence(forgeEvidence(a, a.okPre, wrongSuf(a)).evidence, new Set(), now)).toBe(0);
    expect(getState().cards[card]).toEqual(review(at(now - DAY), 1, now, getState().settings.retention));
    expect(getState().mistakes.map((m) => m.ref)).toEqual(['verb_likhtov:past:1s']);
    // not due: right leaves it alone, wrong only makes it due now
    restoreState({ ...defaultState(), onboarded: true, level: 'B1', cards: { [card]: at(now + 3 * DAY) } });
    applyEvidence(forgeEvidence(a, a.okPre, a.okSuf).evidence, new Set(), now);
    expect(getState().cards[card]).toEqual(at(now + 3 * DAY));
    applyEvidence(forgeEvidence(a, a.okPre, wrongSuf(a)).evidence, new Set(), now);
    expect(getState().cards[card]).toEqual({ ...at(now + 3 * DAY), due: now });
    // no card: nothing is created
    restoreState({ ...defaultState(), onboarded: true, level: 'B1' });
    applyEvidence(forgeEvidence(a, a.okPre, a.okSuf).evidence, new Set(), now);
    applyEvidence(forgeEvidence(b, b.okPre, wrongSuf(b)).evidence, new Set(), now);
    expect(getState().cards).toEqual({});
    expect(getState().mistakes).toHaveLength(1);
  });
});

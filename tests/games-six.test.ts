import { describe, expect, it } from 'vitest';
import type { Level } from '../src/content/types.ts';
import { applyEvidence, clearRound, formOf, pronounsFor, sameForm, seeded } from '../src/games/kit.ts';
import { createRound } from '../src/games/kit-ui.tsx';
import { buildSixSlots, openDaily, type SixItem, sixCheck, sixComplete, sixEvidence, sixItems, sixEdited, type SixFirstMiss, sixMark, sixPrior, sixResend, sixShareText, sixSlotsFor } from '../src/games/six.tsx';
import { review } from '../src/lib/fsrs.ts';
import { levelRank, verbById, verbs } from '../src/lib/content.ts';
import { drillable, TENSES, verbCardOrder } from '../src/lib/session.ts';
import { type AppState, defaultState, getState, restoreState, setState, today } from '../src/lib/store.ts';

const DAY = 86_400_000;
const LEVELS: Level[] = ['A1', 'A2', 'B1', 'C1'];
const DATE = '2026-11-22';
const PRONOUNS_IN_ORDER = ['אני', 'היא', 'אנחנו', 'אתה', 'הם', 'את'];

function stateAt(level: Level, seed: number, extra: Partial<AppState> = {}): AppState {
  const rnd = seeded(seed * 104729 + level.length);
  const cards: AppState['cards'] = {};
  const now = Date.now();
  if (seed % 4 !== 0) {
    const k = 1 + Math.floor(rnd() * 30);
    for (let i = 0; i < k; i++) {
      const v = verbs[Math.floor(rnd() * verbs.length)];
      cards[`c:${v.id}:${TENSES[Math.floor(rnd() * 3)]}`] = { due: now + (rnd() - 0.5) * 8 * DAY, s: rnd() * 30, d: 5, reps: 2, lapses: 0, last: now - DAY };
    }
  }
  restoreState({ ...defaultState(), onboarded: true, level, cards, ...extra });
  return getState();
}

function checkSlots(verbId: string, slots: ReturnType<typeof sixSlotsFor>) {
  const v = verbById.get(verbId)!;
  expect(v, verbId).toBeTruthy();
  expect(slots).toHaveLength(6);
  expect(slots.map((x) => x.pronoun)).toEqual(PRONOUNS_IN_ORDER);
  for (const sl of slots) {
    expect(drillable(v, sl.tense), `${verbId} ${sl.tense}`).toBe(true);
    expect(formOf(v, sl.tense, sl.person), `${verbId} ${sl.tense} ${sl.person}`).toBeTruthy();
    expect(pronounsFor(sl.tense, sl.person)).toContainEqual([sl.pronoun, sl.pronounEn]);
  }
}

describe('buildSixSlots', () => {
  for (const level of LEVELS) {
    it(`gives six drillable rows, the same every time, at ${level}`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const s = stateAt(level, seed);
        const a = buildSixSlots(s, DATE);
        const b = buildSixSlots(structuredClone(s), DATE);
        expect(b).toEqual(a);
        checkSlots(a.verbId, a.slots);
        const v = verbById.get(a.verbId)!;
        expect(drillable(v, 'past') && drillable(v, 'future')).toBe(true);
        // a verb the learner has started, when there is one near their level
        const started = verbs.filter((x) => s.cards[`c:${x.id}:present`] || s.cards[`c:${x.id}:past`] || s.cards[`c:${x.id}:future`]);
        const near = started.filter((x) => levelRank(x.level) <= levelRank(s.level) + 1 && drillable(x, 'past') && drillable(x, 'future'));
        if (near.length) expect(near.map((x) => x.id)).toContain(a.verbId);
      }
    });
  }

  it('keeps to the planned rows when the verb has them all', () => {
    const { verbId, slots } = buildSixSlots(stateAt('B1', 4), DATE); // no cards: a teaching-order verb
    const v = verbById.get(verbId)!;
    const want = [
      ['past', '1s'],
      ['present', 'fs'],
      ['future', '1p'],
      [drillable(v, 'imp') ? 'imp' : 'future', drillable(v, 'imp') ? 'ms' : '2ms'],
      ['past', '3p'],
      ['future', '2fs'],
    ];
    expect(slots.map((x) => [x.tense, x.person])).toEqual(want);
    expect(slots.map((x) => x.pronounEn)).toEqual(['I', 'she', 'we', 'you (m)', 'they (m)', 'you (f)']);
  });

  it('every verb with a past and a future gets six rows, standing in for missing tenses', () => {
    let n = 0;
    for (const v of verbs) {
      if (!(drillable(v, 'past') && drillable(v, 'future'))) continue;
      const slots = sixSlotsFor(v);
      checkSlots(v.id, slots);
      if (!drillable(v, 'imp')) expect([slots[3].tense, slots[3].person]).toEqual(['future', '2ms']);
      n++;
    }
    expect(n).toBe(216);
    // להיות has no present in use: she moves to the future (or the past)
    const lihyot = sixSlotsFor(verbById.get('verb_lihyot')!);
    expect(lihyot[1].tense).not.toBe('present');
    expect(lihyot[1].pronoun).toBe('היא');
    expect(lihyot[1].person).toBe('3fs');
  });

  it('uses the weakest binyan when the learner has verbs in it', () => {
    const now = Date.now();
    const cards: AppState['cards'] = {};
    const piel = verbs.filter((v) => v.binyan === 'piel' && v.level === 'A2' && drillable(v, 'past') && drillable(v, 'future')).slice(0, 3);
    const paal = verbs.filter((v) => v.binyan === 'paal' && v.level === 'A2' && drillable(v, 'past') && drillable(v, 'future')).slice(0, 5);
    for (const v of [...piel, ...paal]) cards[`c:${v.id}:past`] = { due: now + DAY, s: 5, d: 5, reps: 2, lapses: 0, last: now - DAY };
    const profile = { skills: {}, topics: { 'binyan:piel': { score: 0.3, n: 10, at: now } } };
    for (const date of ['2026-11-20', '2026-11-21', DATE, '2026-11-23']) {
      const s = stateAt('B1', 1, { cards, profile });
      expect(piel.map((v) => v.id)).toContain(buildSixSlots(s, date).verbId);
    }
  });

  it('falls back to the first 30 verbs in teaching order with no cards', () => {
    const s = stateAt('A2', 4);
    expect(Object.keys(s.cards)).toHaveLength(0);
    const first: string[] = [];
    for (const { verb } of verbCardOrder()) if (!first.includes(verb.id)) first.push(verb.id);
    const pool = first.filter((id) => drillable(verbById.get(id)!, 'past') && drillable(verbById.get(id)!, 'future')).slice(0, 30);
    const seen = new Set<string>();
    for (let d = 1; d <= 28; d++) {
      const id = buildSixSlots(s, `2026-02-${String(d).padStart(2, '0')}`).verbId;
      expect(pool).toContain(id);
      seen.add(id);
    }
    expect(seen.size).toBeGreaterThan(10);
  });

  it("skips the last day's verb", () => {
    const s = stateAt('B1', 4);
    const today = buildSixSlots(s, DATE);
    const after = stateAt('B1', 4, { play: { ...defaultState().play, daily: { date: '2026-11-21', verbId: today.verbId, slots: today.slots, marks: ['g', 'g', 'g', 'g', 'g', 'g'], tries: [1, 1, 1, 1, 1, 1], rated: [] } } });
    expect(buildSixSlots(after, DATE).verbId).not.toBe(today.verbId);
    // today's own grid doesn't count as "the last day"
    const same = stateAt('B1', 4, { play: { ...defaultState().play, daily: { date: DATE, verbId: today.verbId, slots: today.slots, marks: ['', '', '', '', '', ''], tries: [0, 0, 0, 0, 0, 0], rated: [] } } });
    expect(buildSixSlots(same, DATE).verbId).toBe(today.verbId);
  });
});

describe('Daily Six state', () => {
  it('opens one grid a day and keeps it as the source of truth', () => {
    stateAt('B1', 2);
    const d = openDaily(DATE)!;
    expect(d.date).toBe(DATE);
    expect(d.marks).toEqual(['', '', '', '', '', '']);
    expect(sixItems(d)).toHaveLength(6);
    setState((s) => {
      s.play.daily!.marks[0] = 'g';
      s.play.daily!.marks[3] = 'r';
      s.play.daily!.tries[0] = 1;
    });
    const again = openDaily(DATE)!;
    expect(again.verbId).toBe(d.verbId);
    expect(again.marks[0]).toBe('g');
    const open = sixItems(again);
    expect(open.map((x) => x.i)).toEqual([1, 2, 4, 5]);
    const v = verbById.get(again.verbId)!;
    for (const it of open) expect(it.answer).toBe(formOf(v, it.tense, it.person));
    expect(sixComplete(again)).toBe(false);
    // the next day gets a new grid
    const next = openDaily('2026-11-23')!;
    expect(next.date).toBe('2026-11-23');
    expect(next.marks.every((m) => m === '')).toBe(true);
    expect(next.verbId).not.toBe(d.verbId);
  });

  it('grades typed forms strictly, but not on final letters', () => {
    const v = verbById.get('verb_likhtov')!;
    expect(sixCheck('כתבתי', 'כתבתי').verdict).toBe('correct');
    expect(sixCheck(' כָּתַבְתִּי ', 'כתבתי').verdict).toBe('correct');
    expect(sixCheck('כתבתמ', 'כתבתם').verdict).toBe('correct');
    expect(sixCheck('כתבתי', 'כתבנו').verdict).toBe('wrong');
    expect(sixCheck('כתבת', 'כתבתי').verdict).toBe('wrong'); // one letter short is a miss here
    expect(sixCheck('כתבת', 'כתבתי').note).toBeTruthy(); // ...but a close one
    expect(sixCheck('katavti', 'כתבתי').verdict).toBe('latin');
    expect(sixCheck('', 'כתבתי').verdict).toBe('empty');
    // every slot form of every verb is accepted as itself and refused as the form of another slot
    for (const verb of verbs.filter((x) => drillable(x, 'past') && drillable(x, 'future'))) {
      const forms = sixSlotsFor(verb).map((sl) => formOf(verb, sl.tense, sl.person)!);
      forms.forEach((f, i) => {
        expect(sixCheck(f, f).verdict).toBe('correct');
        forms.forEach((g, j) => {
          if (i !== j && !sameForm(f, g)) expect(sixCheck(g, f).verdict, `${verb.id} ${g} for ${f}`).not.toBe('correct');
        });
      });
    }
    expect(v).toBeTruthy();
  });

  it("lets the row's own pronoun through in front of the form, and nothing else", () => {
    expect(sixCheck('אני כתבתי', 'כתבתי', 'אני').verdict).toBe('correct');
    expect(sixCheck('  אני   כתבתי ', 'כתבתי', 'אני').verdict).toBe('correct');
    expect(sixCheck('הם כתבתי', 'כתבתי', 'אני').verdict).toBe('wrong');
    expect(sixCheck('אני כתבנו', 'כתבתי', 'אני').verdict).toBe('wrong');
    expect(sixCheck('אני', 'כתבתי', 'אני').verdict).toBe('wrong');
    expect(sixCheck('אני כתבתי', 'כתבתי').verdict).toBe('wrong'); // no pronoun given: graded as typed
  });

  it('refuses another form of the verb that the lenient spelling check would take (יישנו for ישנו)', () => {
    const lishon = verbById.get('verb_lishon')!;
    const row = sixSlotsFor(lishon).findIndex((sl) => sl.tense === 'past' && sl.person === '3p');
    expect(row).toBeGreaterThanOrEqual(0);
    expect(formOf(lishon, 'past', '3p')).toBe('ישנו');
    expect(formOf(lishon, 'future', '3p')).toBe('יישנו');
    for (const typed of ['יישנו', 'הם יישנו']) {
      const r = sixCheck(typed, 'ישנו', 'הם', lishon);
      expect(r.verdict, typed).toBe('wrong');
      expect(r.note).toMatch(/another form/);
    }
    expect(sixCheck('ישנו', 'ישנו', 'הם', lishon).verdict).toBe('correct');
    expect(sixCheck('יישן', 'ישן', 'הוא', lishon).verdict).toBe('wrong'); // future הוא for past הוא
    // a final-letter slip is still only a spelling note, not another form
    const likhtov = verbById.get('verb_likhtov')!;
    expect(sixCheck('כתבתמ', 'כתבתם', 'אתם', likhtov)).toMatchObject({ verdict: 'correct' });
    // every slot form of every verb is still accepted as itself with the verb given
    for (const verb of verbs.filter((x) => drillable(x, 'past') && drillable(x, 'future'))) {
      for (const sl of sixSlotsFor(verb)) {
        const f = formOf(verb, sl.tense, sl.person)!;
        expect(sixCheck(f, f, sl.pronoun, verb).verdict, `${verb.id} ${f}`).toBe('correct');
        expect(sixCheck(`${sl.pronoun} ${f}`, f, sl.pronoun, verb).verdict, `${verb.id} ${sl.pronoun} ${f}`).toBe('correct');
      }
    }
  });

  it('a bumped second Check, or the answer sent again untouched, never uses up the second try', () => {
    const first: SixFirstMiss = { key: 'row0', text: 'אבגד', changed: false };
    expect(sixResend(null, 'row0')).toBe(false);
    expect(sixResend(first, 'row0')).toBe(true); // a double tap, a doubled or held Enter, a resend
    expect(sixResend(first, 'row1')).toBe(false); // another row
    expect(sixEdited(first, ' אבגד ')).toBe(first); // an input event that changes nothing
    expect(sixResend(sixEdited(first, 'אבג'), 'row0')).toBe(false); // edited: the second try counts
    // cleared and typed back the same: deliberate, so it counts too
    expect(sixResend(sixEdited(sixEdited(first, ''), 'אבגד'), 'row0')).toBe(false);
    expect(sixEdited(null, 'x')).toBeNull();
  });

  it('shares a Wordle-style line', () => {
    const d = { date: DATE, verbId: 'verb_likhtov', slots: sixSlotsFor(verbById.get('verb_likhtov')!), marks: ['g', 'g', 'y', 'g', 'r', 'g'] as ('' | 'g' | 'y' | 'r')[], tries: [1, 1, 2, 1, 2, 1], rated: [] };
    expect(sixShareText(d, 'לכתוב')).toBe('Shoresh · פועל היום 2026-11-22\nלכתוב 🟩🟩🟨🟩🟥🟩 5/6');
    expect(sixComplete(d)).toBe(true);
    expect(sixItems(d)).toHaveLength(0);
  });
});

describe('a Daily Six grid split over two rounds', () => {
  it('counts the rows of a lost round in the stars: a grid with a 🟥 is never ★★★', () => {
    restoreState({ ...defaultState(), onboarded: true, level: 'A2' });
    const date = today();
    openDaily(date);
    const opts = { game: 'six' as const, mode: 'free' as const, tier: 'typed' as const, build: () => sixItems(openDaily(date)!), prior: () => sixPrior(getState().play.daily, date) };
    const a = createRound<SixItem>(opts, () => {});
    // row 0 two misses, rows 1–2 right first try, marked on the grid as SixGame does
    a.view().answer({ ok: false, firstTry: false }, 'now');
    const mark = (i: number, m: 'g' | 'r') =>
      setState((s) => {
        s.play.daily!.marks[i] = m;
      });
    mark(0, 'r');
    a.view().answer({ ok: true }, 'now');
    mark(1, 'g');
    a.view().answer({ ok: true }, 'now');
    mark(2, 'g');
    a.dispose();
    clearRound(); // lost: more than 6 h went by
    expect(sixPrior(getState().play.daily, date)).toEqual({ total: 3, firstTry: 2 });
    const b = createRound<SixItem>(opts, () => {});
    expect(b.view().total).toBe(3);
    for (let i = 0; i < 3; i++) b.view().answer({ ok: true }, 'now');
    expect(b.view().summary).toMatchObject({ total: 6, firstTry: 5, stars: 2 });
    expect(getState().play.badges).not.toContain('perfect');
    expect(sixPrior(getState().play.daily, '2000-01-01')).toEqual({ total: 0, firstTry: 0 }); // another day's grid
  });
});

describe('Daily Six evidence', () => {
  const likhtov = verbById.get('verb_likhtov')!;
  const rows = (): SixItem[] => sixItems({ date: DATE, verbId: likhtov.id, slots: sixSlotsFor(likhtov), marks: ['', '', '', '', '', ''], tries: [0, 0, 0, 0, 0, 0], rated: [] });

  it('marks 🟩 first try, 🟨 second try, 🟥 two misses', () => {
    expect(sixMark(true, 1)).toBe('g');
    expect(sixMark(true, 2)).toBe('y');
    expect(sixMark(false, 2)).toBe('r');
  });

  it('grades typed evidence 3 / 2 / 1, with no card for the command row', () => {
    const items = rows();
    expect(items.map((x) => x.tense)).toEqual(['past', 'present', 'future', 'imp', 'past', 'future']);
    const [past, , , imp] = items;
    expect(sixEvidence(past, likhtov, 'g', 'כתבתי')[0]).toMatchObject({ tier: 'typed', ok: true, grade: 3, skill: 'verbs', cardId: 'c:verb_likhtov:past', topics: ['binyan:paal', 'tense:past'] });
    expect(sixEvidence(past, likhtov, 'y', 'כתבתי')[0]).toMatchObject({ ok: true, grade: 2 });
    const r = sixEvidence(past, likhtov, 'r', 'כתבנו')[0];
    expect(r).toMatchObject({ ok: false, grade: 1 });
    expect(r.mistake).toMatchObject({ kind: 'verb', ref: 'verb_likhtov:past:1s', answer: 'כתבתי', given: 'כתבנו' });
    expect(sixEvidence(imp, likhtov, 'g', 'כתוב')[0].cardId).toBeNull();
  });

  it('a 🟨 on a due card equals review(card, 2); a card is reviewed once a day and never created', () => {
    const now = Date.now();
    const card = 'c:verb_likhtov:past';
    const due = { due: now - DAY, s: 3, d: 5, reps: 2, lapses: 0, last: now - 5 * DAY };
    const [past, , , imp, past3p] = rows();
    restoreState({ ...defaultState(), onboarded: true, level: 'B1', cards: { [card]: due } });
    const rated = new Set<string>();
    expect(applyEvidence(sixEvidence(past, likhtov, 'y', 'כתבתי'), rated, now)).toBe(1);
    expect(getState().cards[card]).toEqual(review(due, 2, now, getState().settings.retention));
    expect(getState().mistakes.map((m) => m.ref)).toEqual(['verb_likhtov:past:1s']); // a second try is worth another look
    // the הם row is the same card: already rated today, so no second review
    const after = getState().cards[card];
    expect(applyEvidence(sixEvidence(past3p, likhtov, 'g', 'כתבו'), rated, now)).toBe(0);
    expect(getState().cards[card]).toEqual(after);
    // the command row has no card, and nothing is created for the tenses without one
    applyEvidence(sixEvidence(imp, likhtov, 'r', 'כתבי'), new Set(), now);
    expect(Object.keys(getState().cards)).toEqual([card]);
  });
});

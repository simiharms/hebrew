import { describe, expect, it } from 'vitest';
import type { Level } from '../src/content/types.ts';
import { buildEchoItems, echoEvidence, type EchoItem, echoItemFor } from '../src/games/echo.tsx';
import { allowedTenses, applyEvidence, levelOk, sameForm, seeded } from '../src/games/kit.ts';
import { verbById, verbs } from '../src/lib/content.ts';
import { lenient } from '../src/lib/hebrew.ts';
import { drillable, TENSES } from '../src/lib/session.ts';
import { type AppState, defaultState, getState, restoreState } from '../src/lib/store.ts';
import { analyses, tableOf, type TenseKey } from '../src/lib/verbdrill.ts';

const DAY = 86_400_000;
const LEVELS: Level[] = ['A1', 'A2', 'B1', 'C1'];
const ALL: TenseKey[] = ['present', 'past', 'future', 'imp'];

function stateAt(level: Level, seed: number): AppState {
  const rnd = seeded(seed * 31337 + level.length);
  const cards: AppState['cards'] = {};
  const now = Date.now();
  if (level !== 'A1' || seed % 2 === 0) {
    const k = level === 'A1' ? 3 : 5 + Math.floor(rnd() * 30);
    for (let i = 0; i < k; i++) {
      const v = verbs[Math.floor(rnd() * verbs.length)];
      const t = level === 'A1' ? 'present' : TENSES[Math.floor(rnd() * 3)];
      cards[`c:${v.id}:${t}`] = { due: now + (rnd() - 0.5) * 6 * DAY, s: rnd() * 30, d: 5, reps: 2, lapses: 0, last: now - DAY };
    }
  }
  restoreState({ ...defaultState(), onboarded: true, level, cards });
  return getState();
}

// Every form the verb has in a drillable table, by lenient spelling.
const formsOf = (verbId: string) => {
  const v = verbById.get(verbId)!;
  return new Set(ALL.filter((t) => drillable(v, t)).flatMap((t) => Object.values(tableOf(v, t) ?? {}).map((f) => lenient(f[0]))));
};

function checkItem(it: EchoItem) {
  const v = verbById.get(it.verbId)!;
  expect(v).toBeTruthy();
  expect(it.gap).toContain('___');
  expect(it.gap.split('___')).toHaveLength(2);
  // the blank is exactly the form: filling it gives the sentence back, and the form isn't left elsewhere to give it away
  expect(it.gap.replace('___', it.form)).toBe(it.he);
  expect(it.gap.split(/[\s.,!?:;"״׳]+/).map((w) => lenient(w))).not.toContain(lenient(it.form));
  expect(it.options).toHaveLength(3);
  expect(it.options).toContain(it.form);
  // exactly one option is the form, and no two options read alike
  expect(it.options.filter((o) => sameForm(o, it.form))).toHaveLength(1);
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(sameForm(it.options[i], it.options[j]), `${it.key}: ${it.options}`).toBe(false);
  // the wrong ones are real forms of the same verb
  const forms = formsOf(it.verbId);
  for (const o of it.options.filter((x) => x !== it.form)) expect(forms.has(lenient(o)), `${it.key}: ${o}`).toBe(true);
  expect(it.tense).toBe(analyses(v, it.form)[0]?.tense ?? null);
}

describe('echoItemFor', () => {
  it('turns all 651 example sentences into sound items, for any seed', () => {
    let n = 0;
    for (const v of verbs) {
      (v.exs ?? []).forEach((e, i) => {
        n++;
        for (const seed of [1, 2, 3, 4, 5]) {
          const it = echoItemFor(v, i, seeded(seed * 1000 + n));
          expect(it, `${v.id} #${i}`).not.toBeNull();
          expect(it!.he).toBe(e.he);
          expect(it!.form).toBe(e.form);
          expect(it!.en).toBe(e.en);
          checkItem(it!);
        }
      });
    }
    expect(n).toBe(651);
  });

  it('offers one form of the same tense and one of another tense next to a conjugated form', () => {
    const likhtov = verbById.get('verb_likhtov')!;
    const i = likhtov.exs!.findIndex((e) => e.form === 'כתבה');
    for (let seed = 1; seed <= 30; seed++) {
      const it = echoItemFor(likhtov, i, seeded(seed))!;
      expect(it.tense).toBe('past');
      expect(it.gap).toBe('מיכל ___ מכתב תודה לכל הצוות.');
      const wrong = it.options.filter((o) => o !== it.form);
      const tensesOf = (f: string) => analyses(likhtov, f).map((a) => a.tense);
      expect(wrong.some((f) => tensesOf(f).includes('past'))).toBe(true);
      expect(wrong.some((f) => tensesOf(f).some((t) => t !== 'past'))).toBe(true);
    }
  });

  it('handles the two sentences that use the infinitive', () => {
    for (const id of ['verb_lihyot', 'verb_lehagid']) {
      const v = verbById.get(id)!;
      const i = v.exs!.findIndex((e) => e.form === v.inf);
      const it = echoItemFor(v, i, seeded(1))!;
      expect(it.tense).toBeNull();
      checkItem(it);
    }
  });
});

describe('buildEchoItems', () => {
  for (const level of LEVELS) {
    it(`builds 8 sentences at ${level} for seeds 1..200`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const s = stateAt(level, seed);
        const items = buildEchoItems(s, 8, seeded(seed));
        expect(items).toHaveLength(8);
        expect(new Set(items.map((x) => x.key)).size).toBe(8);
        const allowed = allowedTenses(s);
        const perVerb = new Map<string, number>();
        for (const it of items) {
          checkItem(it);
          const v = verbById.get(it.verbId)!;
          expect(levelOk(v.level, s)).toBe(true);
          expect(it.tense).not.toBeNull();
          expect(allowed).toContain(it.tense);
          perVerb.set(it.verbId, (perVerb.get(it.verbId) ?? 0) + 1);
        }
        expect(Math.max(...perVerb.values())).toBe(1);
        if (level === 'A1' && seed % 2 === 1) expect(items.every((x) => x.tense === 'present')).toBe(true);
        expect(JSON.parse(JSON.stringify(items))).toEqual(items);
      }
    });
  }

  it('leans on verbs the learner has started', () => {
    const now = Date.now();
    const cards: AppState['cards'] = {};
    const mine = verbs.filter((v) => v.level === 'A2' && (v.exs?.length ?? 0) > 0).slice(0, 10);
    for (const v of mine) cards[`c:${v.id}:past`] = { due: now + DAY, s: 5, d: 5, reps: 2, lapses: 0, last: now - DAY };
    restoreState({ ...defaultState(), onboarded: true, level: 'B1', cards });
    const ids = new Set(mine.map((v) => v.id));
    for (let seed = 1; seed <= 20; seed++) {
      const items = buildEchoItems(getState(), 8, seeded(seed));
      expect(items.filter((x) => ids.has(x.verbId)).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('is deterministic for a seed', () => {
    const s = stateAt('B1', 3);
    expect(buildEchoItems(s, 8, seeded(11))).toEqual(buildEchoItems(s, 8, seeded(11)));
  });
});

describe('Echo evidence', () => {
  const likhtov = verbById.get('verb_likhtov')!;
  const it8 = echoItemFor(likhtov, likhtov.exs!.findIndex((e) => e.form === 'כתבה'), seeded(1))!;

  it('records listening only when a Hebrew voice really spoke, and taps on the verb card', () => {
    const heard = echoEvidence(it8, true, true, likhtov.binyan);
    expect(heard).toHaveLength(2);
    expect(heard[0]).toEqual({ tier: 'tap', ok: true, skill: 'listening', weight: 0.3 });
    expect(heard[1]).toMatchObject({ tier: 'tap', ok: true, skill: 'verbs', cardId: 'c:verb_likhtov:past', topics: ['binyan:paal', 'tense:past'] });
    const read = echoEvidence(it8, false, false, likhtov.binyan);
    expect(read.map((e) => e.skill)).toEqual(['verbs']);
    expect(read.every((e) => e.tier === 'tap' && !e.mistake && e.grade === undefined)).toBe(true);
    expect(echoEvidence({ ...it8, tense: 'imp' }, true, true)[1].cardId).toBeNull();
    expect(echoEvidence({ ...it8, tense: null }, true, true)[1].cardId).toBeNull();
  });

  it('a right pick leaves the card alone, a wrong one only pulls it forward, and no card is created', () => {
    const now = Date.now();
    const card = { due: now + 4 * DAY, s: 6, d: 5, reps: 3, lapses: 0, last: now - DAY };
    restoreState({ ...defaultState(), onboarded: true, level: 'B1', cards: { 'c:verb_likhtov:past': card } });
    expect(applyEvidence(echoEvidence(it8, true, true), new Set(), now)).toBe(0);
    expect(getState().cards['c:verb_likhtov:past']).toEqual(card);
    applyEvidence(echoEvidence(it8, false, true), new Set(), now);
    expect(getState().cards['c:verb_likhtov:past']).toEqual({ ...card, due: now });
    expect(getState().profile.skills.listening?.n).toBeGreaterThan(0);
    restoreState({ ...defaultState(), onboarded: true, level: 'B1' });
    applyEvidence(echoEvidence(it8, false, false), new Set(), now);
    expect(getState().cards).toEqual({});
    expect(getState().mistakes).toHaveLength(0);
    expect(getState().profile.skills.listening).toBeUndefined();
  });
});

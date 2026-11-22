import { describe, expect, it } from 'vitest';
import type { Level } from '../src/content/types.ts';
import { buildGenderItems, genderItemFor, genderPool, isPluralSurprise, isSurprise, otherGenderSameSpelling, pluralItemFor, pluralSwap } from '../src/games/gender.tsx';
import { isSingleWord, levelOk, sameForm, seeded } from '../src/games/kit.ts';
import { vocab } from '../src/lib/content.ts';
import { lenient } from '../src/lib/hebrew.ts';
import { type AppState, defaultState, getState, restoreState } from '../src/lib/store.ts';

const LEVELS: Level[] = ['A1', 'A2', 'B1', 'C1'];
const byId = new Map(vocab.map((v) => [v.id, v]));

function stateAt(level: Level, seed = 0): AppState {
  const cards: AppState['cards'] = {};
  // Some learners have word cards; their nouns come first.
  if (seed % 3 === 0) {
    const rnd = seeded(seed + 11);
    for (const v of vocab.filter((x) => x.gender).slice(0, 400)) {
      if (rnd() < 0.15) cards[`v:${v.id}`] = { due: Date.now(), s: 3, d: 5, reps: 2, lapses: 0, last: Date.now() - 86_400_000 };
    }
  }
  restoreState({ ...defaultState(), onboarded: true, level, cards });
  return getState();
}

describe('He or She? helpers', () => {
  it('swaps ים and ות, and nothing else', () => {
    expect(pluralSwap('ערים')).toBe('ערות');
    expect(pluralSwap('שולחנות')).toBe('שולחנים');
    expect(pluralSwap('עיניים')).toBe('עיניות');
    expect(pluralSwap('בתי קפה')).toBeNull();
    expect(pluralSwap('אחיות ')).toBe('אחיים');
    expect(pluralSwap('בנות')).toBe('בנים');
    expect(pluralSwap('ילדי')).toBeNull();
  });

  it('knows the surprises', () => {
    expect(isSurprise({ he: 'עיר', gender: 'f' })).toBe(true);
    expect(isSurprise({ he: 'לילה', gender: 'm' })).toBe(true);
    expect(isSurprise({ he: 'בית', gender: 'm' })).toBe(true);
    expect(isSurprise({ he: 'שולחן', gender: 'm' })).toBe(false);
    expect(isSurprise({ he: 'משפחה', gender: 'f' })).toBe(false);
    expect(isPluralSurprise({ gender: 'm', plural: 'שולחנות' })).toBe(true);
    expect(isPluralSurprise({ gender: 'f', plural: 'שנים' })).toBe(true);
    expect(isPluralSurprise({ gender: 'f', plural: 'משפחות' })).toBe(false);
  });

  it('every noun with a ים/ות plural gets a plural question whose swap is wrong', () => {
    let n = 0;
    for (const v of vocab.filter((x) => x.pos === 'noun' && x.gender && x.plural)) {
      const it = pluralItemFor(v, seeded(n));
      if (!it) continue;
      n++;
      const swap = it.options.find((o) => o !== it.plural)!;
      expect(it.options).toHaveLength(2);
      expect(it.options).toContain(v.plural!.trim());
      expect(sameForm(swap, it.plural!), `${v.he}: ${it.plural} / ${swap}`).toBe(false);
      expect(sameForm(swap, v.he)).toBe(false);
      // never another plural the content gives for this spelling
      for (const o of vocab) if (o.plural && sameForm(o.he, v.he)) expect(sameForm(o.plural, swap)).toBe(false);
    }
    expect(n).toBeGreaterThan(500);
  });

  it('leaves out nouns that are plural in form, of either gender, or spelled like a noun of the other gender', () => {
    const pool = genderPool(stateAt('C1'));
    const he = new Set(pool.map((v) => v.he));
    for (const w of ['פנים', 'מים', 'משקפיים', 'מכנסיים', 'שמיים', 'הורים', 'חבר׳ה', 'רוח', 'רווח', 'אופניים']) expect(he.has(w), w).toBe(false);
    for (const w of ['עיר', 'לילה', 'שולחן', 'משפחה', 'אחריות']) expect(he.has(w), w).toBe(true);
    const genders = new Map<string, Set<string>>();
    for (const v of vocab) if (v.pos === 'noun' && v.gender) genders.set(lenient(v.he), (genders.get(lenient(v.he)) ?? new Set()).add(v.gender));
    for (const v of pool) {
      expect(isSingleWord(v.he)).toBe(true);
      expect(genders.get(lenient(v.he))!.size).toBe(1);
    }
  });

  it('leaves out nouns whose other gender is spelled the same (מורה, מתחרה, מנחה)', () => {
    const same = ['va1t_more', 'vb_mitkhare', 'vc1c_mankhe'];
    // only those: "Feminine: רוח חזקה" on a feminine noun is an example, not the other gender
    expect(vocab.filter((v) => v.pos === 'noun' && otherGenderSameSpelling(v)).map((v) => v.id).sort()).toEqual([...same].sort());
    for (const level of ['A1', 'A2', 'A2+', 'B1', 'B2', 'C1'] as Level[]) {
      const ids = new Set(genderPool(stateAt(level)).map((v) => v.id));
      for (const id of same) expect(ids.has(id), `${id} at ${level}`).toBe(false);
      for (let seed = 1; seed <= 20; seed++) expect(buildGenderItems(stateAt(level, seed), 15, seeded(seed)).some((x) => same.includes(x.vocabId))).toBe(false);
    }
    // "Feminine: אצבע אחת" on the feminine אצבע keeps it in
    expect(genderPool(stateAt('C1')).some((v) => v.he === 'אצבע')).toBe(true);
  });

  it('a gender item has the two fixed keys, נקבה then זכר', () => {
    const it = genderItemFor(vocab.find((v) => v.he === 'עיר' && v.gender)!)!;
    expect(it.options).toEqual(['f', 'm']);
    expect(it.gender).toBe('f');
    expect(it.surprise).toBe(true);
  });
});

describe('buildGenderItems', () => {
  for (const level of LEVELS) {
    it(`deals 15 nouns at ${level}, every 5th a plural, with surprises (seeds 1..200)`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const s = stateAt(level, seed);
        const items = buildGenderItems(s, 15, seeded(seed));
        expect(items).toHaveLength(15);
        expect(new Set(items.map((x) => x.key)).size).toBe(15);
        expect(new Set(items.map((x) => lenient(x.he))).size).toBe(15);
        items.forEach((it, i) => {
          const v = byId.get(it.vocabId)!;
          expect(v.gender).toBe(it.gender);
          expect(it.he).toBe(v.he);
          expect(levelOk(v.level, s)).toBe(true);
          expect(isSingleWord(it.he)).toBe(true);
          expect(it.kind).toBe(i % 5 === 4 ? 'plural' : 'gender');
          if (it.kind === 'plural') {
            expect(it.options).toHaveLength(2);
            const [a, b] = it.options;
            expect(sameForm(a, b)).toBe(false);
            expect(it.options.filter((o) => sameForm(o, it.plural!))).toHaveLength(1);
            expect(it.surprise).toBe(isPluralSurprise(v));
          } else {
            expect(it.options).toEqual(['f', 'm']);
            expect(it.surprise).toBe(isSurprise(v));
          }
        });
        const genderItems = items.filter((x) => x.kind === 'gender');
        expect(genderItems.filter((x) => x.surprise).length / genderItems.length).toBeGreaterThanOrEqual(0.3);
        // the surprising plurals come first
        if (level !== 'A1') expect(items.filter((x) => x.kind === 'plural').every((x) => x.surprise)).toBe(true);
        expect(JSON.parse(JSON.stringify(items))).toEqual(items);
      }
    });
  }

  it('prefers nouns the learner has cards for', () => {
    const s = stateAt('B1', 3);
    const carded = Object.keys(s.cards).length;
    expect(carded).toBeGreaterThan(20);
    for (let seed = 1; seed <= 20; seed++) {
      const items = buildGenderItems(s, 15, seeded(seed));
      expect(items.filter((x) => s.cards[`v:${x.vocabId}`]).length).toBeGreaterThanOrEqual(12);
    }
  });

  it('is deterministic for a seed, varies across seeds, and puts the right plural on either side', () => {
    const s = stateAt('A2', 1);
    expect(buildGenderItems(s, 15, seeded(5))).toEqual(buildGenderItems(s, 15, seeded(5)));
    const rounds = new Set<string>();
    const sides = new Set<number>();
    for (let seed = 1; seed <= 30; seed++) {
      const items = buildGenderItems(s, 15, seeded(seed));
      rounds.add(items.map((x) => x.key).join());
      for (const it of items.filter((x) => x.kind === 'plural')) sides.add(it.options.indexOf(it.plural!));
    }
    expect(rounds.size).toBeGreaterThan(25);
    expect([...sides].sort()).toEqual([0, 1]);
  });
});

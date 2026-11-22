import { describe, expect, it } from 'vitest';
import type { Level } from '../src/content/types.ts';
import { buildSnapItems, IMP_POOL, PLURAL, PRONOUN_EN, snapItemFor } from '../src/games/snap.tsx';
import { formOf, levelOk, PRONOUNS, pronounsFor, seeded, validPronouns } from '../src/games/kit.ts';
import { verbById, verbs } from '../src/lib/content.ts';
import { drillable, TENSES, verbCardOrder } from '../src/lib/session.ts';
import { type AppState, defaultState, getState, restoreState } from '../src/lib/store.ts';
import { tableOf, type TenseKey } from '../src/lib/verbdrill.ts';

const DAY = 86_400_000;
const LEVELS: Level[] = ['A1', 'A2', 'B1', 'C1'];
const ALL: TenseKey[] = ['present', 'past', 'future', 'imp'];

// A learner at `level` with a seeded mix of verb cards: due and not due, weak
// and strong, plus cards on rare tenses that must never be drilled. Odd seeds
// at A1 have no cards at all (present only).
function stateAt(level: Level, seed: number): AppState {
  const rnd = seeded(seed * 7919 + level.length);
  const cards: AppState['cards'] = {};
  const now = Date.now();
  if (level !== 'A1' || seed % 2 === 0) {
    const k = level === 'A1' ? 4 : 10 + Math.floor(rnd() * 50);
    for (let i = 0; i < k; i++) {
      const v = verbs[Math.floor(rnd() * verbs.length)];
      const t = level === 'A1' ? (i === 0 ? 'past' : 'present') : TENSES[Math.floor(rnd() * 3)];
      cards[`c:${v.id}:${t}`] = { due: now + (rnd() < 0.4 ? -1 : 1) * rnd() * 10 * DAY, s: rnd() * 40, d: 5, reps: 3, lapses: 0, last: now - DAY };
    }
    if (seed % 5 === 0) {
      cards['c:verb_lihyot:present'] = { due: now - DAY, s: 0.5, d: 5, reps: 1, lapses: 0, last: now - 2 * DAY };
      cards['c:verb_lehagid:past'] = { due: now - DAY, s: 0.4, d: 5, reps: 1, lapses: 0, last: now - 2 * DAY };
    }
  }
  restoreState({ ...defaultState(), onboarded: true, level, cards });
  return getState();
}

function checkItem(it: NonNullable<ReturnType<typeof snapItemFor>>) {
  const v = verbById.get(it.verbId)!;
  expect(v).toBeTruthy();
  expect(it.form).toBe(formOf(v, it.tense, it.person));
  expect(it.tr).toBe(tableOf(v, it.tense)![it.person][1]);
  const valid = validPronouns(v, it.tense, it.form);
  expect(it.also).toEqual(valid);
  // exactly one right option; it fits, no other option does
  const right = it.options.filter((o) => o.ok);
  expect(right).toHaveLength(1);
  expect(valid).toContain(right[0].k);
  expect(pronounsFor(it.tense, it.person).map(([p]) => p)).toContain(right[0].k);
  for (const o of it.options.filter((x) => !x.ok)) expect(valid).not.toContain(o.k);
  // unique, real pronouns with an English label
  const ks = it.options.map((o) => o.k);
  expect(new Set(ks).size).toBe(ks.length);
  const pool = it.tense === 'imp' ? IMP_POOL : PRONOUNS;
  for (const k of ks) {
    expect(pool).toContain(k);
    expect(PRONOUN_EN[k]).toBeTruthy();
  }
  // three wrong pronouns whenever three exist (only the imperative plural has two)
  const wrongPool = pool.filter((p) => !valid.includes(p));
  expect(ks.length).toBe(1 + Math.min(3, wrongPool.length));
  if (it.tense !== 'imp') expect(ks).toHaveLength(4);
  // same number preferred: a different-number pronoun only when the same number ran out
  const plural = PLURAL.has(right[0].k);
  const sameLeft = wrongPool.filter((p) => PLURAL.has(p) === plural);
  const wrong = ks.filter((k) => k !== right[0].k);
  const same = wrong.filter((k) => PLURAL.has(k) === plural);
  expect(same.length).toBe(Math.min(sameLeft.length, wrong.length));
}

describe("Who's talking? items", () => {
  it('every form of every drillable table gets one right pronoun and only wrong distractors', () => {
    let n = 0;
    for (const v of verbs) {
      for (const t of ALL) {
        if (!drillable(v, t)) continue;
        for (const person of Object.keys(tableOf(v, t)!)) {
          for (const seed of [1, 2, 3]) {
            const it = snapItemFor(v, t, person, seeded(seed + n));
            expect(it, `${v.id} ${t} ${person}`).not.toBeNull();
            checkItem(it!);
          }
          n++;
        }
      }
    }
    expect(n).toBeGreaterThan(5000);
  }, 60_000); // sweeps every form of every verb

  it('knows that one spelling can belong to several pronouns', () => {
    const likhtov = verbById.get('verb_likhtov')!;
    const it = snapItemFor(likhtov, 'past', '2fs', seeded(4))!;
    expect(it.form).toBe('כתבת');
    expect(it.also).toEqual(['אתה', 'את']);
    expect(it.options.filter((o) => o.k === 'אתה' || o.k === 'את')).toHaveLength(1);
    const present = snapItemFor(likhtov, 'present', 'fs', seeded(5))!;
    expect(present.also).toEqual(['אני', 'את', 'היא']);
    const pl = snapItemFor(likhtov, 'imp', 'mp', seeded(6))!;
    expect(pl.options).toHaveLength(3);
    expect(pl.options.filter((o) => !o.ok).map((o) => o.k).sort()).toEqual(['את', 'אתה'].sort());
  });
});

describe('buildSnapItems', () => {
  for (const level of LEVELS) {
    it(`builds 12 sound items at ${level} for seeds 1..200`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const s = stateAt(level, seed);
        const items = buildSnapItems(s, 12, seeded(seed));
        expect(items).toHaveLength(12);
        expect(new Set(items.map((x) => x.key)).size).toBe(12);
        for (const it of items) {
          const v = verbById.get(it.verbId)!;
          expect(drillable(v, it.tense)).toBe(true);
          expect(levelOk(v.level, s)).toBe(true);
          checkItem(it);
        }
        // snapshots resume from JSON
        expect(JSON.parse(JSON.stringify(items))).toEqual(items);
        if (level === 'A1' && seed % 2 === 1) expect(items.every((x) => x.tense === 'present')).toBe(true);
        if (level === 'A1') expect(items.every((x) => x.tense === 'present' || x.tense === 'past')).toBe(true);
      }
    });
  }

  it('is deterministic for a seed and varies across seeds', () => {
    const s = stateAt('B1', 3);
    expect(buildSnapItems(s, 12, seeded(9))).toEqual(buildSnapItems(s, 12, seeded(9)));
    const keys = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) keys.add(buildSnapItems(s, 12, seeded(seed)).map((x) => x.key).join());
    expect(keys.size).toBeGreaterThan(10);
  });

  it('uses every tense from A2 on, the imperative once a verb is learned', () => {
    // A learner who has worked through the first verbs in teaching order.
    restoreState({ ...defaultState(), onboarded: true, level: 'A2' });
    const cards: AppState['cards'] = {};
    for (const { verb, tense } of verbCardOrder().slice(0, 36)) cards[`c:${verb.id}:${tense}`] = { due: Date.now() + 3 * DAY, s: 8, d: 5, reps: 4, lapses: 0, last: Date.now() - DAY };
    restoreState({ ...getState(), cards });
    const seen = new Set<TenseKey>();
    for (let seed = 1; seed <= 30; seed++) for (const it of buildSnapItems(getState(), 12, seeded(seed))) seen.add(it.tense);
    expect([...seen].sort()).toEqual([...ALL].sort());
  });

  it('puts the right answer in every position', () => {
    const pos = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) for (const it of buildSnapItems(stateAt('B1', seed), 12, seeded(seed))) pos.add(it.options.findIndex((o) => o.ok));
    expect([...pos].sort()).toEqual([0, 1, 2, 3]);
  });
});

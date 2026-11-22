import { describe, expect, it } from 'vitest';
import type { Level } from '../src/content/types.ts';
import { buildSortItems, LANE_ORDER, sortCorrect, sortItemFor, sortLanes, spread } from '../src/games/sort.tsx';
import { allowedTenses, levelOk, seeded } from '../src/games/kit.ts';
import { verbById, verbs } from '../src/lib/content.ts';
import { exactKey, lenient } from '../src/lib/hebrew.ts';
import { drillable, TENSES } from '../src/lib/session.ts';
import { type AppState, defaultState, getState, restoreState } from '../src/lib/store.ts';
import { tableOf, type TenseKey } from '../src/lib/verbdrill.ts';

const DAY = 86_400_000;
const LEVELS: Level[] = ['A1', 'A2', 'B1', 'C1'];
const ALL: TenseKey[] = ['present', 'past', 'future', 'imp'];

// A learner at `level` with a seeded mix of verb cards (due and not due, rare
// tenses too). At A1, even seeds hold one past card, so past becomes a lane;
// odd seeds have no cards (present only).
function stateAt(level: Level, seed: number): AppState {
  const rnd = seeded(seed * 104729 + level.length);
  const cards: AppState['cards'] = {};
  const now = Date.now();
  if (level !== 'A1' || seed % 2 === 0) {
    const k = level === 'A1' ? 3 : 10 + Math.floor(rnd() * 50);
    for (let i = 0; i < k; i++) {
      const v = verbs[Math.floor(rnd() * verbs.length)];
      const t = level === 'A1' ? (i === 0 ? 'past' : 'present') : TENSES[Math.floor(rnd() * 3)];
      cards[`c:${v.id}:${t}`] = { due: now + (rnd() < 0.4 ? -1 : 1) * rnd() * 10 * DAY, s: rnd() * 40, d: 5, reps: 3, lapses: 0, last: now - DAY };
    }
    if (seed % 5 === 0) cards['c:verb_lihyot:present'] = { due: now - DAY, s: 0.5, d: 5, reps: 1, lapses: 0, last: now - 2 * DAY };
  }
  restoreState({ ...defaultState(), onboarded: true, level, cards });
  return getState();
}

// The tables holding this exact spelling (niqqud and final letters aside; יי ≠ י).
const tensesOf = (v: NonNullable<ReturnType<typeof verbById.get>>, form: string) =>
  new Set(ALL.filter((t) => Object.values(tableOf(v, t) ?? {}).some((f) => exactKey(f[0]) === exactKey(form))));

describe('Time Machine items', () => {
  it('sends a form only to the tables it is spelled exactly in (יישן future, ישן present and past)', () => {
    const lishon = verbById.get('verb_lishon')!;
    const likhyot = verbById.get('verb_likhyot')!;
    expect(lishon.future!['3ms'][0]).toBe('יישן');
    expect(sortItemFor(lishon, 'future', '3ms')!.tenses).toEqual(['future']);
    expect(sortItemFor(lishon, 'future', '3p')!.tenses).toEqual(['future']); // יישנו
    expect(new Set(sortItemFor(lishon, 'present', 'ms')!.tenses)).toEqual(new Set(['present', 'past'])); // ישן
    expect(sortItemFor(lishon, 'past', '1p')!.tenses).toEqual(['past']); // ישנו
    expect(sortItemFor(likhyot, 'imp', 'fs')!.tenses).toEqual(['imp']); // חיי
    expect(new Set(sortItemFor(likhyot, 'present', 'ms')!.tenses)).toEqual(new Set(['present', 'past'])); // חי
    for (const lane of ALL) expect(sortCorrect(sortItemFor(lishon, 'future', '3ms')!, lane)).toBe(lane === 'future');
  });
  it('grades every form of every table by all the tables it is in', () => {
    let n = 0;
    let multi = 0;
    for (const v of verbs) {
      for (const t of ALL) {
        if (!drillable(v, t)) continue;
        for (const person of Object.keys(tableOf(v, t)!)) {
          const it = sortItemFor(v, t, person)!;
          expect(it.form).toBe(tableOf(v, t)![person][0]);
          expect(it.tenses).toContain(it.shownTense);
          const real = tensesOf(v, it.form);
          expect(new Set(it.tenses)).toEqual(real);
          for (const lane of ALL) expect(sortCorrect(it, lane)).toBe(real.has(lane));
          if (it.tenses.length > 1) multi++;
          n++;
        }
      }
    }
    expect(n).toBeGreaterThan(5000);
    expect(multi).toBeGreaterThan(200); // נכנס, כתבו and friends
  });

  it('accepts both lanes for a form in two tables', () => {
    const likhtov = verbById.get('verb_likhtov')!;
    const it = sortItemFor(likhtov, 'past', '3p')!;
    expect(it.form).toBe('כתבו');
    expect(sortCorrect(it, 'past')).toBe(true);
    expect(sortCorrect(it, 'imp')).toBe(true);
    expect(sortCorrect(it, 'present')).toBe(false);
    expect(sortCorrect(it, 'future')).toBe(false);
  });

  it('has lanes in right-to-left reading order', () => {
    expect(LANE_ORDER).toEqual(['past', 'present', 'future', 'imp']);
    expect(sortLanes(stateAt('B1', 1))).toEqual(LANE_ORDER);
    expect(sortLanes(stateAt('A1', 1))).toEqual(['present']);
    expect(sortLanes(stateAt('A1', 2))).toEqual(['past', 'present']);
  });
});

describe('buildSortItems', () => {
  for (const level of LEVELS) {
    it(`builds balanced, correctly graded rounds at ${level} for seeds 1..200`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const s = stateAt(level, seed);
        const lanes = sortLanes(s);
        expect(lanes).toEqual(LANE_ORDER.filter((t) => allowedTenses(s).includes(t)));
        const items = buildSortItems(s, 15, seeded(seed));
        if (lanes.length < 2) {
          // A1 without past or future cards: one lane is no game
          expect(items).toEqual([]);
          continue;
        }
        expect(items).toHaveLength(15);
        expect(new Set(items.map((x) => x.key)).size).toBe(15);
        expect(new Set(items.map((x) => `${x.verbId}|${lenient(x.form)}`)).size).toBe(15);
        const count = new Map<TenseKey, number>();
        for (const it of items) {
          const v = verbById.get(it.verbId)!;
          expect(lanes).toContain(it.shownTense);
          expect(drillable(v, it.shownTense)).toBe(true);
          expect(levelOk(v.level, s)).toBe(true);
          expect(it.en).toBe(v.en);
          expect(it.tenses).toContain(it.shownTense);
          // tenses ⊇ the exact-spelling tenses ∩ lanes
          for (const t of tensesOf(v, it.form)) if (lanes.includes(t)) expect(it.tenses).toContain(t);
          for (const t of it.tenses) expect(tensesOf(v, it.form).has(t)).toBe(true);
          // at least one lane is right
          expect(lanes.some((t) => sortCorrect(it, t))).toBe(true);
          count.set(it.shownTense, (count.get(it.shownTense) ?? 0) + 1);
        }
        // the lanes get the same share
        const c = lanes.map((t) => count.get(t) ?? 0);
        expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(1);
        // never the same lane three times running
        for (let i = 2; i < items.length; i++) {
          const run = items[i].shownTense === items[i - 1].shownTense && items[i].shownTense === items[i - 2].shownTense;
          expect(run, `seed ${seed} at ${i}`).toBe(false);
        }
        expect(JSON.parse(JSON.stringify(items))).toEqual(items);
      }
    });
  }

  it('fills a 60-form sprint', () => {
    for (const level of ['A2', 'B1', 'C1'] as Level[]) {
      for (let seed = 1; seed <= 40; seed++) {
        const s = stateAt(level, seed);
        const items = buildSortItems(s, 60, seeded(seed));
        expect(items).toHaveLength(60);
        expect(new Set(items.map((x) => x.key)).size).toBe(60);
        const c = sortLanes(s).map((t) => items.filter((x) => x.shownTense === t).length);
        expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(1);
        for (let i = 2; i < items.length; i++) expect(items[i].shownTense === items[i - 1].shownTense && items[i].shownTense === items[i - 2].shownTense).toBe(false);
      }
    }
  });

  it('is deterministic for a seed and varies across seeds', () => {
    const s = stateAt('A2', 4);
    expect(buildSortItems(s, 15, seeded(3))).toEqual(buildSortItems(s, 15, seeded(3)));
    const orders = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) orders.add(buildSortItems(s, 15, seeded(seed)).map((x) => x.key).join());
    expect(orders.size).toBeGreaterThan(10);
  });
});

describe('spread', () => {
  it('keeps every item and breaks up runs of three', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rnd = seeded(seed);
      const keys = ['a', 'b', 'c', 'd'].slice(0, 2 + (seed % 3));
      const xs = Array.from({ length: 5 + (seed % 40) }, (_, i) => ({ i, k: keys[i % keys.length] }));
      const out = spread(xs, (x) => x.k, rnd);
      expect(out.map((x) => x.i).sort((a, b) => a - b)).toEqual(xs.map((x) => x.i));
      for (let i = 2; i < out.length; i++) expect(out[i].k === out[i - 1].k && out[i].k === out[i - 2].k).toBe(false);
    }
  });
});

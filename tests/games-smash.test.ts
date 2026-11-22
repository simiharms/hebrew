import { describe, expect, it } from 'vitest';
import type { Level } from '../src/content/types.ts';
import { buildSmashItems, type SmashChip, type SmashItem, smashBank, smashDecoys, smashTables, usedChips } from '../src/games/smash.tsx';
import { allowedTenses, sameForm, seeded } from '../src/games/kit.ts';
import { verbById, verbs } from '../src/lib/content.ts';
import { lenient } from '../src/lib/hebrew.ts';
import { drillable, TENSES } from '../src/lib/session.ts';
import { type AppState, defaultState, getState, restoreState } from '../src/lib/store.ts';
import { personChoices, tableOf, type TenseKey } from '../src/lib/verbdrill.ts';

const DAY = 86_400_000;
const LEVELS: Level[] = ['A1', 'A2', 'B1', 'C1'];
const ALL: TenseKey[] = ['present', 'past', 'future', 'imp'];

// A learner at `level` with a seeded mix of verb cards, including rare-tense
// cards that must never become a table. A1: odd seeds have no cards, even
// seeds have present cards and every fourth seed also a past card.
function stateAt(level: Level, seed: number): AppState {
  const rnd = seeded(seed * 15485863 + level.length);
  const cards: AppState['cards'] = {};
  const now = Date.now();
  if (level !== 'A1' || seed % 2 === 0) {
    const k = level === 'A1' ? 3 : 1 + Math.floor(rnd() * 50);
    for (let i = 0; i < k; i++) {
      const v = verbs[Math.floor(rnd() * verbs.length)];
      const t = level === 'A1' ? (i === 0 && seed % 4 === 0 ? 'past' : 'present') : TENSES[Math.floor(rnd() * 3)];
      cards[`c:${v.id}:${t}`] = { due: now + (rnd() < 0.4 ? -1 : 1) * rnd() * 10 * DAY, s: 0.5 + rnd() * 40, d: 5, reps: 3, lapses: 0, last: now - DAY };
    }
    if (seed % 5 === 0) {
      // rare tenses with the lowest stability of all: still never a table
      cards['c:verb_lihyot:present'] = { due: now - DAY, s: 0.01, d: 5, reps: 1, lapses: 0, last: now - 2 * DAY };
      cards['c:verb_lehagid:past'] = { due: now - DAY, s: 0.02, d: 5, reps: 1, lapses: 0, last: now - 2 * DAY };
    }
  }
  restoreState({ ...defaultState(), onboarded: true, level, cards });
  return getState();
}

// Plays a table the way the screen does: fills rows in order by tapping a
// visible chip that fits (sometimes the duplicate that belongs to a later row),
// checking at every step that the bank can finish the table.
function playTable(items: SmashItem[], table: 0 | 1, start: number, rnd: () => number): number {
  const bank = smashBank(items, table);
  const tapped = new Set<string>();
  let answered = start;
  for (const [i, it] of items.entries()) {
    if (it.table !== table) continue;
    expect(i).toBe(answered);
    const used = usedChips(bank, (row) => row < answered, tapped);
    const visible = bank.filter((c) => !used.has(c.k));
    // one chip left per unfilled row, plus every decoy
    const rowsLeft = items.filter((x, j) => x.table === table && j >= answered);
    expect(visible.filter((c) => c.row !== null)).toHaveLength(rowsLeft.length);
    expect(visible.filter((c) => c.row === null)).toHaveLength(it.decoys.length);
    const groupsLeft = new Map<string, number>();
    for (const x of rowsLeft) groupsLeft.set(lenient(x.form), (groupsLeft.get(lenient(x.form)) ?? 0) + 1);
    for (const [g, n] of groupsLeft) expect(visible.filter((c) => c.row !== null && lenient(c.form) === g)).toHaveLength(n);
    const fits = visible.filter((c) => sameForm(c.form, it.form));
    expect(fits.length).toBeGreaterThan(0);
    expect(fits.every((c) => c.row !== null)).toBe(true);
    const pick = fits[Math.floor(rnd() * fits.length)];
    tapped.add(pick.k);
    answered++;
  }
  // the whole table is used up but the decoys
  const used = usedChips(bank, (row) => row < answered, tapped);
  expect(bank.filter((c) => !used.has(c.k)).every((c: SmashChip) => c.row === null)).toBe(true);
  return answered;
}

describe('decoys', () => {
  it('never fit a row of their table, never repeat, and come from other tenses (every verb, every table)', () => {
    let n = 0;
    for (const v of verbs) {
      for (const t of ALL) {
        if (!drillable(v, t)) continue;
        const rows = Object.values(tableOf(v, t)!).map((f) => f[0]);
        const others = ALL.filter((x) => x !== t && drillable(v, x)).flatMap((x) => Object.values(tableOf(v, x)!).map((f) => f[0]));
        for (const seed of [1, 2, 3, 4, 5]) {
          const d = smashDecoys(v, t, seeded(seed + n));
          expect(d.length).toBeLessThanOrEqual(3);
          for (const f of d) {
            expect(rows.some((r) => sameForm(r, f)), `${v.id} ${t} ${f}`).toBe(false);
            expect(others).toContain(f);
          }
          for (let i = 0; i < d.length; i++) for (let j = i + 1; j < d.length; j++) expect(sameForm(d[i], d[j])).toBe(false);
          // three whenever three distinct ones exist
          const fresh = new Set(others.filter((f) => !rows.some((r) => sameForm(r, f))).map(lenient));
          expect(d.length).toBe(Math.min(3, fresh.size));
        }
        n++;
      }
    }
    expect(n).toBeGreaterThan(800);
  });
});

describe('buildSmashItems', () => {
  for (const level of LEVELS) {
    it(`builds two smashable tables at ${level} for seeds 1..200`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const s = stateAt(level, seed);
        const allowed = allowedTenses(s);
        const items = buildSmashItems(s, 2, seeded(seed));
        expect(items.length).toBeGreaterThanOrEqual(8);
        expect(items.length).toBeLessThanOrEqual(18); // two past tables at most
        expect(new Set(items.map((x) => x.key)).size).toBe(items.length);
        expect(JSON.parse(JSON.stringify(items))).toEqual(items);
        // table 0 first, then table 1
        const t0 = items.filter((x) => x.table === 0);
        const t1 = items.filter((x) => x.table === 1);
        expect(items).toEqual([...t0, ...t1]);
        expect(t1.length).toBeGreaterThan(0);
        for (const tb of [t0, t1]) {
          const { verbId, tense } = tb[0];
          const v = verbById.get(verbId)!;
          expect(tb.every((x) => x.verbId === verbId && x.tense === tense)).toBe(true);
          expect(tense).not.toBe('imp');
          expect(drillable(v, tense)).toBe(true);
          expect(allowed).toContain(tense);
          // every row of the table, in table order, with its pronoun label
          const choices = personChoices(tense).filter(([k]) => tableOf(v, tense)![k]);
          expect(tb.map((x) => x.person)).toEqual(choices.map(([k]) => k));
          expect(tb.map((x) => x.label)).toEqual(choices.map(([, he]) => he));
          for (const x of tb) {
            expect(x.form).toBe(tableOf(v, tense)![x.person][0]);
            expect(x.decoys).toEqual(tb[0].decoys);
          }
          // no decoy is sameForm to a row
          for (const d of tb[0].decoys) expect(tb.some((x) => sameForm(x.form, d))).toBe(false);
          // the bank: one chip per row plus the decoys
          const bank = smashBank(items, tb[0].table);
          expect(bank).toHaveLength(tb.length + tb[0].decoys.length);
          expect(bank.filter((c) => c.row !== null).map((c) => c.form).sort()).toEqual(tb.map((x) => x.form).sort());
          expect(bank.filter((c) => c.row === null).map((c) => c.form).sort()).toEqual([...tb[0].decoys].sort());
          expect(new Set(bank.map((c) => c.k)).size).toBe(bank.length);
          expect(smashBank(items, tb[0].table)).toEqual(bank); // derived again on resume
        }
        if (t0[0].verbId === t1[0].verbId) expect(t1[0].tense).not.toBe(t0[0].tense);
        else expect(t1[0].tense).toBe(t0[0].tense); // only one tense is open
        if (level === 'A1' && !allowed.includes('past')) expect(items.every((x) => x.tense === 'present')).toBe(true);
        const rnd = seeded(seed);
        const after0 = playTable(items, 0, 0, rnd);
        expect(playTable(items, 1, after0, rnd)).toBe(items.length);
      }
    });
  }

  it('picks table 0 from the weakest drillable cards', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = stateAt('B1', seed);
      const ranked = Object.entries(s.cards)
        .filter(([id]) => {
          const [, vid, t] = id.split(':');
          const v = verbById.get(vid);
          return !!v && (TENSES as string[]).includes(t) && drillable(v, t as 'past');
        })
        .sort((a, b) => a[1].s - b[1].s)
        .slice(0, 3)
        .map(([id]) => id);
      const [first] = smashTables(s, 2, seeded(seed));
      expect(ranked).toContain(`c:${first.verb.id}:${first.tense}`);
    }
  });

  it('falls back to an early verb: past from A2, present at A1', () => {
    restoreState({ ...defaultState(), onboarded: true, level: 'A2' });
    for (let seed = 1; seed <= 20; seed++) {
      const [a, b] = smashTables(getState(), 2, seeded(seed));
      expect(['A1', 'A2']).toContain(a.verb.level);
      expect(a.tense).toBe('past');
      expect(b.verb.id).toBe(a.verb.id);
      expect(b.tense).toBe(drillable(a.verb, 'future') ? 'future' : 'present');
    }
    restoreState({ ...defaultState(), onboarded: true, level: 'A1' });
    for (let seed = 1; seed <= 20; seed++) {
      const [a, b] = smashTables(getState(), 2, seeded(seed));
      expect(a.tense).toBe('present');
      expect(b.tense).toBe('present');
      expect(b.verb.id).not.toBe(a.verb.id);
    }
  });

  it('can build a single table', () => {
    const items = buildSmashItems(stateAt('B1', 7), 1, seeded(7));
    expect(new Set(items.map((x) => x.table))).toEqual(new Set([0]));
  });

  it('varies across seeds and repeats for a seed', () => {
    const s = stateAt('A2', 3);
    expect(buildSmashItems(s, 2, seeded(5))).toEqual(buildSmashItems(s, 2, seeded(5)));
    const tables = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) tables.add(buildSmashItems(s, 2, seeded(seed))[0].key);
    expect(tables.size).toBeGreaterThan(1);
  });
});

describe('the chip bank', () => {
  it('hides the tapped twin of a duplicate form, and derives the same count after a reload', () => {
    const likhtov = verbById.get('verb_likhtov')!;
    restoreState({ ...defaultState(), onboarded: true, level: 'B1', cards: { 'c:verb_likhtov:past': { due: Date.now(), s: 0.1, d: 5, reps: 1, lapses: 0, last: Date.now() - DAY } } });
    const items = buildSmashItems(getState(), 2, seeded(1));
    expect(items[0].verbId).toBe(likhtov.id);
    expect(items[0].tense).toBe('past');
    const bank = smashBank(items, 0);
    const twins = bank.filter((c) => c.form === 'כתבת');
    expect(twins).toHaveLength(2);
    const row2ms = items.findIndex((x) => x.person === '2ms');
    const later = twins.find((c) => c.row !== row2ms)!;
    // Tapping the 2fs chip for the 2ms row hides that very chip.
    const tapped = new Set([later.k]);
    const filled = (row: number) => row <= row2ms;
    const used = usedChips(bank, filled, tapped);
    expect(used.has(later.k)).toBe(true);
    expect(used.has(twins.find((c) => c !== later)!.k)).toBe(false);
    // Without the tap record (a resumed round) one of the twins is still left.
    const resumed = usedChips(bank, filled);
    expect(twins.filter((c) => !resumed.has(c.k))).toHaveLength(1);
  });
});

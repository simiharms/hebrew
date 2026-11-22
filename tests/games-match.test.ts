import { describe, expect, it } from 'vitest';
import type { Level, VocabItem } from '../src/content/types.ts';
import { isSingleWord, levelOk, sameGloss, seeded } from '../src/games/kit.ts';
import { assignWaves, buildMatchItems, clash, englishOrder, type MatchItem, matchVariant, shortGloss, WAVE } from '../src/games/match.tsx';
import { LETTERS } from '../src/lib/alphabet.ts';
import { findVocab, verbById, vocab } from '../src/lib/content.ts';
import { lenient } from '../src/lib/hebrew.ts';
import { type AppState, defaultState, getState, restoreState } from '../src/lib/store.ts';

const DAY = 86_400_000;
const LEVELS: Level[] = ['A1', 'A2', 'B1', 'C1'];
const FINALS = ['ך', 'ם', 'ן', 'ף', 'ץ'];
type Variant = MatchItem['kind'];

const card = (now: number, rnd: () => number) => ({
  due: now + (rnd() < 0.4 ? -1 : 1) * rnd() * 10 * DAY,
  s: rnd() * 30,
  d: 5,
  reps: 3,
  lapses: 0,
  last: now - Math.floor(1 + rnd() * 20) * DAY,
});

// A learner at `level` with a seeded mix of cards for the variant: word cards
// (due, learning and known), vp: cards with verbs only, or at A1 fewer than 10
// word cards plus some letter cards.
function stateAt(level: Level, seed: number, variant: Variant = 'word'): AppState {
  const rnd = seeded(seed * 104_729 + level.length * 31 + variant.length);
  const now = Date.now();
  const cards: AppState['cards'] = {};
  if (variant === 'word') {
    const k = 10 + Math.floor(rnd() * 80);
    for (let i = 0; i < k; i++) cards[`v:${vocab[Math.floor(rnd() * vocab.length)].id}`] = card(now, rnd);
    while (Object.keys(cards).length < 10) cards[`v:${vocab[Math.floor(rnd() * vocab.length)].id}`] = card(now, rnd);
  } else if (variant === 'letter') {
    const k = Math.floor(rnd() * 10);
    for (let i = 0; i < k; i++) cards[`v:${vocab[i * 7 + seed].id}`] = card(now, rnd);
    for (const l of LETTERS) if (rnd() < 0.5) cards[`a:${l.ch}`] = card(now, rnd);
  } else {
    const ids = [...verbById.keys()];
    for (let i = 0; i < 40; i++) if (rnd() < 0.6) cards[`vp:${ids[Math.floor(rnd() * ids.length)]}`] = card(now, rnd);
    for (let i = 0; i < 12; i++) cards[`v:${vocab[Math.floor(rnd() * vocab.length)].id}`] = card(now, rnd);
  }
  const base = defaultState();
  restoreState({ ...base, onboarded: true, level: variant === 'letter' ? 'A1' : level, cards, settings: { ...base.settings, verbsOnly: variant === 'verb' } });
  return getState();
}

// What a tile pair stands for, straight from the content: its glosses and its spellings.
function sourceOf(it: MatchItem, s: AppState): { gloss: VocabItem; he: string[]; level: string } {
  const id = it.key.slice(it.key.indexOf(':') + 1);
  if (it.kind === 'word') {
    const v = findVocab(id) ?? s.custom.find((x) => x.id === id);
    expect(v, it.key).toBeTruthy();
    return { gloss: v!, he: [v!.he.trim(), ...(v!.alt ?? [])], level: v!.level };
  }
  if (it.kind === 'verb') {
    const v = verbById.get(id);
    expect(v, it.key).toBeTruthy();
    return { gloss: { en: v!.en } as VocabItem, he: [v!.inf], level: v!.level };
  }
  const l = LETTERS.find((x) => x.ch === id);
  expect(l, it.key).toBeTruthy();
  return { gloss: { en: l!.nameTr } as VocabItem, he: [l!.ch], level: 'A1' };
}

const tileGloss = (it: MatchItem) => ({ en: it.en }) as VocabItem;

/** Everything a round must be, checked against the content rather than the builder's own helpers. */
function checkRound(items: MatchItem[], s: AppState, n: number, variant: Variant): void {
  expect(items.length).toBeLessThanOrEqual(n);
  expect(new Set(items.map((x) => x.key)).size).toBe(items.length);
  const prefix = variant === 'word' ? 'v:' : variant === 'verb' ? 'vp:' : 'a:';
  const src = new Map(items.map((it) => [it.key, sourceOf(it, s)]));
  for (const it of items) {
    const from = src.get(it.key)!;
    expect(it.kind).toBe(variant);
    expect(it.key.startsWith(prefix)).toBe(true);
    // the card it stands for, or null while the learner has none (never a new card)
    expect(it.cardId).toBe(s.cards[it.key] ? it.key : null);
    // a short tile: the Hebrew as the content spells it, the English a gloss of it
    expect(it.he).toBe(from.he[0]);
    expect(it.he.length).toBeLessThanOrEqual(18);
    expect(it.he.includes('/')).toBe(false);
    expect(it.he.split(/\s+/).length).toBeLessThanOrEqual(2);
    expect(it.en.length).toBeGreaterThan(0);
    expect(it.en.length).toBeLessThanOrEqual(28);
    expect(it.en).toBe(variant === 'letter' ? from.gloss.en : shortGloss(from.gloss.en));
    if (variant === 'letter') expect(isSingleWord(it.he)).toBe(true);
    if (!it.cardId) expect(levelOk(from.level, s)).toBe(true);
  }
  // one tile per spelling in a round (letters by the letter: ך and כ are two cards)
  const spell = items.map((x) => (variant === 'letter' ? x.he : lenient(x.he)));
  expect(new Set(spell).size).toBe(items.length);

  // waves: numbered from 0 in order, 2–5 pairs each, split evenly
  const waves: MatchItem[][] = [];
  items.forEach((it, i) => {
    expect(it.wave === (items[i - 1]?.wave ?? 0) || it.wave === (items[i - 1]?.wave ?? -1) + 1, `wave order at ${i}`).toBe(true);
    (waves[it.wave] ??= []).push(it);
  });
  expect(waves.every(Boolean)).toBe(true);
  const sizes = waves.map((w) => w.length);
  for (const k of sizes) {
    expect(k).toBeGreaterThanOrEqual(2);
    expect(k).toBeLessThanOrEqual(WAVE);
  }
  if (sizes.length) expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);

  // The wave rule: every English tile has exactly one Hebrew twin on screen.
  for (const wave of waves) {
    for (let i = 0; i < wave.length; i++) {
      for (let j = i + 1; j < wave.length; j++) {
        const a = wave[i];
        const b = wave[j];
        const sa = src.get(a.key)!;
        const sb = src.get(b.key)!;
        const why = `${a.he} (${a.en}) / ${b.he} (${b.en})`;
        expect(sameGloss(sa.gloss, sb.gloss), `same gloss: ${why}`).toBe(false);
        expect(sameGloss(tileGloss(a), sb.gloss) || sameGloss(sa.gloss, tileGloss(b)), `a tile fits both: ${why}`).toBe(false);
        const hb = new Set(sb.he.map(lenient));
        expect(
          sa.he.some((x) => hb.has(lenient(x))),
          `same Hebrew: ${why}`,
        ).toBe(false);
      }
    }
    // the English column: the same pairs, never in the Hebrew column's order
    const en = englishOrder(wave);
    expect([...en].map((x) => x.key).sort()).toEqual(wave.map((x) => x.key).sort());
    if (wave.length > 1) expect(en.map((x) => x.key)).not.toEqual(wave.map((x) => x.key));
    expect(englishOrder(wave)).toEqual(en);
  }
  // snapshots resume from JSON
  expect(JSON.parse(JSON.stringify(items))).toEqual(items);
}

describe('Match Rush helpers', () => {
  it('fits a gloss on a tile: whole, else its first part', () => {
    expect(shortGloss('book')).toBe('book');
    expect(shortGloss('to receive, to get; to accept')).toBe('to receive, to get');
    expect(shortGloss('to know (a person, a place); to meet; to recognize')).toBe('to know (a person, a place)');
    expect(shortGloss('to travel, to tour, to hike; to go for a walk')).toBe('to travel, to tour, to hike');
    expect(shortGloss('a very long gloss without any place to cut it')).toBe('');
  });

  it('keeps a final letter and its regular letter apart, and shared glosses too', () => {
    const t = (he: string, en: string, enAlt: string[] = [], alt: string[] = []) => ({ he, alt, en, enAlt, show: shortGloss(en) });
    expect(clash(t('כ', 'kaf'), t('ך', 'kaf sofít'))).toBe(true);
    expect(clash(t('כ', 'kaf'), t('ק', 'kuf'))).toBe(false);
    expect(clash(t('מכונית', 'car'), t('אוטו', 'car (colloquial)'))).toBe(true);
    expect(clash(t('גדול', 'big, large'), t('רחב', 'wide', ['large']))).toBe(true);
    expect(clash(t('לכתוב', 'to write'), t('לקרוא', 'to read; to call'))).toBe(false);
    expect(clash(t('לקרוא', 'to read; to call'), t('לצלצל', 'to call (on the phone)'))).toBe(true);
    // the same word in another spelling
    expect(clash(t('מיטה', 'bed'), t('מטה', 'staff', [], ['מיטה']))).toBe(true);
    expect(clash(t('שיר', 'song'), t('שייר', 'convoy'))).toBe(true);
  });

  it('splits candidates into even waves, a clashing one waiting for a later wave', () => {
    const t = (he: string, en: string) => ({ he, alt: [], en, enAlt: [], show: en });
    const cands = [t('א', 'a'), t('ב', 'b'), t('ג', 'a'), t('ד', 'd'), t('ה', 'e'), t('ו', 'f'), t('ז', 'g')];
    const waves = assignWaves(cands, 7);
    expect(waves.map((w) => w.length)).toEqual([4, 3]);
    expect(waves[0].map((x) => x.he)).toEqual(['א', 'ב', 'ד', 'ה']);
    expect(waves[1].map((x) => x.he)).toEqual(['ג', 'ו', 'ז']);
    expect(assignWaves([t('א', 'a')], 5)).toEqual([]);
  });

  it('picks the variant: verbs only, letters for A1 beginners, else words', () => {
    const base = defaultState();
    const with10 = Object.fromEntries(vocab.slice(0, 10).map((v) => [`v:${v.id}`, card(Date.now(), seeded(1))]));
    const with9 = Object.fromEntries(vocab.slice(0, 9).map((v) => [`v:${v.id}`, card(Date.now(), seeded(1))]));
    expect(matchVariant({ ...base, level: 'A1' })).toBe('letter');
    expect(matchVariant({ ...base, level: 'A1', cards: with9 })).toBe('letter');
    expect(matchVariant({ ...base, level: 'A1', cards: with10 })).toBe('word');
    expect(matchVariant({ ...base, level: 'A2' })).toBe('word');
    expect(matchVariant({ ...base, level: 'C1', cards: with9 })).toBe('word');
    for (const level of LEVELS) expect(matchVariant({ ...base, level, settings: { ...base.settings, verbsOnly: true } })).toBe('verb');
  });
});

describe('buildMatchItems', () => {
  for (const level of LEVELS) {
    it(`words at ${level}: 15 pairs (40 in a sprint), no wave with a shared gloss or Hebrew (seeds 1..200)`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const s = stateAt(level, seed, 'word');
        expect(matchVariant(s)).toBe('word');
        const items = buildMatchItems(s, 15, seeded(seed));
        expect(items).toHaveLength(15);
        expect(items.map((x) => x.wave)).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2]);
        checkRound(items, s, 15, 'word');
        if (seed % 4 === 0) {
          const sprint = buildMatchItems(s, 40, seeded(seed));
          expect(sprint).toHaveLength(40);
          checkRound(sprint, s, 40, 'word');
        }
      }
    }, 60_000);

    it(`verbs only at ${level}: infinitives with their vp: cards (seeds 1..200)`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const s = stateAt(level, seed, 'verb');
        const items = buildMatchItems(s, 15, seeded(seed));
        expect(items).toHaveLength(15);
        checkRound(items, s, 15, 'verb');
        for (const it of items) expect(it.he.startsWith('ל')).toBe(true);
        if (seed % 4 === 0) {
          const sprint = buildMatchItems(s, 40, seeded(seed));
          expect(sprint).toHaveLength(40);
          checkRound(sprint, s, 40, 'verb');
        }
      }
    }, 60_000);
  }

  it('letters at A1 with fewer than 10 word cards, finals included (seeds 1..200)', () => {
    const finalsSeen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const s = stateAt('A1', seed, 'letter');
      expect(matchVariant(s)).toBe('letter');
      const items = buildMatchItems(s, 15, seeded(seed));
      expect(items).toHaveLength(15);
      checkRound(items, s, 15, 'letter');
      for (const it of items) if (FINALS.includes(it.he)) finalsSeen.add(it.he);
      // A sprint deals the whole alphabet: all 27 letters, each final in another wave than its letter.
      const sprint = buildMatchItems(s, 40, seeded(seed));
      expect(sprint).toHaveLength(LETTERS.length);
      checkRound(sprint, s, 40, 'letter');
      expect(new Set(sprint.map((x) => x.he))).toEqual(new Set(LETTERS.map((l) => l.ch)));
    }
    expect([...finalsSeen].sort()).toEqual([...FINALS].sort());
  }, 60_000);

  it('letters being learned come first, then new ones', () => {
    const now = Date.now();
    const learning = ['ש', 'ך', 'ת', 'א'];
    const cards: AppState['cards'] = {};
    for (const l of LETTERS) cards[`a:${l.ch}`] = { due: now + 30 * DAY, s: 60, d: 4, reps: 8, lapses: 0, last: now - DAY };
    for (const ch of learning) cards[`a:${ch}`] = { due: now - DAY, s: 2, d: 6, reps: 2, lapses: 1, last: now - 3 * DAY };
    for (const ch of ['ב', 'ג', 'ד']) delete cards[`a:${ch}`];
    restoreState({ ...defaultState(), onboarded: true, level: 'A1', cards });
    for (let seed = 1; seed <= 30; seed++) {
      const items = buildMatchItems(getState(), 15, seeded(seed));
      const hes = items.map((x) => x.he);
      for (const ch of [...learning, 'ב', 'ג', 'ד']) expect(hes, ch).toContain(ch);
      expect(items.filter((x) => learning.includes(x.he)).every((x) => x.cardId === `a:${x.he}`)).toBe(true);
      expect(items.find((x) => x.he === 'ב')!.cardId).toBeNull();
    }
  });

  it('due and learning words always come in', () => {
    // Eight due words that can share a wave (short, no shared gloss or spelling).
    const picked: VocabItem[] = [];
    const pairable = (v: VocabItem) => ({ he: v.he, alt: v.alt ?? [], en: v.en, enAlt: v.enAlt ?? [], show: shortGloss(v.en) });
    for (const v of vocab) {
      if (picked.length >= 8) break;
      if (v.level !== 'A1' || !isSingleWord(v.he) || v.he.length > 12 || !shortGloss(v.en)) continue;
      if (picked.some((p) => clash(pairable(p), pairable(v)))) continue;
      picked.push(v);
    }
    expect(picked).toHaveLength(8);
    const now = Date.now();
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 40; seed++) {
        const rnd = seeded(seed);
        const cards: AppState['cards'] = {};
        // plenty of known words seen long ago, which must wait
        for (let i = 0; i < 60; i++) cards[`v:${vocab[(seed * 37 + i * 11) % vocab.length].id}`] = { due: now + 20 * DAY, s: 40, d: 4, reps: 6, lapses: 0, last: now - 30 * DAY };
        for (const v of picked) cards[`v:${v.id}`] = { due: now - rnd() * 3 * DAY, s: 1 + rnd() * 2, d: 6, reps: 2, lapses: 1, last: now - 4 * DAY };
        restoreState({ ...defaultState(), onboarded: true, level, cards });
        const s = getState();
        const items = buildMatchItems(s, 15, rnd);
        checkRound(items, s, 15, 'word');
        const due = items.filter((x) => picked.some((v) => `v:${v.id}` === x.key));
        expect(due, `${level} seed ${seed}`).toHaveLength(8);
      }
    }
  });

  it('two words sharing a gloss never share a wave', () => {
    // Find content words with a shared English gloss and make them all due at once.
    const short = vocab.filter((v) => v.level === 'A1' || v.level === 'A2').filter((v) => isSingleWord(v.he) && shortGloss(v.en));
    const groups = new Map<string, VocabItem[]>();
    for (const v of short) {
      const k = shortGloss(v.en).toLowerCase();
      groups.set(k, [...(groups.get(k) ?? []), v]);
    }
    const twins = [...groups.values()].filter((g) => g.length > 1).flat();
    expect(twins.length).toBeGreaterThanOrEqual(4);
    const now = Date.now();
    const cards: AppState['cards'] = {};
    for (const v of twins.slice(0, 15)) cards[`v:${v.id}`] = { due: now - DAY, s: 1, d: 6, reps: 1, lapses: 0, last: now - 2 * DAY };
    restoreState({ ...defaultState(), onboarded: true, level: 'A2', cards });
    for (let seed = 1; seed <= 50; seed++) checkRound(buildMatchItems(getState(), 15, seeded(seed)), getState(), 15, 'word');
  });

  it('is deterministic for a seed and varies across seeds', () => {
    for (const variant of ['word', 'verb', 'letter'] as const) {
      const s = stateAt('B1', 3, variant);
      expect(buildMatchItems(s, 15, seeded(9))).toEqual(buildMatchItems(s, 15, seeded(9)));
      const rounds = new Set<string>();
      for (let seed = 1; seed <= 20; seed++) rounds.add(buildMatchItems(s, 15, seeded(seed)).map((x) => x.key).join());
      expect(rounds.size, variant).toBeGreaterThan(10);
    }
  });

  it('a new learner at B1 gets a full round of new words at their level', () => {
    restoreState({ ...defaultState(), onboarded: true, level: 'B1' });
    for (let seed = 1; seed <= 50; seed++) {
      const items = buildMatchItems(getState(), 15, seeded(seed));
      expect(items).toHaveLength(15);
      expect(items.every((x) => x.cardId === null)).toBe(true);
      checkRound(items, getState(), 15, 'word');
      expect(buildMatchItems(getState(), 40, seeded(seed))).toHaveLength(40);
    }
  });
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Burst, createRound } from '../src/games/kit-ui.tsx';
import type { GameId } from '../src/lib/store.ts';
import type { VocabItem } from '../src/content/types.ts';
import { vocab, verbById, verbs } from '../src/lib/content.ts';
import { type CardState, review } from '../src/lib/fsrs.ts';
import { lenient } from '../src/lib/hebrew.ts';
import { drillable, type Tense, TENSES } from '../src/lib/session.ts';
import { type AppState, dateKey, defaultState, exportState, getState, importState, resetState, restoreState, setState, subscribe, today } from '../src/lib/store.ts';
import { weakestSkills, weakTopics } from '../src/lib/skills.ts';
import { sixStatus } from '../src/games/ride.ts';
import { tableOf, type TenseKey } from '../src/lib/verbdrill.ts';
import {
  allowedTenses,
  applyEvidence,
  BADGES,
  calm,
  clearRound,
  comboMultiplier,
  confuserForms,
  daySeed,
  type Evidence,
  finalize,
  type GameMode,
  finishRound,
  formIndex,
  formOf,
  GAMES,
  grantXp,
  hashSeed,
  isSingleWord,
  itemXp,
  levelFromXp,
  levelOk,
  loadRound,
  peekRound,
  personsFor,
  pickVerbTenses,
  playerLevel,
  primeAudio,
  PRONOUNS,
  pronounsFor,
  RANKS,
  type RoundSnapshot,
  sameForm,
  sameGloss,
  sample,
  saveRound,
  say,
  seeded,
  sfx,
  shuffle,
  splitTable,
  starsFor,
  TENSE_LABEL,
  unfinal,
  validPronouns,
  verbMedal,
  vocabPool,
  XP,
} from '../src/games/kit.ts';

const ALL: TenseKey[] = ['present', 'past', 'future', 'imp'];
const DAY = 86_400_000;
const likhtov = verbById.get('verb_likhtov')!;

// An in-memory localStorage for the round snapshot (tests run in node).
const mem = new Map<string, string>();
beforeAll(() => {
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size;
    },
  } as Storage;
});

function fresh(patch: Partial<AppState> = {}): AppState {
  restoreState({ ...defaultState(), onboarded: true, level: 'A2', ...patch });
  return getState();
}

const card = (patch: Partial<CardState> = {}): CardState => ({ due: Date.now() + 5 * DAY, s: 6, d: 5, reps: 3, lapses: 0, last: Date.now() - DAY, ...patch });

describe('scoring', () => {
  it('multiplies by the combo after the answer', () => {
    expect([0, 2, 3, 5, 6, 9, 10, 25].map(comboMultiplier)).toEqual([1, 1, 1.5, 1.5, 2, 2, 3, 3]);
  });
  it('pays per tier, rounded, ×2 in terminus', () => {
    expect(itemXp('tap', 0)).toBe(10);
    expect(itemXp('build', 3)).toBe(23); // 22.5
    expect(itemXp('typed', 10)).toBe(60);
    expect(itemXp('typed', 0, 0.5)).toBe(10);
    expect(itemXp('tap', 6, 1, true)).toBe(40);
    expect(itemXp('build', 0, 1, false)).toBe(XP.build);
  });
  it('gives stars by first-try share, or by count in a sprint', () => {
    expect(starsFor(12, 12)).toBe(3);
    expect(starsFor(19, 20)).toBe(3);
    expect(starsFor(18, 20)).toBe(2);
    expect(starsFor(16, 20)).toBe(2);
    expect(starsFor(15, 20)).toBe(1);
    expect(starsFor(0, 0)).toBe(1);
    expect(starsFor(25, 30, true)).toBe(3);
    expect(starsFor(15, 15, true)).toBe(2);
    expect(starsFor(14, 14, true)).toBe(1);
  });
  it('levels at 50·L·(L−1) XP', () => {
    expect([0, 99, 100, 299, 300, 600, 4499, 4500, -5].map(levelFromXp)).toEqual([1, 1, 2, 2, 3, 4, 9, 10, 1]);
    for (let L = 1; L <= 40; L++) {
      expect(levelFromXp(50 * L * (L - 1))).toBe(L);
      if (L > 1) expect(levelFromXp(50 * L * (L - 1) - 1)).toBe(L - 1);
    }
  });
  it('names the rank and the way to the next level', () => {
    expect(playerLevel(150)).toEqual({ level: 2, rank: RANKS[0], into: 50, span: 200 });
    expect(playerLevel(1000).rank.en).toBe('Stop');
    expect(playerLevel(4500).rank.en).toBe('Bus line');
    expect(playerLevel(50 * 20 * 19).rank.en).toBe('Whole country');
  });
  it('grants XP to the lifetime total and the day', () => {
    fresh();
    grantXp(60);
    grantXp(0);
    expect(getState().play.xp).toBe(60);
    expect(getState().days.find((d) => d.date === today())?.xp).toBe(60);
  });
});

describe('metadata', () => {
  it('lists the nine games once each', () => {
    expect(GAMES.map((g) => g.id)).toEqual(['snap', 'sort', 'forge', 'smash', 'six', 'echo', 'match', 'gender', 'gap']);
    expect(GAMES.filter((g) => g.verbs).length).toBe(6);
    expect(GAMES.filter((g) => g.sprint).map((g) => g.id)).toEqual(['sort', 'match']);
    expect(GAMES.find((g) => g.id === 'forge')!.tier).toBe('build');
    expect(GAMES.find((g) => g.id === 'six')!.tier).toBe('typed');
  });
  it('labels every tense and has nine distinct badges', () => {
    expect(Object.keys(TENSE_LABEL).sort()).toEqual([...ALL].sort());
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(9);
  });
});

describe('Hebrew helpers', () => {
  it('finalizes and unfinalizes the last letter', () => {
    expect(finalize('קמ')).toBe('קם');
    expect(unfinal('קם')).toBe('קמ');
    expect(finalize('כתבתמ')).toBe('כתבתם');
    expect(finalize('ימ')).toBe('ים');
    expect(finalize('תמ')).toBe('תם');
    expect(finalize('קםו')).toBe('קמו');
    expect(finalize('מלכ מלכה')).toBe('מלך מלכה');
    expect(unfinal('ךםןףץ')).toBe('כמנפצ');
  });
  it('compares forms leniently', () => {
    expect(sameForm('כתבתם', 'כתבתמ')).toBe(true);
    expect(sameForm('תדבר', 'תדבר')).toBe(true);
    expect(sameForm('כתב', 'כתבה')).toBe(false);
  });
  it('finds every pronoun that can say a form', () => {
    expect(validPronouns(likhtov, 'past', 'כתבת').sort()).toEqual(['את', 'אתה'].sort());
    expect(validPronouns(likhtov, 'present', 'כותבת').sort()).toEqual(['אני', 'את', 'היא'].sort());
    expect(validPronouns(likhtov, 'future', 'תכתוב').sort()).toEqual(['אתה', 'היא'].sort());
    expect(validPronouns(likhtov, 'future', 'תכתבו').sort()).toEqual(['אתם', 'אתן'].sort());
    expect(validPronouns(likhtov, 'imp', 'כתבו').sort()).toEqual(['אתם', 'אתן'].sort());
    expect(validPronouns(likhtov, 'past', 'נכתוב')).toEqual([]);
  });
  it('maps pronouns and persons both ways', () => {
    expect(personsFor('present', 'אני')).toEqual(['ms', 'fs']);
    expect(personsFor('future', 'אתן')).toEqual(['2mp']);
    expect(personsFor('past', 'אתן')).toEqual(['2fp']);
    expect(personsFor('imp', 'אתן')).toEqual(['mp']);
    expect(pronounsFor('past', '3p').map((p) => p[0])).toEqual(['הם', 'הן']);
    expect(pronounsFor('imp', 'fs')).toEqual([['את', 'you (f)']]);
    expect(pronounsFor('present', 'fs')[0]).toEqual(['אני', 'I (f)']);
    expect(formOf(likhtov, 'past', '1s')).toBe('כתבתי');
    expect(formOf(likhtov, 'imp', '1s')).toBeUndefined();
  });
  it('indexes drillable forms by lenient spelling', () => {
    const idx = formIndex();
    expect(idx.get('כתבתי')).toEqual(expect.arrayContaining([{ verbId: 'verb_likhtov', tense: 'past', person: '1s' }]));
    expect(idx.get('כתבתמ')).toEqual(expect.arrayContaining([{ verbId: 'verb_likhtov', tense: 'past', person: '2mp' }]));
    expect(formIndex()).toBe(idx);
    // rare tenses are left out
    const lihyot = verbById.get('verb_lihyot')!;
    for (const list of idx.values()) expect(list.some((x) => x.verbId === lihyot.id && x.tense === 'present')).toBe(false);
  });
  it('compares glosses both ways and spots single words', () => {
    const w = (en: string, enAlt?: string[]) => ({ ...vocab[0], en, enAlt }) as VocabItem;
    expect(sameGloss(w('house'), w('home', ['house']))).toBe(true);
    expect(sameGloss(w('to go'), w('go / walk'))).toBe(true);
    expect(sameGloss(w('the city (big)'), w('city'))).toBe(true);
    expect(sameGloss(w('house'), w('horse'))).toBe(false);
    expect(isSingleWord('בית')).toBe(true);
    expect(isSingleWord('בית ספר')).toBe(false);
    expect(isSingleWord('מצטער/ת')).toBe(false);
  });
});

describe('sweeps over every verb', () => {
  const lipol = verbs.find((v) => v.inf === 'ליפול')!;
  it('splits every drillable table into stem + chunks (except the future of ליפול)', () => {
    const nulls: string[] = [];
    let tables = 0;
    for (const v of verbs) {
      // splitTable is typed for Forge's three tenses but works on the imperative too
      for (const t of ALL.filter((x) => drillable(v, x))) {
        tables++;
        const split = splitTable(v, t as Tense);
        if (!split) {
          nulls.push(`${v.id}:${t}`);
          continue;
        }
        expect(split.stem.length).toBeGreaterThanOrEqual(2);
        expect(split.stem).toBe(unfinal(split.stem));
        expect(split.pre.length + split.suf.length, `${v.inf} ${t}`).toBeLessThanOrEqual(9);
        expect(new Set(split.pre).size).toBe(split.pre.length);
        expect(new Set(split.suf).size).toBe(split.suf.length);
        for (const [person, f] of Object.entries(tableOf(v, t)!)) {
          const part = split.parts[person];
          expect(split.pre).toContain(part.pre);
          expect(split.suf).toContain(part.suf);
          expect(sameForm(part.pre + split.stem + part.suf, f[0]), `${v.inf} ${t} ${person}`).toBe(true);
          expect(finalize(part.pre + split.stem + part.suf)).toBe(finalize(f[0]));
        }
      }
    }
    expect(tables).toBe(820);
    expect(nulls).toEqual([`${lipol.id}:future`]);
  });
  it('offers confusers that differ from the target and from each other', () => {
    const rnd = seeded(7);
    for (const v of verbs) {
      for (const t of ALL.filter((x) => drillable(v, x))) {
        const table = tableOf(v, t)!;
        for (const [person, f] of Object.entries(table)) {
          const target = f[0];
          const sameTense = Object.entries(table).filter(([p, g]) => p !== person && !sameForm(g[0], target));
          const otherTense = ALL.filter((x) => x !== t && drillable(v, x)).flatMap((x) => Object.values(tableOf(v, x)!).filter((g) => !sameForm(g[0], target)));
          const distinct = new Set([...sameTense.map(([, g]) => g[0]), ...otherTense.map((g) => g[0])].map(lenient));
          for (const n of [1, 2, 3]) {
            const out = confuserForms(v, t, person, n, rnd);
            const where = `${v.inf} ${t} ${person} n=${n}: ${out.join(',')}`;
            expect(out.length, where).toBe(Math.min(n, distinct.size));
            for (let i = 0; i < out.length; i++) {
              expect(sameForm(out[i], target), where).toBe(false);
              for (let j = i + 1; j < out.length; j++) expect(sameForm(out[i], out[j]), where).toBe(false);
            }
            if (n >= 2 && sameTense.length && otherTense.length) {
              expect(out.some((x) => sameTense.some(([, g]) => g[0] === x)), where).toBe(true);
              expect(out.some((x) => otherTense.some((g) => g[0] === x)), where).toBe(true);
            }
          }
        }
      }
    }
  });
  it('keeps confusers clear of excluded answers', () => {
    const out = confuserForms(likhtov, 'past', '1s', 3, seeded(3), ['כתבנו', 'כותב']);
    expect(out.some((x) => sameForm(x, 'כתבנו') || sameForm(x, 'כותב'))).toBe(false);
    expect(confuserForms(likhtov, 'imp', '1s', 3)).toEqual([]);
  });
  it('gives every form a pronoun, and Snap enough wrong pronouns', () => {
    for (const v of verbs) {
      for (const t of ALL.filter((x) => drillable(v, x))) {
        for (const [person, f] of Object.entries(tableOf(v, t)!)) {
          const valid = validPronouns(v, t, f[0]);
          const where = `${v.inf} ${t} ${person}`;
          for (const [p] of pronounsFor(t, person)) expect(valid, where).toContain(p);
          // every valid pronoun is backed by a row with this spelling
          for (const p of valid) expect(personsFor(t, p).some((q) => tableOf(v, t)![q] && sameForm(tableOf(v, t)![q][0], f[0])), where).toBe(true);
          const pool = t === 'imp' ? ['אתה', 'את', 'אתם', 'אתן'] : PRONOUNS;
          expect(pool.filter((p) => !valid.includes(p)).length, where).toBeGreaterThanOrEqual(t === 'imp' ? 2 : 3);
        }
      }
    }
  });
});

describe('evidence', () => {
  const id = 'c:verb_likhtov:past';
  const log = () => getState().days.find((d) => d.date === today());
  const ev = (patch: Partial<Evidence>): Evidence => ({ tier: 'tap', ok: true, skill: 'verbs', cardId: id, ...patch });

  it('a right tap leaves the card alone', () => {
    const c = card();
    fresh({ cards: { [id]: c } });
    expect(applyEvidence([ev({})], new Set())).toBe(0);
    expect(getState().cards[id]).toEqual(c);
    expect(log()?.reviews ?? 0).toBe(0);
  });
  it('a wrong tap only pulls the card forward', () => {
    const c = card();
    fresh({ cards: { [id]: c } });
    const now = Date.now();
    applyEvidence([ev({ ok: false })], new Set(), now);
    const after = getState().cards[id];
    expect(after.due).toBeLessThanOrEqual(now);
    expect([after.s, after.d, after.reps, after.lapses, after.last]).toEqual([c.s, c.d, c.reps, c.lapses, c.last]);
    expect(log()?.reviews ?? 0).toBe(0);
    // an earlier due date stays
    const early = card({ due: now - DAY });
    fresh({ cards: { [id]: early } });
    applyEvidence([ev({ ok: false })], new Set(), now);
    expect(getState().cards[id].due).toBe(now - DAY);
  });
  it('a right build on a due card reviews it with g 3', () => {
    const now = Date.now();
    const c = card({ due: now - 1000 });
    fresh({ cards: { [id]: c } });
    expect(applyEvidence([ev({ tier: 'build' })], new Set(), now)).toBe(1);
    expect(getState().cards[id]).toEqual(review(c, 3, now, getState().settings.retention));
    expect(getState().cards[id].reps).toBe(c.reps + 1);
    expect(log()!.reviews).toBe(1);
    expect(log()!.correct).toBe(1);
  });
  it('a build is never graded 4', () => {
    const now = Date.now();
    const c = card({ due: now - 1000 });
    fresh({ cards: { [id]: c } });
    applyEvidence([ev({ tier: 'build', grade: 4 })], new Set(), now);
    expect(getState().cards[id]).toEqual(review(c, 3, now, getState().settings.retention));
    // nor anything but 3 or 1: a grade on a build is ignored
    fresh({ cards: { [id]: c } });
    applyEvidence([ev({ tier: 'build', grade: 2 })], new Set(), now);
    expect(getState().cards[id]).toEqual(review(c, 3, now, getState().settings.retention));
  });
  it('a right build on a card that is not due changes nothing', () => {
    const c = card();
    fresh({ cards: { [id]: c } });
    expect(applyEvidence([ev({ tier: 'build' })], new Set())).toBe(0);
    expect(getState().cards[id]).toEqual(c);
    expect(log()?.reviews ?? 0).toBe(0);
  });
  it('a wrong build on a card that is not due makes it due now and banks the mistake', () => {
    const c = card();
    fresh({ cards: { [id]: c } });
    const now = Date.now();
    const mistake = { kind: 'verb' as const, ref: 'verb_likhtov:past:1s', prompt: 'אני · לכתוב · עבר', answer: 'כתבתי', given: 'כתבת' };
    applyEvidence([ev({ tier: 'build', ok: false, mistake })], new Set(), now);
    expect(getState().cards[id]).toEqual({ ...c, due: now });
    expect(getState().mistakes).toEqual([{ ...mistake, at: now }]);
    expect(log()?.reviews ?? 0).toBe(0);
  });
  it('a wrong build on a due card reviews it with g 1', () => {
    const now = Date.now();
    const c = card({ due: now - 1000 });
    fresh({ cards: { [id]: c } });
    expect(applyEvidence([ev({ tier: 'build', ok: false })], new Set(), now)).toBe(0);
    expect(getState().cards[id]).toEqual(review(c, 1, now, getState().settings.retention));
    expect(log()!.reviews).toBe(1);
    expect(log()!.correct).toBe(0);
  });
  it('typed g 2 equals review(card, 2) and records 0.6', () => {
    const now = Date.now();
    const c = card({ due: now - 1000 });
    fresh({ cards: { [id]: c } });
    expect(applyEvidence([ev({ tier: 'typed', grade: 2 })], new Set(), now)).toBe(1);
    expect(getState().cards[id]).toEqual(review(c, 2, now, getState().settings.retention));
    expect(log()!.reviews).toBe(1);
    expect(log()!.correct).toBe(0);
    expect(getState().profile.skills.verbs).toMatchObject({ score: 0.6, n: 1 });
  });
  it('never creates a card', () => {
    fresh();
    const rated = new Set<string>();
    applyEvidence(
      [
        ev({ cardId: 'c:verb_likhtov:future', ok: false }),
        ev({ tier: 'build', cardId: 'c:verb_likhtov:present' }),
        ev({ tier: 'typed', cardId: 'v:nope', grade: 3 }),
        ev({ tier: 'build', cardId: null, ok: false }),
      ],
      rated,
    );
    expect(getState().cards).toEqual({});
    expect(rated.size).toBe(0);
    expect(log()?.reviews ?? 0).toBe(0);
  });
  it('reviews a card at most once per round', () => {
    const now = Date.now();
    const c = card({ due: now - 1000 });
    fresh({ cards: { [id]: c } });
    const rated = new Set<string>();
    expect(applyEvidence([ev({ tier: 'build' }), ev({ tier: 'build' })], rated, now)).toBe(1);
    expect(applyEvidence([ev({ tier: 'typed', grade: 3 })], rated, now)).toBe(0);
    const once = review(c, 3, now, getState().settings.retention);
    expect(getState().cards[id]).toEqual(once);
    expect(rated.has(id)).toBe(true);
    // a later miss can still pull it forward, but never reviews it again
    applyEvidence([ev({ tier: 'build', ok: false })], rated, now + 1);
    expect(getState().cards[id]).toEqual({ ...once, due: now + 1 });
    expect(log()!.reviews).toBe(1);
  });
  it('a first right answer on a card that is not due still uses up its review', () => {
    const now = Date.now();
    fresh({ cards: { [id]: card() } });
    const rated = new Set<string>();
    applyEvidence([ev({ tier: 'build' })], rated, now);
    applyEvidence([ev({ tier: 'build', ok: false })], rated, now);
    applyEvidence([ev({ tier: 'build' })], rated, now + 5);
    expect(getState().cards[id].due).toBe(now);
    expect(log()?.reviews ?? 0).toBe(0);
  });
  it('banks mistakes only for build and typed misses', () => {
    fresh();
    const m = (ref: string) => ({ kind: 'verb' as const, ref, prompt: 'p', answer: 'a', given: 'g' });
    applyEvidence(
      [
        ev({ ok: false, mistake: m('tap') }),
        ev({ tier: 'build', ok: true, mistake: m('build-right') }),
        ev({ tier: 'build', ok: false, mistake: m('build-wrong') }),
        ev({ tier: 'typed', grade: 2, mistake: m('typed-2') }),
        ev({ tier: 'typed', grade: 3, mistake: m('typed-3') }),
        ev({ tier: 'typed', ok: false, grade: 1, mistake: m('typed-1') }),
      ],
      new Set(),
    );
    expect(getState().mistakes.map((x) => x.ref)).toEqual(['build-wrong', 'typed-2', 'typed-1']);
  });
  it('weighs the skill profile by tier', () => {
    for (const [tier, n] of [['tap', 0.25], ['build', 0.6], ['typed', 1]] as const) {
      fresh();
      applyEvidence([{ tier, ok: true, skill: 'verbs', topics: ['tense:past'] }], new Set());
      expect(getState().profile.skills.verbs!.n).toBeCloseTo(n);
      expect(getState().profile.topics['tense:past'].n).toBeCloseTo(n);
    }
    fresh();
    applyEvidence([{ tier: 'tap', ok: false, skill: 'listening', weight: 0.3 }], new Set());
    expect(getState().profile.skills.listening).toMatchObject({ n: 0.3, score: 0 });
  });
  it('a tap moves an established skill score much less than a typed answer', () => {
    const start = (): AppState =>
      fresh({ profile: { skills: { verbs: { score: 0.45, n: 60, at: 0 } }, topics: { 'binyan:piel': { score: 0.4, n: 30, at: 0 } } } });
    const gain: Record<string, number> = {};
    for (const tier of ['tap', 'build', 'typed'] as const) {
      start();
      for (let i = 0; i < 24; i++) applyEvidence([{ tier, ok: true, skill: 'verbs', topics: ['binyan:piel', 'tense:past'] }], new Set());
      gain[tier] = getState().profile.skills.verbs!.score - 0.45;
    }
    expect(gain.tap).toBeLessThan(gain.typed / 2);
    expect(gain.tap).toBeLessThan(gain.build);
    expect(gain.build).toBeLessThan(gain.typed);
    // a verb-weak learner's plan stays on verbs after a couple of easy tap rounds
    start();
    setState((s) => {
      s.profile.skills.grammar = { score: 0.6, n: 40, at: 0 };
      s.profile.skills.vocab = { score: 0.7, n: 40, at: 0 };
    });
    for (let i = 0; i < 24; i++) applyEvidence([{ tier: 'tap', ok: true, skill: 'verbs', topics: ['binyan:piel'] }], new Set());
    expect(weakestSkills(getState())[0]).toBe('verbs');
    expect(weakTopics('binyan:', getState()).map((w) => w.topic)).toContain('binyan:piel');
    // weight ≥ 1 behaves as before, and a weight-0 record never turns a score into NaN
    fresh();
    applyEvidence([{ tier: 'typed', ok: true, skill: 'verbs', weight: 0 }], new Set());
    applyEvidence([{ tier: 'typed', ok: false, skill: 'verbs', weight: 0 }], new Set());
    expect(Number.isFinite(getState().profile.skills.verbs!.score)).toBe(true);
  });
  it('writes once for a batch and not at all for an empty one', () => {
    fresh();
    let writes = 0;
    const off = subscribe(() => writes++);
    applyEvidence([], new Set());
    applyEvidence([ev({}), ev({ ok: false }), ev({ tier: 'build' })], new Set());
    off();
    expect(writes).toBe(1);
  });
});

describe('state', () => {
  it('old backups import with play defaults', () => {
    importState(JSON.stringify({ version: 1, onboarded: true, cards: {}, settings: { newPerDay: 5 } }));
    const s = getState();
    expect(s.play).toEqual(defaultState().play);
    expect(s.settings.sound).toBe(false);
    expect(s.settings.gameVoice).toBe(false);
    expect(s.settings.calm).toBe(false);
    expect(s.settings.rideStops).toBe(3);
    expect(s.settings.newPerDay).toBe(5);
  });
  it('reset and import drop the half-played rounds (they belong to the old progress)', () => {
    fresh();
    const backup = exportState();
    const live = (game: GameId) => ({ v: 1 as const, game, mode: 'ride' as GameMode, date: today(), startedAt: Date.now(), savedAt: Date.now(), items: [{}, {}, {}, {}], results: [{ ok: true, firstTry: true }, null, null, null], missed: [], xp: 10, combo: 1, bestCombo: 1, strengthened: 0, rated: [], misses: [], verbIds: [] });
    saveRound(live('forge'));
    expect(peekRound()).toMatchObject({ game: 'forge', answered: 1 });
    resetState();
    expect(peekRound()).toBeNull();
    expect(loadRound('forge', 'ride')).toBeNull();
    saveRound(live('snap'));
    importState(backup);
    expect(peekRound()).toBeNull();
  });
  it('keeps saved play fields and fills new ones', () => {
    restoreState({ ...defaultState(), play: { xp: 120, best: {} } } as unknown as AppState);
    expect(getState().play.xp).toBe(120);
    expect(getState().play.badges).toEqual([]);
    expect(getState().play.ride).toBeNull();
  });
});

describe('level gates', () => {
  it('allows the present only at A1, plus tenses that already have cards', () => {
    expect(allowedTenses(fresh({ level: 'A1' }))).toEqual(['present']);
    expect(allowedTenses(fresh({ level: 'A1', cards: { 'c:verb_likhtov:past': card() } }))).toEqual(['present', 'past']);
    expect(allowedTenses(fresh({ level: 'A2' }))).toEqual(['present', 'past', 'future', 'imp']);
  });
  it('lets items one step ahead through', () => {
    const s = fresh({ level: 'A2' });
    expect(levelOk('A1', s)).toBe(true);
    expect(levelOk('A2+', s)).toBe(true);
    expect(levelOk('B1', s)).toBe(false);
    expect(levelOk('B1', s, 2)).toBe(true);
    expect(levelOk('A2', s, 0)).toBe(true);
  });
});

describe('pickVerbTenses', () => {
  const check = (s: AppState, picks: ReturnType<typeof pickVerbTenses>, maxPerVerb = 2) => {
    const keys = picks.map((p) => `${p.verb.id}:${p.tense}`);
    expect(new Set(keys).size).toBe(keys.length);
    const per = new Map<string, number>();
    for (const p of picks) {
      per.set(p.verb.id, (per.get(p.verb.id) ?? 0) + 1);
      expect(drillable(p.verb, p.tense)).toBe(true);
      expect(levelOk(p.verb.level, s)).toBe(true);
      expect(allowedTenses(s)).toContain(p.tense);
      expect(p.cardId).toBe(p.tense === 'imp' ? null : `c:${p.verb.id}:${p.tense}`);
      expect(p.due).toBe(!!p.cardId && !!s.cards[p.cardId] && s.cards[p.cardId].due <= Date.now());
    }
    for (const n of per.values()) expect(n).toBeLessThanOrEqual(maxPerVerb);
  };
  it('is present-only and never empty for a new A1 learner', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = fresh({ level: 'A1' });
      const picks = pickVerbTenses(s, 12, { rnd: seeded(seed) });
      expect(picks.length).toBe(12);
      expect(picks.every((p) => p.tense === 'present')).toBe(true);
      check(s, picks);
    }
  });
  it('puts due cards first, oldest due first', () => {
    const now = Date.now();
    const s = fresh({
      level: 'B1',
      cards: {
        'c:verb_likhtov:past': card({ due: now - 3 * DAY }),
        'c:verb_likhtov:future': card({ due: now - DAY }),
        'c:verb_likhtov:present': card({ due: now + DAY }),
      },
    });
    const picks = pickVerbTenses(s, 6, { dueFirst: true, tenses: ['present', 'past', 'future'], rnd: seeded(2) });
    expect(picks.slice(0, 2).map((p) => [p.tense, p.due])).toEqual([
      ['past', true],
      ['future', true],
    ]);
    expect(picks.some((p) => p.verb.id === 'verb_likhtov' && p.tense === 'present')).toBe(false); // maxPerVerb 2
    expect(picks.every((p) => p.tense !== 'imp')).toBe(true);
    check(s, picks);
  });
  it('mixes carded and new verb-tenses within the limits', () => {
    const now = Date.now();
    const cards: AppState['cards'] = {};
    verbs.slice(0, 40).forEach((v, i) => {
      if (drillable(v, 'past')) cards[`c:${v.id}:past`] = card({ due: now + (i % 3 ? DAY : -DAY), s: 1 + i });
    });
    for (const level of ['A1', 'A2', 'B1', 'C1'] as const) {
      for (let seed = 1; seed <= 10; seed++) {
        const s = fresh({ level, cards });
        const picks = pickVerbTenses(s, 12, { rnd: seeded(seed), maxPerVerb: seed % 2 ? 1 : 2 });
        expect(picks.length).toBe(12);
        check(s, picks, seed % 2 ? 1 : 2);
        if (level !== 'A1') expect(picks.filter((p) => p.cardId && s.cards[p.cardId]).length).toBeGreaterThanOrEqual(8);
      }
    }
  });
  it('never returns rare or undrillable tenses, or a card for the imperative', () => {
    const now = Date.now();
    // due cards on tenses that are not drilled (the present of להיות) and on bogus ids
    const cards: AppState['cards'] = { 'c:verb_nope:past': card({ due: now - DAY }) };
    for (const v of verbs) {
      for (const t of ['present', 'past', 'future'] as const) if (!drillable(v, t)) cards[`c:${v.id}:${t}`] = card({ due: now - 9 * DAY });
      cards[`c:${v.id}:imp`] = card({ due: now - 9 * DAY });
    }
    expect(Object.keys(cards).length).toBeGreaterThan(verbs.length + 1);
    for (const level of ['A1', 'A2', 'B1', 'C1'] as const) {
      for (const dueFirst of [false, true]) {
        for (let seed = 1; seed <= 5; seed++) {
          const s = fresh({ level, cards });
          const picks = pickVerbTenses(s, 30, { dueFirst, rnd: seeded(seed) });
          expect(picks.length).toBe(30);
          for (const p of picks) {
            expect(drillable(p.verb, p.tense), `${p.verb.id}:${p.tense}`).toBe(true);
            expect(p.cardId === null || !p.cardId.endsWith(':imp')).toBe(true);
          }
          check(s, picks);
        }
      }
    }
  });
  it('honours the tense filter', () => {
    const s = fresh({ level: 'B1' });
    const picks = pickVerbTenses(s, 10, { tenses: ['imp'], rnd: seeded(4) });
    expect(picks.length).toBe(10);
    expect(picks.every((p) => p.tense === 'imp' && p.cardId === null)).toBe(true);
    expect(pickVerbTenses(fresh({ level: 'A1' }), 5, { tenses: ['future'] })).toEqual([]);
  });
});

describe('vocabPool', () => {
  it('returns carded words first, then new words at the level, grouped by topic', () => {
    const now = Date.now();
    const cards: AppState['cards'] = {
      [`v:${vocab[0].id}`]: card({ due: now - DAY }),
      [`v:${vocab[1].id}`]: card({ s: 2 }),
      [`v:${vocab[2].id}`]: card({ s: 30, last: now - 9 * DAY }),
    };
    for (let seed = 1; seed <= 10; seed++) {
      const s = fresh({ level: 'A1', cards });
      const pool = vocabPool(s, 15, seeded(seed));
      expect(pool.length).toBe(15);
      expect(new Set(pool.map((x) => x.item.id)).size).toBe(15);
      for (const k of Object.keys(cards)) expect(pool.find((x) => `v:${x.item.id}` === k)?.cardId).toBe(k);
      for (const x of pool) if (!x.cardId) expect(levelOk(x.item.level, s)).toBe(true);
      // each topic forms one run
      const runs = pool.map((x) => x.item.topic).filter((t, i, a) => i === 0 || a[i - 1] !== t);
      expect(new Set(runs).size).toBe(runs.length);
    }
  });
});

describe('medals and badges', () => {
  const v = likhtov;
  const tenses = TENSES.filter((t) => drillable(v, t));
  const cardsWith = (s: number[]) => Object.fromEntries(tenses.map((t, i) => [`c:${v.id}:${t}`, card({ s: s[i] ?? 0.5 })]));
  it('computes medals from FSRS strength only', () => {
    expect(verbMedal(v, {})).toBe(0);
    expect(verbMedal(v, cardsWith([1, 1, 1]))).toBe(0);
    expect(verbMedal(v, cardsWith([5, 1, 1]))).toBe(1);
    expect(verbMedal(v, cardsWith([5, 25, 5]))).toBe(2);
    expect(verbMedal(v, cardsWith([25, 25, 25]))).toBe(3);
  });
});

describe('rounds', () => {
  const snap = (patch: Partial<RoundSnapshot> = {}): RoundSnapshot => ({
    v: 1,
    game: 'snap',
    mode: 'free',
    date: today(),
    startedAt: Date.now() - 60_000,
    savedAt: Date.now(),
    items: Array.from({ length: 12 }, (_, i) => ({ key: `k${i}` })),
    results: Array(12).fill(null),
    missed: [],
    xp: 0,
    combo: 0,
    bestCombo: 0,
    strengthened: 0,
    rated: [],
    misses: [],
    verbIds: [],
    ...patch,
  });
  const done = (n: number, firstTry = n) => Array.from({ length: n }, (_, i) => ({ ok: true, firstTry: i < firstTry }));
  const log = () => getState().days.find((d) => d.date === today())!;

  beforeEach(() => {
    mem.clear();
    fresh();
  });
  afterEach(() => clearRound());

  it('saves, loads and peeks a live round', () => {
    const r = snap({ results: [...done(3), ...Array(9).fill(null)] });
    saveRound(r);
    expect(loadRound('snap', 'free')).toEqual(r);
    expect(loadRound('snap', 'ride')).toBeNull();
    expect(loadRound('sort', 'free')).toBeNull();
    expect(peekRound()).toEqual({ game: 'snap', mode: 'free', answered: 3, total: 12 });
    clearRound();
    expect(loadRound('snap', 'free')).toBeNull();
    expect(peekRound()).toBeNull();
  });
  it('drops stale, finished or broken snapshots', () => {
    saveRound(snap({ date: '2020-01-01' }));
    expect(loadRound('snap', 'free')).toBeNull();
    saveRound(snap({ savedAt: Date.now() - 7 * 3600_000 }));
    expect(loadRound('snap', 'free')).toBeNull();
    saveRound(snap({ results: done(12) }));
    expect(loadRound('snap', 'free')).toBeNull();
    expect(peekRound()).toBeNull();
    saveRound(snap({ mode: 'sprint', timeLeftMs: 0 }));
    expect(loadRound('snap', 'sprint')).toBeNull();
    localStorage.setItem('shoresh-play-round-v1', '{not json');
    expect(loadRound('snap', 'free')).toBeNull();
    expect(peekRound()).toBeNull();
  });
  it('offers no resume before the first answer', () => {
    saveRound(snap());
    expect(loadRound('snap', 'free')).not.toBeNull();
    expect(peekRound()).toBeNull();
  });
  it('keeps one round per game and mode: playing another game never wipes a paused one', () => {
    const ride = snap({ mode: 'ride', results: [...done(4), ...Array(8).fill(null)], savedAt: Date.now() - 60_000 });
    saveRound(ride);
    saveRound(snap({ game: 'gender', items: Array(15).fill({}), results: [...done(1), ...Array(14).fill(null)] }));
    expect(loadRound('snap', 'ride')).toEqual(ride);
    expect(peekRound()).toEqual({ game: 'gender', mode: 'free', answered: 1, total: 15 }); // the latest
    clearRound('gender', 'free');
    expect(loadRound('gender', 'free')).toBeNull();
    expect(peekRound()).toEqual({ game: 'snap', mode: 'ride', answered: 4, total: 12 });
    // at most four are kept, the most recently saved
    for (const [i, game] of (['sort', 'forge', 'match', 'gap'] as GameId[]).entries()) saveRound(snap({ game, savedAt: Date.now() + i, results: [...done(1), ...Array(11).fill(null)] }));
    expect(loadRound('snap', 'ride')).toBeNull();
    expect(loadRound('gap', 'free')).not.toBeNull();
    clearRound();
    expect(peekRound()).toBeNull();
    expect(localStorage.getItem('shoresh-play-round-v1')).toBeNull();
  });
  it('still reads a round saved in the first format (one snapshot)', () => {
    const r = snap({ game: 'forge', mode: 'ride', results: [...done(3), ...Array(9).fill(null)] });
    localStorage.setItem('shoresh-play-round-v1', JSON.stringify(r));
    expect(loadRound('forge', 'ride')).toEqual(r);
    expect(peekRound()).toMatchObject({ game: 'forge', mode: 'ride', answered: 3 });
    saveRound(snap({ results: [...done(1), ...Array(11).fill(null)] }));
    expect(loadRound('forge', 'ride')).toEqual(r);
  });
  it('resumes a round begun last night after midnight (within 6 h) and books it on its own day', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 10, 21, 23, 50));
      const night = dateKey();
      fresh();
      saveRound(snap({ date: night, startedAt: Date.now(), savedAt: Date.now(), results: [...done(11), null] }));
      vi.setSystemTime(new Date(2026, 10, 22, 0, 5));
      expect(today()).not.toBe(night);
      const r = loadRound('snap', 'free');
      expect(r).not.toBeNull();
      const sum = finishRound({ ...r!, results: done(12), xp: 120 });
      const days = getState().days;
      expect(days.find((d) => d.date === night)!.tasks).toEqual(['play:snap']);
      expect(days.find((d) => d.date === today())?.tasks ?? []).toEqual([]);
      expect(days.map((d) => d.date)).toEqual([...days.map((d) => d.date)].sort()); // logs stay in date order
      expect(sum.xp).toBe(120 + XP.round + XP.perfect);
      // two days old is too old, whatever its savedAt says
      saveRound(snap({ date: '2026-11-20', savedAt: Date.now(), results: [...done(1), ...Array(11).fill(null)] }));
      expect(loadRound('snap', 'free')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
  it("a Verb of the Day grid finished after midnight is yesterday's: today's verb isn't done", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 10, 21, 23, 58));
      const night = dateKey();
      fresh();
      setState((s) => {
        s.play.daily = { date: night, verbId: 'verb_likhtov', slots: [], marks: ['g', 'g', 'g', 'g', 'g', ''], tries: [1, 1, 1, 1, 1, 0], rated: [] };
      });
      vi.setSystemTime(new Date(2026, 10, 22, 0, 1));
      finishRound(snap({ game: 'six', date: night, items: [{}], results: done(1), xp: 20 }));
      expect(getState().days.find((d) => d.date === night)!.tasks).toContain('play:six');
      expect(sixStatus(getState())).toMatchObject({ done: false, started: false });
      // ...even if today's log says play:six (e.g. written by an older version)
      setState((s) => {
        s.days.push({ date: today(), reviews: 0, correct: 0, newWords: 0, tasks: ['play:six'] });
      });
      expect(sixStatus(getState()).done).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
  it('a terminus round finished after midnight spends last night\'s terminus, not tomorrow\'s', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 10, 21, 23, 59));
      const night = dateKey();
      fresh();
      setState((s) => {
        s.play.ride = { date: night, plan: ['snap', 'forge'], done: ['snap', 'forge'], terminus: false };
      });
      vi.setSystemTime(new Date(2026, 10, 22, 0, 0, 30));
      finishRound(snap({ game: 'smash', mode: 'terminus', double: true, date: night, items: [{}], results: done(1), xp: 20 }));
      expect(getState().play.ride).toEqual({ date: night, plan: ['snap', 'forge'], done: ['snap', 'forge'], terminus: true });
      expect(getState().days.find((d) => d.date === night)!.stops).toBe(1);
      // a ride stop from last night doesn't create today's ride either
      setState((s) => {
        s.play.ride = null;
      });
      const r = finishRound(snap({ mode: 'ride', date: night, results: done(12), xp: 10 }));
      expect(getState().play.ride).toBeNull();
      expect(r.nextStop).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
  it('counts the rows done before a lost round in the stars (a split Daily Six grid)', () => {
    // rows 0–2 were played in a round since lost: row 0 🟥, rows 1–2 🟩; this round plays rows 3–5 right first try
    const sum = finishRound(snap({ game: 'six', items: [{}, {}, {}], results: done(3), xp: 60, prior: { total: 3, firstTry: 2 } }));
    expect(sum).toMatchObject({ total: 6, firstTry: 5, stars: 2, practised: 3 });
    expect(sum.bonuses.map((b) => b.label)).toEqual(['Round finished']);
    expect(getState().play.badges).not.toContain('perfect');
  });
  it('books only the XP a round has not banked yet', () => {
    setState((s) => {
      s.play.xp = 300; // 130 of it banked by this round's answers
    });
    const sum = finishRound(snap({ results: done(12), xp: 150, banked: 130 }));
    expect(sum.xp).toBe(150 + XP.round + XP.perfect);
    expect(getState().play.xp).toBe(300 + 20 + XP.round + XP.perfect);
    expect(sum.level).toEqual({ before: levelFromXp(170), after: levelFromXp(370) }); // the level-up shows from where the round began
  });
  it('books a terminus round as the terminus only if it started while the ×2 was due', () => {
    setState((s) => {
      s.play.ride = { date: today(), plan: ['snap'], done: ['snap'], terminus: true };
    });
    // opened from a stale link after the terminus was spent: plain free play
    const sum = finishRound(snap({ game: 'smash', mode: 'terminus', double: false, items: [{}], results: done(1), xp: 10 }));
    expect(getState().play.best.smash).toMatchObject({ score: 10 + XP.round + XP.perfect });
    expect(log().stops).toBeUndefined();
    expect(sum.nextStop).toBeNull();
    // opened before the line was finished: no ride is touched or created, no stop counted
    fresh();
    finishRound(snap({ game: 'smash', mode: 'terminus', items: [{}], results: done(1), xp: 10 }));
    expect(getState().play.ride).toBeNull();
    expect(log().stops).toBeUndefined();
    expect(getState().play.plays.smash).toBe(1);
  });

  it('books a free round in one write', () => {
    let writes = 0;
    const off = subscribe(() => writes++);
    const sum = finishRound(snap({ results: done(12), xp: 150, bestCombo: 12, strengthened: 0, misses: ['a', 'b', 'a'] }));
    off();
    expect(writes).toBe(1);
    expect(sum.stars).toBe(3);
    expect(sum.bonuses).toEqual([
      { label: 'Round finished', xp: XP.round },
      { label: '★★★', xp: XP.perfect },
    ]);
    expect(sum.xp).toBe(150 + XP.round + XP.perfect);
    expect(sum.total).toBe(12);
    expect(sum.firstTry).toBe(12);
    expect(sum.practised).toBe(12);
    expect(sum.misses).toEqual(['a', 'b']);
    expect(sum.newBest).toBe(true);
    expect(sum.nextStop).toBeNull();
    expect(sum.goalJustMet).toBe(false);
    expect(sum.level).toEqual({ before: 1, after: 2 });
    const s = getState();
    expect(s.play.xp).toBe(200);
    expect(s.play.best.snap).toMatchObject({ stars: 3, score: 200, combo: 12 });
    expect(s.play.plays.snap).toBe(1);
    expect(log().xp).toBe(200);
    expect(log().tasks).toEqual(['play:snap']);
    expect(log().stops).toBeUndefined();
    expect(s.play.ride).toBeNull();
    expect(sum.badges).toEqual(expect.arrayContaining(['first-stop', 'combo-10', 'perfect']));
    expect(s.play.badges).toEqual(sum.badges);
  });
  it('keeps the best and celebrates badges once', () => {
    finishRound(snap({ results: done(12), xp: 150 }));
    const sum = finishRound(snap({ results: done(12, 6), xp: 60, bestCombo: 3 }));
    expect(sum.stars).toBe(1);
    expect(sum.bonuses.map((b) => b.label)).toEqual(['Round finished']);
    expect(sum.newBest).toBe(false);
    expect(sum.badges).toEqual([]);
    expect(getState().play.best.snap).toMatchObject({ stars: 3, score: 200 });
    expect(getState().play.plays.snap).toBe(2);
    expect(log().tasks).toEqual(['play:snap']);
  });
  it('fills ride stops and pays the line bonus once a day', () => {
    setState((s) => {
      s.play.ride = { date: today(), plan: ['snap', 'forge', 'match'], done: [], terminus: false };
    });
    const r1 = finishRound(snap({ mode: 'ride', results: done(12), xp: 100 }));
    expect(r1.nextStop).toBe('forge');
    expect(r1.goalJustMet).toBe(false);
    expect(getState().play.ride!.done).toEqual(['snap']);
    expect(log().stops).toBe(1);
    finishRound(snap({ game: 'forge', mode: 'ride', items: [{}, {}], results: done(2), xp: 30 }));
    const r3 = finishRound(snap({ game: 'match', mode: 'ride', items: [{}], results: done(1), xp: 10 }));
    expect(r3.goalJustMet).toBe(true);
    expect(r3.nextStop).toBeNull();
    expect(r3.bonuses.map((b) => b.label)).toContain('Line finished');
    expect(log().tasks).toEqual(expect.arrayContaining(['play:snap', 'play:forge', 'play:match', 'ride']));
    expect(log().stops).toBe(3);
    const again = finishRound(snap({ game: 'match', mode: 'ride', items: [{}], results: done(1), xp: 10 }));
    expect(again.goalJustMet).toBe(false);
    expect(again.bonuses.map((b) => b.label)).not.toContain('Line finished');
    const t = finishRound(snap({ game: 'smash', mode: 'terminus', double: true, items: [{}], results: done(1), xp: 20 }));
    expect(t.nextStop).toBeNull();
    expect(t.xp).toBe(20 + XP.round + XP.perfect); // item XP came ×2 already; bonuses are not doubled
    expect(getState().play.best.smash).toMatchObject({ score: 10 + XP.round + XP.perfect }); // bests count plain item XP
    expect(getState().play.ride!.terminus).toBe(true);
    expect(log().stops).toBe(5);
  });
  it("creates today's ride when a stop is finished without one", () => {
    setState((s) => {
      s.play.ride = { date: '2020-01-01', plan: ['snap'], done: ['snap'], terminus: true };
    });
    finishRound(snap({ game: 'forge', mode: 'ride', items: [{}], results: done(1), xp: 15 }));
    const ride = getState().play.ride!;
    expect(ride.date).toBe(today());
    expect(ride.plan.length).toBe(getState().settings.rideStops);
    expect(ride.plan).toContain('forge');
    expect(ride.done).toEqual(['forge']);
    expect(ride.terminus).toBe(false);
  });
  it('scores a sprint by the number right', () => {
    const results = [...Array.from({ length: 20 }, (_, i) => ({ ok: i < 16, firstTry: true })), ...Array(40).fill(null)];
    const sum = finishRound(snap({ game: 'sort', mode: 'sprint', items: Array(60).fill({}), results, xp: 160 }));
    expect(sum.total).toBe(20);
    expect(sum.stars).toBe(2);
    expect(getState().play.best['sort:sprint']).toMatchObject({ score: 16, stars: 2 });
    expect(getState().play.best.sort).toBeUndefined();
    const empty = finishRound(snap({ game: 'sort', mode: 'sprint', items: Array(60).fill({}), results: Array(60).fill(null) }));
    expect(empty.xp).toBe(0);
    expect(getState().play.plays.sort).toBe(1);
  });
  it('celebrates a new medal once', () => {
    const tenses = TENSES.filter((t) => drillable(likhtov, t));
    setState((s) => {
      for (const t of tenses) s.cards[`c:${likhtov.id}:${t}`] = card({ s: 5 });
    });
    const sum = finishRound(snap({ results: done(12), verbIds: [likhtov.id, likhtov.id, 'verb_nope'] }));
    expect(sum.medals).toEqual([{ verbId: likhtov.id, medal: 2 }]);
    expect(getState().play.medals[likhtov.id]).toBe(2);
    expect(finishRound(snap({ results: done(12), verbIds: [likhtov.id] })).medals).toEqual([]);
  });
});

describe('juice and randomness', () => {
  it('is safe without a browser', () => {
    setState((s) => {
      s.settings.sound = true;
      s.settings.gameVoice = true;
    });
    for (const k of ['right', 'wrong', 'combo', 'done', 'tap'] as const) expect(() => sfx(k)).not.toThrow();
    expect(() => primeAudio()).not.toThrow();
    expect(() => say('שלום', 'f')).not.toThrow();
    expect(calm()).toBe(false);
    setState((s) => {
      s.settings.calm = true;
    });
    expect(calm()).toBe(true);
  });
  it('is deterministic when seeded', () => {
    const a = seeded(42);
    const b = seeded(42);
    const xs = Array.from({ length: 50 }, () => a());
    expect(xs).toEqual(Array.from({ length: 50 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(xs).size).toBe(50);
    expect(hashSeed('2026-11-22')).toBe(hashSeed('2026-11-22'));
    expect(hashSeed('2026-11-22')).not.toBe(hashSeed('2026-11-23'));
    expect(daySeed('2026-11-22')).toBe(hashSeed('2026-11-22'));
    expect(daySeed()).toBe(hashSeed(today()));
  });
  it('shuffles and samples without losing or repeating items', () => {
    const xs = Array.from({ length: 30 }, (_, i) => i);
    const sh = shuffle(xs, seeded(1));
    expect([...sh].sort((p, q) => p - q)).toEqual(xs);
    expect(sh).not.toEqual(xs);
    expect(xs[0]).toBe(0);
    expect(shuffle(xs, seeded(1))).toEqual(sh);
    const sm = sample(xs, 7, seeded(5));
    expect(sm.length).toBe(7);
    expect(new Set(sm).size).toBe(7);
    expect(sample(xs, 99).length).toBe(30);
    expect(sample([], 3)).toEqual([]);
  });
});

describe('round machine (useRound without Preact)', () => {
  type It = { key: string };
  let builds = 0;
  const make = (o: { game?: GameId; mode?: GameMode; tier?: 'tap' | 'build' | 'typed'; n?: number; sprintSec?: number } = {}) =>
    createRound<It>(
      {
        game: o.game ?? 'snap',
        mode: o.mode ?? 'free',
        tier: o.tier ?? 'tap',
        sprintSec: o.sprintSec,
        build: () => {
          builds++;
          return Array.from({ length: o.n ?? 4 }, (_, i) => ({ key: `k${i}` }));
        },
      },
      () => {},
    );
  const stored = (game: GameId = 'snap', mode: GameMode = 'free') => loadRound<It>(game, mode);
  const id = 'c:verb_likhtov:past';
  const build = (ok = true): Evidence => ({ tier: 'build', ok, skill: 'verbs', cardId: id });

  beforeEach(() => {
    vi.useFakeTimers();
    mem.clear();
    fresh();
    builds = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
    clearRound();
  });

  it('moves on 450 ms after a right answer and pays the combo after each answer', () => {
    const m = make({ n: 12 });
    expect(builds).toBe(1);
    let xp = 0;
    for (let i = 0; i < 11; i++) {
      expect(m.view().index).toBe(i);
      expect(m.view().item).toEqual({ key: `k${i}` });
      xp += m.view().answer({ ok: true });
      // the reveal keeps the item on screen
      expect(m.view()).toMatchObject({ status: true, index: i, answered: i + 1, combo: i + 1, lastGain: itemXp('tap', i + 1) });
      vi.advanceTimersByTime(449);
      expect(m.view().status).toBe(true);
      vi.advanceTimersByTime(1);
      expect(m.view().status).toBeNull();
    }
    expect(xp).toBe(Array.from({ length: 11 }, (_, i) => itemXp('tap', i + 1)).reduce((a, b) => a + b));
    expect(m.view().xp).toBe(xp);
    // saved after every answer
    expect(stored()!.results.filter(Boolean).length).toBe(11);
    expect(stored()!.xp).toBe(xp);
  });
  it("gives a right answer with a note ('read') 1.8 s on screen, and a wrong one still holds", () => {
    const m = make();
    m.view().answer({ ok: true }, 'read');
    vi.advanceTimersByTime(1799);
    expect(m.view()).toMatchObject({ status: true, index: 0 });
    vi.advanceTimersByTime(1);
    expect(m.view()).toMatchObject({ status: null, index: 1 });
    m.view().answer({ ok: false }, 'read');
    vi.advanceTimersByTime(5000);
    expect(m.view()).toMatchObject({ status: false, index: 1, shell: { hold: true, ready: true } });
  });
  it('holds a wrong answer on Continue, taking taps after 400 ms', () => {
    const m = make();
    m.view().answer({ ok: true }, 'now');
    m.view().answer({ ok: true }, 'now');
    expect(m.view().combo).toBe(2);
    expect(m.view().answer({ ok: false, miss: 'אני · עבר → כתבתי' })).toBe(0);
    expect(m.view()).toMatchObject({ status: false, index: 2, combo: 0, shell: { hold: true, ready: false } });
    vi.advanceTimersByTime(399);
    expect(m.view().shell!.ready).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(m.view()).toMatchObject({ status: false, index: 2, shell: { hold: true, ready: true } });
    m.view().next();
    expect(m.view()).toMatchObject({ status: null, index: 3, shell: { hold: false } });
    expect(stored()!.misses).toEqual(['אני · עבר → כתבתי']);
    // 'hold' shows Continue after a right answer too
    m.view().answer({ ok: true }, 'hold');
    expect(m.view().shell).toMatchObject({ hold: true });
  });
  it('counts an answer after a miss as not first try', () => {
    const m = make();
    m.view().answer({ ok: true }, 'now');
    m.view().miss([{ tier: 'tap', ok: false, skill: 'verbs' }]);
    expect(m.view().combo).toBe(0);
    expect(m.view().shell!.misses).toBe(1);
    expect(stored()!.missed).toEqual([1]);
    expect(m.view().answer({ ok: true, miss: 'כתבת' }, 'now')).toBe(XP.tap);
    expect(m.view().combo).toBe(0);
    expect(stored()!.results[1]).toEqual({ ok: true, firstTry: false });
    expect(stored()!.misses).toEqual(['כתבת']);
    // firstTry can be given explicitly (a second try in a typed mode)
    m.view().answer({ ok: true, firstTry: false, xpScale: 0.5, xpTier: 'typed' }, 'now');
    expect(stored()!.results[2]).toEqual({ ok: true, firstTry: false });
    // a label on a right first-try answer is not a miss
    m.view().answer({ ok: true, miss: 'nope' }, 'now');
    expect(m.view().summary!.misses).toEqual(['כתבת']);
  });
  it('answers by index in any order (Match)', () => {
    const m = make({ game: 'match', n: 3 });
    m.view().miss(undefined, 2);
    m.view().answer({ ok: true, index: 2 }, 'now');
    expect(m.view().index).toBe(0);
    expect(stored('match')!.results).toEqual([null, null, { ok: true, firstTry: false }]);
    m.view().answer({ ok: true, index: 0 }, 'now');
    expect(m.view().index).toBe(1);
    expect(m.view().answer({ ok: true, index: 0 }, 'now')).toBe(0); // already answered
    expect(m.view().answer({ ok: true, index: 7 }, 'now')).toBe(0); // no such item
  });
  it('books the round exactly once, then shows the result after the last reveal', () => {
    const m = make({ n: 3 });
    m.view().answer({ ok: true }, 'now');
    m.view().answer({ ok: false }, 'now');
    let writes = 0;
    const off = subscribe(() => writes++);
    m.view().answer({ ok: true });
    off();
    expect(writes).toBe(1);
    expect(getState().play.plays.snap).toBe(1);
    expect(stored()).toBeNull();
    expect(m.view().summary).toBeNull(); // the last reveal is still up
    expect(m.view().item).toEqual({ key: 'k2' });
    // nothing books it again
    expect(m.view().answer({ ok: true }, 'now')).toBe(0);
    m.view().miss();
    m.view().next();
    m.view().next();
    vi.advanceTimersByTime(1000);
    const sum = m.view().summary!;
    expect(sum).toMatchObject({ total: 3, firstTry: 2, stars: 1, practised: 3, bestCombo: 1 });
    expect(m.view().item).toBeNull();
    expect(getState().play.plays.snap).toBe(1);
    expect(getState().play.xp).toBe(sum.xp);
    expect(sum.xp).toBe(XP.tap * 2 + XP.round);
    expect(m.timed()).toBe(false);
  });
  it("shows the result at once after a 'now' last answer", () => {
    const m = make({ n: 1 });
    m.view().answer({ ok: true }, 'now');
    expect(m.view().summary).toMatchObject({ stars: 3, total: 1 });
  });
  it('resumes index, results, combo, XP and the rated set after a reload', () => {
    const now = Date.now();
    fresh({ cards: { [id]: card({ due: now - 1000 }) } });
    const m = make({ game: 'forge', tier: 'build', n: 6 });
    m.view().answer({ ok: true, evidence: [build()] }, 'now');
    m.view().answer({ ok: true }, 'now');
    m.view().answer({ ok: true }, 'now');
    const xp = m.view().xp;
    expect(getState().cards[id].reps).toBe(4);
    m.dispose();
    expect(peekRound()).toEqual({ game: 'forge', mode: 'free', answered: 3, total: 6 });
    // another mode of the same game starts fresh
    expect(make({ game: 'forge', mode: 'ride', tier: 'build', n: 6 }).view().resumed).toBe(false);
    expect(builds).toBe(2);
    const r = make({ game: 'forge', tier: 'build', n: 6 });
    expect(builds).toBe(2); // resumed, not rebuilt
    expect(r.view()).toMatchObject({ resumed: true, index: 3, answered: 3, combo: 3, bestCombo: 3, xp });
    expect(r.view().rated.has(id)).toBe(true);
    // the card was reviewed in this round already: no second review, even when due again
    setState((s) => {
      s.cards[id].due = Date.now() - 1;
    });
    r.view().answer({ ok: true, evidence: [build()] }, 'now');
    expect(getState().cards[id].reps).toBe(4);
    expect(r.view().combo).toBe(4);
    r.view().answer({ ok: true }, 'now');
    r.view().answer({ ok: true }, 'now');
    expect(r.view().summary).toMatchObject({ strengthened: 1, practised: 6 });
    expect(getState().days.find((d) => d.date === today())!.reviews).toBe(1);
  });
  it('never saves an untouched round and leaves the stored one alone', () => {
    const a = make();
    a.view().answer({ ok: true }, 'now');
    const b = make({ game: 'sort', mode: 'sprint', sprintSec: 60, n: 60 });
    expect(builds).toBe(2);
    b.dispose();
    expect(stored()).not.toBeNull();
    b.clock(Date.now(), false);
    b.clock(Date.now() + 61_000, false);
    expect(b.view().summary).toMatchObject({ total: 0, xp: 0 });
    expect(getState().play.plays.sort).toBeUndefined();
    expect(stored()).not.toBeNull(); // Snap can still be resumed
    const c = make({ game: 'gap' });
    c.view().restart();
    expect(stored()).not.toBeNull();
  });
  it('runs the sprint clock only while visible and keeps the time left', () => {
    const m = make({ game: 'sort', mode: 'sprint', sprintSec: 60, n: 60 });
    let t = Date.now();
    expect(m.timed()).toBe(true);
    expect(m.view().timeLeft).toBe(60);
    m.clock(t, false); // starts the clock
    m.clock((t += 10_000), false);
    expect(m.view().timeLeft).toBe(50);
    m.view().answer({ ok: true }, 'now');
    m.hide();
    m.clock((t += 120_000), true);
    m.clock((t += 1000), false); // back: the first tick only restarts the clock
    expect(m.view().timeLeft).toBe(50);
    m.clock((t += 5000), false);
    expect(m.view().timeLeft).toBe(45);
    // a tick that finds the page hidden (before any visibilitychange) pauses too
    m.clock((t += 30_000), true);
    m.clock((t += 1000), false);
    expect(m.view().timeLeft).toBe(45);
    m.dispose();
    expect(stored('sort', 'sprint')!.timeLeftMs).toBe(45_000);
    const r = make({ game: 'sort', mode: 'sprint', sprintSec: 60, n: 60 });
    expect(r.view()).toMatchObject({ resumed: true, timeLeft: 45, answered: 1 });
    r.clock(t, false);
    r.view().answer({ ok: false }); // time runs out mid-reveal
    r.clock((t += 45_000), false);
    const sum = r.view().summary!;
    expect(sum).toMatchObject({ total: 2, firstTry: 1, mode: 'sprint' });
    expect(r.view()).toMatchObject({ status: null, timeLeft: 0, shell: { hold: false } });
    expect(getState().play.best['sort:sprint']).toMatchObject({ score: 1 });
    expect(stored('sort', 'sprint')).toBeNull();
    expect(r.timed()).toBe(false);
    r.clock(t + 5000, false);
    r.view().answer({ ok: true }, 'now');
    expect(getState().play.plays.sort).toBe(1);
  });
  it('pays ×2 only in an open terminus', () => {
    setState((s) => {
      s.play.ride = { date: today(), plan: ['snap', 'forge'], done: ['snap'], terminus: false };
    });
    expect(make({ game: 'smash', mode: 'terminus' }).view().answer({ ok: true }, 'now')).toBe(XP.tap); // line not finished
    clearRound();
    setState((s) => {
      s.play.ride!.done.push('forge');
    });
    const m = make({ game: 'smash', mode: 'terminus', n: 2 });
    expect(m.view().shell!.double).toBe(true);
    expect(m.view().answer({ ok: true }, 'now')).toBe(2 * XP.tap);
    m.view().answer({ ok: true }, 'now');
    expect(getState().play.ride!.terminus).toBe(true);
    const again = make({ game: 'smash', mode: 'terminus' });
    expect(again.view().shell!.double).toBe(false);
    expect(again.view().answer({ ok: true }, 'now')).toBe(XP.tap);
  });
  it("one answer in another game leaves a paused ride stop, and the XP it showed, alone", () => {
    const stop = make({ game: 'snap', mode: 'ride', n: 12 });
    for (let i = 0; i < 4; i++) stop.view().answer({ ok: true }, 'now');
    const xp = stop.view().xp;
    expect(getState().play.xp).toBe(xp); // banked as earned
    expect(getState().days.find((d) => d.date === today())!.xp).toBe(xp);
    stop.dispose();
    make({ game: 'gender', n: 15 }).view().answer({ ok: true }, 'now');
    make({ game: 'six', mode: 'free', tier: 'typed', n: 6 }).view().answer({ ok: false }, 'now');
    const again = make({ game: 'snap', mode: 'ride', n: 12 });
    expect(again.view()).toMatchObject({ resumed: true, answered: 4, xp });
    expect(getState().play.xp).toBe(xp + XP.tap); // the gender answer, banked too; nothing lost
    // finishing books only the rest: lifetime XP ends at exactly the round's total
    for (let i = 0; i < 8; i++) again.view().answer({ ok: true }, 'now');
    const sum = again.view().summary!;
    expect(getState().play.xp).toBe(sum.xp + XP.tap);
    expect(sum.xp).toBe(again.view().xp + sum.bonuses.reduce((a, b) => a + b.xp, 0));
  });
  it('banks XP and evidence in one write per answer', () => {
    fresh({ cards: { [id]: card({ due: Date.now() - 1000 }) } });
    const m = make({ game: 'forge', tier: 'build', n: 3 });
    let writes = 0;
    const off = subscribe(() => writes++);
    m.view().answer({ ok: true, evidence: [build()] }, 'now');
    expect(writes).toBe(1);
    m.view().answer({ ok: false }, 'now'); // no XP, no evidence: no write
    expect(writes).toBe(1);
    off();
    expect(getState().play.xp).toBe(XP.build);
    // an abandoned round keeps what it earned
    m.dispose();
    expect(getState().play.xp).toBe(XP.build);
  });
  it('keeps a terminus round\'s ×2 with the round, so finishing it or a reload can\'t change it', () => {
    setState((s) => {
      s.play.ride = { date: today(), plan: ['snap'], done: ['snap'], terminus: false };
    });
    const m = make({ game: 'smash', mode: 'terminus', n: 3 });
    expect(m.view().answer({ ok: true }, 'now')).toBe(2 * XP.tap);
    m.dispose();
    expect(stored('smash', 'terminus')!.double).toBe(true);
    // a resumed round keeps its ×2
    const r = make({ game: 'smash', mode: 'terminus', n: 3 });
    expect(r.view()).toMatchObject({ resumed: true, shell: { double: true } });
    r.view().answer({ ok: true }, 'now');
    r.view().answer({ ok: true }, 'now');
    expect(getState().play.ride!.terminus).toBe(true);
    expect(getState().days.find((d) => d.date === today())!.stops).toBe(1);
    // the next terminus round (Back, a stale link) is free play: full best, no stop
    const later = make({ game: 'smash', mode: 'terminus', n: 1 });
    expect(later.view().shell!.double).toBe(false);
    later.view().answer({ ok: true }, 'now');
    expect(getState().days.find((d) => d.date === today())!.stops).toBe(1);
    expect(later.view().summary).toMatchObject({ xp: XP.tap + XP.round + XP.perfect, mode: 'terminus' });
  });
  it('restarts with a fresh build', () => {
    const m = make();
    m.view().answer({ ok: true }, 'now');
    m.view().restart();
    expect(builds).toBe(2);
    expect(m.view()).toMatchObject({ answered: 0, xp: 0, combo: 0, resumed: false });
    expect(stored()).toBeNull();
  });
  it('checks the verbs it touched for medals', () => {
    setState((s) => {
      for (const t of TENSES.filter((x) => drillable(likhtov, x))) s.cards[`c:${likhtov.id}:${t}`] = card({ s: 5 });
    });
    const m = make({ n: 2 });
    m.view().answer({ ok: true, evidence: [{ tier: 'tap', ok: true, skill: 'verbs', cardId: id }] }, 'now');
    m.view().answer({ ok: true, verbId: 'verb_nope' }, 'now');
    expect(m.view().summary!.medals).toEqual([{ verbId: likhtov.id, medal: 2 }]);
  });
  it('draws no confetti in calm mode', () => {
    expect(Burst()).not.toBeNull();
    setState((s) => {
      s.settings.calm = true;
    });
    expect(Burst()).toBeNull();
  });
});

// planRide is the hub's (src/games/ride.ts); checked here once it exists.
const ride = Object.values(import.meta.glob<{ planRide?: (s: AppState, date?: string) => GameId[] }>('../src/games/ride.ts', { eager: true }))[0];
describe.skipIf(!ride?.planRide)('planRide', () => {
  it('plans distinct stops with Verb Forge, sized by settings', () => {
    for (const level of ['A1', 'A2', 'B1', 'C1'] as const) {
      for (const stops of [2, 3, 4]) {
        for (const verbsOnly of [false, true]) {
          for (let d = 1; d <= 28; d++) {
            const s = fresh({ level, settings: { ...defaultState().settings, rideStops: stops, verbsOnly } });
            const plan = ride!.planRide!(s, `2026-11-${String(d).padStart(2, '0')}`);
            const where = `${level} ${stops} ${verbsOnly} ${d}: ${plan.join(',')}`;
            expect(new Set(plan).size, where).toBe(plan.length);
            expect(plan, where).toContain('forge');
            expect(plan.length, where).toBe(stops);
            expect(plan, where).not.toContain('echo');
            if (level === 'A1') expect(plan, where).not.toContain('sort');
          }
        }
      }
    }
  });
});

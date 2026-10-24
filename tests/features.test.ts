import { describe, expect, it } from 'vitest';
import { matchesFind } from '../src/components/exercises.tsx';
import { LEVELS } from '../src/content/types.ts';
import { emails, grammar, levelRank, lookup, readings, scenes, verbById, verbs } from '../src/lib/content.ts';
import { UNITS, unitSteps } from '../src/lib/course.ts';
import { allDecks, deckById, deckQueue } from '../src/lib/decks.ts';
import { allSentences, sentencesAt } from '../src/lib/listening.ts';
import { drillable, makeVerbTask, TENSES } from '../src/lib/session.ts';
import { getState, importState } from '../src/lib/store.ts';
import { analyses, asKind, blankForm, contextSentence, personChoices } from '../src/lib/verbdrill.ts';
import { levelFromBands } from '../src/screens/assessment.tsx';
import { distinctPrefix } from '../src/screens/session-words.tsx';

describe('verb recognition', () => {
  const write = verbById.get('verb_likhtov')!;
  it('finds every reading of an ambiguous form', () => {
    expect(analyses(write, 'כתבת')).toEqual([
      { tense: 'past', person: '2ms' },
      { tense: 'past', person: '2fs' },
    ]);
    const fut = analyses(write, 'תכתוב').map((a) => `${a.tense}:${a.person}`);
    expect(fut).toEqual(expect.arrayContaining(['future:2ms', 'future:3fs']));
  });
  it('offers a button for every person of a tense', () => {
    expect(personChoices('past').map(([k]) => k)).toEqual(Object.keys(write.past));
    expect(personChoices('present').map(([k]) => k)).toEqual(['ms', 'fs', 'mp', 'fp']);
  });
  it('builds context sentences that contain the form being tested', () => {
    for (const v of verbs) {
      for (const t of TENSES.filter((x) => drillable(v, x))) {
        const s = contextSentence(makeVerbTask(v, t));
        expect(s.gap.includes('___') && s.gap.replace('___', s.form) === s.he, `${v.inf} ${t}: ${s.he}`).toBe(true);
        expect(analyses(v, s.form).some((a) => a.tense === t), `${v.inf} ${t}: ${s.form}`).toBe(true);
      }
    }
  });
  it('blanks whole words only', () => {
    expect(blankForm('במקום הזה קם בבוקר', 'קם')).toBe('במקום הזה ___ בבוקר');
    expect(blankForm('אמרתי שקם מוקדם', 'קם')).toBe('אמרתי ש___ מוקדם');
    expect(blankForm('אין פה', 'קם')).toBeNull();
    expect(blankForm('כשקם הבוקר', 'קם')).toBe('כש___ הבוקר');
    // an infinitive is not ל + a past form
    expect(blankForm('אתה יכול להסביר לי?', 'הסביר')).toBeNull();
  });
  it('grades a sentence task against the form the sentence needs', () => {
    for (const v of verbs) {
      for (const t of TENSES.filter((x) => drillable(v, x))) {
        for (let i = 0; i < 5; i++) {
          const task = asKind(makeVerbTask(v, t), 'context');
          expect(task.answer[0], `${v.inf} ${t}: ${task.sentence!.he}`).toBe(task.sentence!.form);
        }
      }
    }
  });
  it('offers no separate future button for אתן', () => {
    expect(personChoices('future').map(([k]) => k)).toEqual(Object.keys(verbById.get('verb_likhtov')!.future));
  });
  it('turns a conjugation task into other kinds', () => {
    const t = makeVerbTask(write, 'future');
    expect(asKind(t, 'identify').shown).toEqual(t.answer);
    expect(asKind(t, 'context').sentence?.form).toBeTruthy();
  });
});

describe('decks', () => {
  it('has the alphabet with all 27 letters', () => {
    expect(deckById('alpha')!.cards()).toHaveLength(27);
  });
  it('has a deck per topic, per word level and verb decks by binyan', () => {
    const ids = allDecks().map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(['t:food', 'l:B1', 'v:paal', 'v:piel', 'v:hifil', 'v:essential', 'my:starred']));
    for (const d of allDecks()) if (!d.id.startsWith('my:')) expect(d.cards().length, d.id).toBeGreaterThan(0);
  });
  it('puts the irregular verbs in the weak-verbs deck', () => {
    const ids = deckById('v:weak')!.cards().map((c) => c.verb!.id);
    expect(ids).toEqual(expect.arrayContaining(['verb_lalekhet', 'verb_latet']));
  });
  it('never shows a rare tense as a key form', () => {
    for (const c of deckById('v:essential')!.cards()) {
      if (c.verb!.rare?.includes('present')) expect(c.forms!.some(([l]) => l.includes('הווה'))).toBe(false);
    }
  });
  it('queues due cards first and caps new ones', () => {
    const deck = deckById('alpha')!;
    expect(deckQueue(deck, 5)).toHaveLength(5);
  });
});

describe('course', () => {
  it('has unique unit ids and levels in order', () => {
    expect(new Set(UNITS.map((u) => u.id)).size).toBe(UNITS.length);
    for (let i = 1; i < UNITS.length; i++) expect(levelRank(UNITS[i].level)).toBeGreaterThanOrEqual(levelRank(UNITS[i - 1].level));
  });
  it('every unit references content that exists', () => {
    const missing: string[] = [];
    for (const u of UNITS) {
      for (const id of u.grammar) if (!grammar.some((g) => g.id === id)) missing.push(`${u.id}: ${id}`);
      for (const id of u.read) if (!readings.some((r) => r.id === id)) missing.push(`${u.id}: ${id}`);
      for (const id of u.listen) if (!scenes.some((s) => s.id === id)) missing.push(`${u.id}: ${id}`);
      for (const id of u.verbs) if (!verbById.has(id)) missing.push(`${u.id}: ${id}`);
      if (u.write && !emails.some((e) => e.id === u.write)) missing.push(`${u.id}: ${u.write}`);
      if (u.deck && !deckById(u.deck)) missing.push(`${u.id}: deck ${u.deck}`);
    }
    expect(missing).toEqual([]);
  });
  it('every unit has something to study, and a check whenever there is something to check', () => {
    UNITS.forEach((u, n) => {
      const steps = unitSteps(u, n);
      expect(steps.length, u.id).toBeGreaterThan(2);
      const checkable = u.grammar.some((id) => grammar.find((g) => g.id === id)?.drills.length) || u.verbs.some((id) => verbById.has(id));
      expect(steps[steps.length - 1].kind === 'check', u.id).toBe(checkable);
    });
  });
});

describe('saved progress from the first course', () => {
  it('moves unit progress to unit ids and shifts the current unit', () => {
    importState(
      JSON.stringify({
        version: 1,
        onboarded: true,
        cards: {},
        done: { 'unit:0:check': { at: 1, score: 0.9 }, 'unit:5:verbs': { at: 1, score: 1 }, r_b1_dugri: { at: 1, score: 1 } },
        days: [{ date: '2026-10-20', reviews: 1, correct: 1, newWords: 0, tasks: ['unit:0:check', 'words'] }],
        courseUnit: 2,
      }),
    );
    const s = getState();
    expect(Object.keys(s.done).sort()).toEqual(['r_b1_dugri', 'unit:u_hifil:verbs', 'unit:u_roots_present:check']);
    expect(s.days[0].tasks).toEqual(['unit:u_roots_present:check', 'words']);
    expect(UNITS[s.courseUnit].id).toBe('u_describing');
    expect(s.courseVersion).toBe(2);
  });
});

describe('dictionary', () => {
  it('a real verb form beats a prefix reading', () => {
    expect(lookup('שמים').entries[0].verbId).toBe('verb_lasim');
  });
});

describe('find the word', () => {
  it('accepts the form with or without a one-letter prefix', () => {
    expect(matchesFind('בבית', ['בבית'])).toBe(true);
    expect(matchesFind('ובבית', ['בבית'])).toBe(true);
    expect(matchesFind('בית', ['בבית', 'בית'])).toBe(true);
    // root letters are not prefixes: מחשב is not ב + חשב
    expect(matchesFind('חשב', ['מחשב'])).toBe(false);
    expect(matchesFind('ספר', ['בבית'])).toBe(false);
    expect(matchesFind('', ['בבית'])).toBe(false);
  });
});

describe('listening practice', () => {
  it('has sentences at every level', () => {
    for (const l of LEVELS) expect(sentencesAt(l).length, l).toBeGreaterThan(5);
  });
  it('never offers a sentence above the chosen level', () => {
    for (const l of LEVELS) for (const s of sentencesAt(l)) expect(levelRank(s.level)).toBeLessThanOrEqual(levelRank(l));
    expect(new Set(allSentences().map((s) => s.he)).size).toBe(allSentences().length);
  });
});

describe('placement', () => {
  it('maps band accuracy to A1–C1', () => {
    expect(levelFromBands([0.2, null, null, null])).toBe('A1');
    expect(levelFromBands([0.6, 0.3, null, null])).toBe('A2');
    expect(levelFromBands([0.9, 0.5, 0.1, null])).toBe('A2+');
    expect(levelFromBands([1, 0.9, 0.2, 0])).toBe('B1');
    expect(levelFromBands([1, 0.9, 0.6, 0])).toBe('B1+');
    expect(levelFromBands([1, 1, 0.9, 0.3])).toBe('B2');
    expect(levelFromBands([1, 1, 0.9, 0.8])).toBe('C1');
  });
});

describe('ambiguous English prompts', () => {
  it('hints with enough letters to tell the words apart', () => {
    expect(distinctPrefix('מעסיק', ['מעביד'])).toBe('מעס');
    expect(distinctPrefix('פה', ['כאן'])).toBe('פ');
  });
});

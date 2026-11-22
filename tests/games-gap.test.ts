import { describe, expect, it } from 'vitest';
import type { Level } from '../src/content/types.ts';
import {
  acceptedOf,
  agreesWithSubject,
  answerVerb,
  buildGapItems,
  cuePronouns,
  flagGap,
  gapItemFor,
  gapLessons,
  gapSubjects,
  lessonDistractors,
} from '../src/games/gap.tsx';
import { levelOk, sameForm, seeded } from '../src/games/kit.ts';
import { grammar } from '../src/lib/content.ts';
import { lenient } from '../src/lib/hebrew.ts';
import { type AppState, defaultState, getState, restoreState } from '../src/lib/store.ts';
import { analyses } from '../src/lib/verbdrill.ts';

const LEVELS: Level[] = ['A1', 'A2', 'B1', 'C1'];
const lesson = (id: string) => grammar.find((g) => g.id === id)!;
const drillOf = (key: string) => {
  const [id, i] = key.split('#');
  return lesson(id).drills[Number(i)];
};

function stateAt(level: Level, extra: Partial<AppState> = {}): AppState {
  restoreState({ ...defaultState(), onboarded: true, level, ...extra });
  return getState();
}

describe('Gap Dash items: every drill', () => {
  it('has 3 options, exactly one of them accepted, over all 571 drills and several seeds', () => {
    let drills = 0;
    let skipped = 0;
    let verbItems = 0;
    for (const g of grammar) {
      g.drills.forEach((d, i) => {
        drills++;
        const accepted = acceptedOf(d);
        for (const seed of [1, 2, 3, 4, 5]) {
          const it = gapItemFor(g, i, seeded(seed * 1000 + drills));
          if (!it) {
            if (seed === 1) skipped++;
            continue;
          }
          expect(it.key).toBe(`${g.id}#${i}`);
          expect(it.options).toHaveLength(3);
          const right = it.options.filter((o) => accepted.some((a) => sameForm(a, o)));
          expect(right, `${it.key} ${it.options.join(' · ')}`).toEqual([it.answer]);
          expect(sameForm(it.answer, d.answer[0])).toBe(true);
          expect(new Set(it.options.map(lenient)).size).toBe(3);
          for (const o of it.options) expect(o.trim().length).toBeGreaterThan(0);
          if (it.verb && seed === 1) verbItems++;
          expect(JSON.parse(JSON.stringify(it))).toEqual(it);
        }
      });
    }
    expect(drills).toBe(571);
    // eslint-disable-next-line no-console
    console.log(`Gap Dash sweep: ${drills} drills, ${skipped} skipped, ${verbItems} with verb distractors`);
    expect(skipped).toBe(0);
    expect(verbItems).toBeGreaterThan(130);
  });

  it('never offers a verb form that could agree with the subject, in any tense', () => {
    for (const g of grammar) {
      g.drills.forEach((d, i) => {
        const hit = answerVerb(d, g.id);
        if (!hit) return;
        const subjects = gapSubjects(hit.verb, hit.form, d.prompt);
        expect(subjects.size, `${g.id}#${i}`).toBeGreaterThan(0);
        for (const seed of [1, 2, 3]) {
          const it = gapItemFor(g, i, seeded(seed + i))!;
          for (const o of it.options.filter((x) => x !== it.answer)) {
            const bare = hit.prefix && o.startsWith(hit.prefix) ? o.slice(hit.prefix.length) : o;
            if (!analyses(hit.verb, bare).length) continue;
            expect(agreesWithSubject(hit.verb, bare, subjects), `${g.id}#${i}: ${o} for ${it.answer}`).toBe(false);
          }
        }
      });
    }
  });

  it('keeps synonyms out: answers sharing an accepted variant are never distractors', () => {
    for (const g of grammar) {
      g.drills.forEach((d, i) => {
        const mine = new Set(acceptedOf(d).map(lenient));
        for (const x of lessonDistractors(g, i, seeded(i))) {
          const j = g.drills.findIndex((o) => sameForm(o.answer[0], x));
          expect(j).toBeGreaterThanOrEqual(0);
          expect(acceptedOf(g.drills[j]).some((a) => mine.has(lenient(a))), `${g.id}#${i}: ${x}`).toBe(false);
        }
      });
    }
  });
});

describe('Gap Dash: hard cases', () => {
  it('present forms with no time word never offer the past or future of the same person', () => {
    // האורחים ___ בשבע וחצי (לבוא): באו and יבואו would be right too.
    const g = lesson('g_a1_present');
    const i = g.drills.findIndex((d) => d.answer[0] === 'באים');
    for (let seed = 1; seed <= 40; seed++) {
      const it = gapItemFor(g, i, seeded(seed))!;
      expect(it.verb?.verbId).toBe('verb_lavo');
      expect(it.options.some((o) => ['באו', 'יבואו', 'באים'].includes(o) && o !== it.answer)).toBe(false);
    }
  });

  it('the object marker את is not read as the subject את', () => {
    // אם כבר ___ את החשבונית (לשלוח — you, m): תשלח would be right too.
    const g = lesson('g_conditionals');
    const i = g.drills.findIndex((d) => d.answer[0] === 'שלחת');
    expect(cuePronouns(g.drills[i].prompt)).toEqual([]);
    for (let seed = 1; seed <= 40; seed++) {
      const it = gapItemFor(g, i, seeded(seed))!;
      expect(it.options.filter((o) => ['תשלח', 'שלח', 'תשלחי', 'שלחי'].includes(o))).toEqual([]);
    }
  });

  it('a cue pronoun names the subject', () => {
    const d = lesson('g_a2_past_paal').drills.find((x) => x.answer[0] === 'ראית')!;
    expect(cuePronouns(d.prompt)).toEqual(['אתה']);
    const hit = answerVerb(d)!;
    expect([...gapSubjects(hit.verb, hit.form, d.prompt)].sort()).toEqual(['אתה']);
  });

  it('answers that only look like verb forms are not treated as verbs', () => {
    for (const [id, answer] of [
      ['g_a1_pronouns', 'אתן'],
      ['g_a1_gender_plural', 'נשים'],
      ['g_a1_gender_plural', 'ישנים'],
      ['g_a1_yesh_ein_shel', 'לך'],
      ['g_c1_construct_advanced', 'ספרנו'],
      ['g_c1_pual_hufal', 'הוצא'],
      ['g_c1_pual_hufal', 'מוכר'],
      ['g_verbal_nouns', 'הצעת'],
      ['g_relative_she', 'שבו'],
    ] as const) {
      const d = lesson(id).drills.find((x) => x.answer[0] === answer)!;
      expect(d, `${id} ${answer}`).toBeTruthy();
      expect(answerVerb(d, id), `${id} ${answer}`).toBeNull();
    }
  });

  it('picks the verb the prompt names when two verbs share the spelling', () => {
    const learn = lesson('g_a2_future_paal').drills.find((x) => x.answer[0] === 'אלמד')!;
    expect(answerVerb(learn)?.verb.id).toBe('verb_lilmod');
    const finish = lesson('g_a2_future_paal').drills.find((x) => x.answer[0] === 'יגמרו')!;
    expect(answerVerb(finish)?.verb.id).toBe('verb_ligmor');
    const seem = lesson('g_c1_hedging').drills.find((x) => x.answer[0] === 'נראה')!;
    expect(answerVerb(seem)?.verb.id).toBe('verb_leheraot');
  });

  it('a negated answer gets negated distractors', () => {
    const g = lesson('g_a1_present');
    const i = g.drills.findIndex((d) => d.answer[0] === 'לא שותה');
    const it = gapItemFor(g, i, seeded(3))!;
    expect(it.verb?.verbId).toBe('verb_lishtot');
    for (const o of it.options) expect(o.startsWith('לא ')).toBe(true);
  });

  it('a letter gap gets letters', () => {
    const g = lesson('g_alphabet');
    for (let seed = 1; seed <= 20; seed++) {
      const it = gapItemFor(g, 0, seeded(seed))!;
      for (const o of it.options) expect(o.length).toBe(1);
    }
  });

  it('takes the tense from the cue, the lesson or a time word', () => {
    expect(answerVerb(lesson('g_nifal').drills.find((x) => x.answer[0] === 'נשאר')!, 'g_nifal')?.tense).toBe('past');
    expect(answerVerb(lesson('g_a1_present').drills.find((x) => x.answer[0] === 'גר')!, 'g_a1_present')?.tense).toBe('present');
  });
});

describe('buildGapItems', () => {
  for (const level of LEVELS) {
    it(`deals 10 drills from at most 3 lessons at ${level} (seeds 1..200)`, () => {
      const s = stateAt(level);
      for (let seed = 1; seed <= 200; seed++) {
        const items = buildGapItems(s, 10, seeded(seed));
        expect(items).toHaveLength(10);
        expect(new Set(items.map((x) => x.key)).size).toBe(10);
        const lessons = [...new Set(items.map((x) => x.lessonId))];
        expect(lessons.length).toBeLessThanOrEqual(3);
        // grouped by lesson: a lesson's drills come in one run
        const runs = items.filter((x, k) => k === 0 || x.lessonId !== items[k - 1].lessonId).length;
        expect(runs).toBe(lessons.length);
        for (const it of items) {
          expect(levelOk(lesson(it.lessonId).level, s)).toBe(true);
          expect(drillOf(it.key).prompt).toBe(it.prompt);
        }
        expect(JSON.parse(JSON.stringify(items))).toEqual(items);
      }
    });
  }

  it('is deterministic for a seed and varies across seeds', () => {
    const s = stateAt('B1');
    expect(buildGapItems(s, 10, seeded(7))).toEqual(buildGapItems(s, 10, seeded(7)));
    const rounds = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) rounds.add(buildGapItems(s, 10, seeded(seed)).map((x) => x.key).join());
    expect(rounds.size).toBeGreaterThan(15);
  });

  it('puts a weak lesson first and keeps flagged drills out', () => {
    const now = Date.now();
    const s = stateAt('B1', {
      profile: { skills: {}, topics: { g_smichut: { score: 0.3, n: 6, at: now }, g_hifil: { score: 0.9, n: 6, at: now } } },
      done: { g_piel: { at: now - 1000, score: 0.8 }, g_paal: { at: now, score: 0.7 } },
    });
    const order = gapLessons(s, seeded(1)).map((g) => g.id);
    expect(order[0]).toBe('g_smichut');
    expect(order.slice(1, 3)).toEqual(['g_paal', 'g_piel']);
    const flagged = lesson('g_smichut').drills.map((_, i) => `g_smichut#${i}`).slice(0, 8);
    const s2 = stateAt('B1', { profile: s.profile, play: { ...s.play, flagged } });
    for (let seed = 1; seed <= 30; seed++) {
      const items = buildGapItems(s2, 10, seeded(seed));
      expect(items[0].lessonId).toBe('g_smichut');
      expect(items.some((x) => flagged.includes(x.key))).toBe(false);
    }
  });

  it('A1 learners only get A1 and A2 lessons', () => {
    const s = stateAt('A1');
    for (let seed = 1; seed <= 50; seed++) {
      for (const it of buildGapItems(s, 10, seeded(seed))) expect(['A1', 'A2']).toContain(lesson(it.lessonId).level);
    }
  });
});

describe('flagGap', () => {
  it('remembers a key once and keeps the newest 300', () => {
    stateAt('B1');
    flagGap('g_paal#1');
    flagGap('g_paal#1');
    expect(getState().play.flagged).toEqual(['g_paal#1']);
    for (let i = 0; i < 320; i++) flagGap(`x#${i}`);
    const f = getState().play.flagged;
    expect(f).toHaveLength(300);
    expect(f[f.length - 1]).toBe('x#319');
    expect(f).not.toContain('g_paal#1');
  });
});

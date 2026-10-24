import { describe, expect, it } from 'vitest';
import { wordDiff } from '../src/components/answer.tsx';
import { emails, grammar, lookup, readings, scenes, verbs, vocab } from '../src/lib/content.ts';
import { checkHebrew, scoreKeywords } from '../src/lib/hebrew.ts';
import { findCloze } from '../src/lib/session.ts';

describe('content integrity', () => {
  it('every verb form is found by tap-to-gloss', () => {
    for (const v of verbs) {
      for (const tense of ['present', 'past', 'future'] as const) {
        for (const [, form] of Object.values(v[tense]).map((f) => [f[1], f[0]] as const)) {
          const hit = lookup(form).entries.some((e) => e.verbId === v.id);
          expect(hit, `${form} -> ${v.inf}`).toBe(true);
        }
      }
    }
  });

  it('vocabulary words are found with prefixes attached', () => {
    for (const v of vocab.filter((x) => !/[ /\-\u05BE]/.test(x.he))) {
      const res = lookup(`ו${v.he}`);
      const all = [...res.entries, ...(res.also?.entries ?? [])];
      expect(all.some((e) => e.vocabId === v.id || e.he === v.he), `ו${v.he}`).toBe(true);
    }
  });

  it('cloze finder never throws and blanks a real word', () => {
    for (const v of vocab) {
      const c = findCloze(v);
      if (c) expect(c.answer.length).toBeGreaterThan(0);
    }
  });

  it('model answers get full credit', () => {
    for (const r of [...readings, ...scenes]) {
      for (const q of r.questions) expect(scoreKeywords(q.answer, q.keywords).score, `${r.id}: ${q.q}`).toBe(1);
    }
  });

  it('grammar drill answers are accepted in strict mode', () => {
    for (const g of grammar) {
      g.drills.forEach((d, i) => {
        for (const a of d.answer) expect(checkHebrew(a, d.answer, { strict: true }).verdict, `${g.id}#${i}`).toBe('correct');
      });
    }
  });

  it('dictation lines match themselves', () => {
    for (const s of scenes) {
      for (const i of s.dictation) expect(wordDiff(s.lines[i].he, s.lines[i].he).score).toBe(1);
    }
  });

  it('writing checklists are satisfied by the model answers', () => {
    for (const e of emails) {
      for (const c of e.task.checklist ?? []) {
        expect(scoreKeywords(e.task.model, [c.keywords]).score, `${e.id}: ${c.en}`).toBe(1);
      }
    }
  });
});

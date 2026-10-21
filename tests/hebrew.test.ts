import { describe, expect, it } from 'vitest';
import { checkEnglish, checkHebrew, containsKeyword, expandVariants, lenient, scoreKeywords, splitWords } from '../src/lib/hebrew.ts';
import { review } from '../src/lib/fsrs.ts';

describe('checkHebrew', () => {
  it('accepts exact answers ignoring niqqud and punctuation', () => {
    expect(checkHebrew('שָׁלוֹם!', ['שלום']).verdict).toBe('correct');
  });
  it('accepts missing final letters with a note', () => {
    const r = checkHebrew('שלומ', ['שלום']);
    expect(r.verdict).toBe('correct');
    expect(r.note).toMatch(/final/);
  });
  it('accepts defective/plene yod-vav doubling', () => {
    expect(checkHebrew('שניים עשר', ['שנים עשר']).verdict).toBe('correct');
  });
  it('flags typos as close', () => {
    expect(checkHebrew('פגישע', ['פגישה']).verdict).toBe('close');
  });
  it('rejects wrong answers', () => {
    expect(checkHebrew('ספר', ['פגישה']).verdict).toBe('wrong');
  });
  it('detects latin keyboard', () => {
    expect(checkHebrew('pgisha', ['פגישה']).verdict).toBe('latin');
  });
});

describe('expandVariants', () => {
  it('expands gender slashes and optional parts', () => {
    expect(expandVariants('מצטער/ת')).toEqual(['מצטער', 'מצטערת']);
    expect(expandVariants('מוכן/ה')).toEqual(['מוכן', 'מוכנה']);
    expect(expandVariants('את/אתה')).toEqual(['את', 'אתה']);
    expect(expandVariants('אני מחפש/ת דירה')).toEqual(['אני מחפש דירה', 'אני מחפשת דירה']);
    expect(expandVariants('(ה)מנהל')).toEqual(['מנהל', 'המנהל']);
  });
  it('is used by checkHebrew', () => {
    expect(checkHebrew('אני מצטערת', ['אני מצטער/ת']).verdict).toBe('correct');
  });
});

describe('checkEnglish', () => {
  it('handles "to" and alternatives', () => {
    expect(checkEnglish('meet', ['to meet']).verdict).toBe('correct');
    expect(checkEnglish('appointment', ['meeting / appointment']).verdict).toBe('correct');
    expect(checkEnglish('meating', ['meeting']).verdict).toBe('close');
  });
});

describe('keywords', () => {
  it('strips prefixes and plural suffixes', () => {
    expect(containsKeyword('בגלל הפקקים בכביש', 'פקק')).toBe(true);
    expect(containsKeyword('וכשהגענו למשרד', 'משרד')).toBe(true);
    expect(containsKeyword('היא עובדת בבנק', 'תל אביב')).toBe(false);
    expect(containsKeyword('הם גרים בתל אביב', 'תל אביב')).toBe(true);
  });
  it('scores groups', () => {
    const s = scoreKeywords('הפגישה נדחתה ליום ראשון', [['פגישה'], ['ראשון'], ['מנהל']]);
    expect(s.matched).toEqual([true, true, false]);
  });
  it('lenient', () => {
    expect(lenient('ךםןףץ')).toBe('כמנפצ');
  });
});

describe('splitWords', () => {
  it('keeps words and punctuation', () => {
    const parts = splitWords('שלום, מה נשמע? ת״א');
    expect(parts.filter((p) => p.isWord).map((p) => p.w)).toEqual(['שלום', 'מה', 'נשמע', 'ת״א']);
  });
});

describe('fsrs', () => {
  it('grows intervals on success and shrinks on failure', () => {
    const now = Date.UTC(2026, 0, 1);
    const c1 = review(undefined, 3, now);
    expect(c1.s).toBeGreaterThan(3);
    const c2 = review(c1, 3, c1.due);
    expect(c2.s).toBeGreaterThan(c1.s);
    const c3 = review(c2, 1, c2.due);
    expect(c3.s).toBeLessThan(c2.s);
    expect(c3.lapses).toBe(1);
    expect(c3.due - c2.due).toBeLessThan(3600_000);
  });
});

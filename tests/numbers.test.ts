import { describe, expect, it } from 'vitest';
import { COUNT_NOUNS, countNoun, numberWords, phoneWords, priceWords, timeWords } from '../src/lib/numbers.ts';

const noun = (sg: string) => COUNT_NOUNS.find((n) => n.sg === sg)!;

describe('numberWords', () => {
  it.each([
    [0, 'f', 'אפס'],
    [3, 'f', 'שלוש'],
    [3, 'm', 'שלושה'],
    [10, 'm', 'עשרה'],
    [10, 'f', 'עשר'],
    [12, 'm', 'שנים עשר'],
    [12, 'f', 'שתים עשרה'],
    [21, 'm', 'עשרים ואחד'],
    [22, 'f', 'עשרים ושתיים'],
    [100, 'f', 'מאה'],
    [101, 'f', 'מאה ואחת'],
    [115, 'm', 'מאה וחמישה עשר'],
    [120, 'f', 'מאה ועשרים'],
    [125, 'm', 'מאה עשרים וחמישה'],
    [200, 'f', 'מאתיים'],
    [1000, 'f', 'אלף'],
    [1001, 'm', 'אלף ואחד'],
    [1250, 'f', 'אלף מאתיים וחמישים'],
    [2000, 'f', 'אלפיים'],
    [2026, 'f', 'אלפיים עשרים ושש'],
    [3500, 'f', 'שלושת אלפים וחמש מאות'],
    [15000, 'm', 'חמישה עשר אלף'],
    [21550, 'f', 'עשרים ואחד אלף חמש מאות וחמישים'],
    [250000, 'm', 'מאתיים וחמישים אלף'],
    [1500000, 'm', 'מיליון וחמש מאות אלף'],
    [3200000, 'm', 'שלושה מיליון ומאתיים אלף'],
  ] as const)('%i (%s) = %s', (n, g, expected) => {
    expect(numberWords(n, g)).toBe(expected);
  });
});

describe('countNoun', () => {
  it('handles one and two', () => {
    expect(countNoun(1, noun('פגישה'))).toBe('פגישה אחת');
    expect(countNoun(1, noun('עובד'))).toBe('עובד אחד');
    expect(countNoun(2, noun('עובד'))).toBe('שני עובדים');
    expect(countNoun(2, noun('פגישה'))).toBe('שתי פגישות');
    expect(countNoun(2, noun('יום'))).toBe('יומיים');
    expect(countNoun(2, noun('שנה'))).toBe('שנתיים');
  });
  it('uses grammatical gender, not the plural ending', () => {
    expect(countNoun(3, noun('לקוח'))).toBe('שלושה לקוחות');
    expect(countNoun(5, noun('שנה'))).toBe('חמש שנים');
    expect(countNoun(4, noun('שבוע'))).toBe('ארבעה שבועות');
    expect(countNoun(23, noun('עובד'))).toBe('עשרים ושלושה עובדים');
    expect(countNoun(11, noun('מילה'))).toBe('אחת עשרה מילים');
  });
});

describe('prices, time, phone', () => {
  it('prices', () => {
    expect(priceWords(45)).toBe('ארבעים וחמישה שקלים');
    expect(priceWords(12, 90)).toBe('שנים עשר שקלים ותשעים אגורות');
    expect(priceWords(1)).toBe('שקל אחד');
  });
  it('time', () => {
    expect(timeWords(15, 45)).toBe('רבע לארבע אחר הצהריים');
    expect(timeWords(8, 30)).toBe('שמונה וחצי בבוקר');
    expect(timeWords(12, 15, false)).toBe('שתים עשרה ורבע');
    expect(timeWords(11, 45, false)).toBe('רבע לשתים עשרה');
    expect(timeWords(20, 20)).toBe('שמונה ועשרים בערב');
  });
  it('phone', () => {
    expect(phoneWords('052-3456789')).toBe('אפס חמש שתיים, שלוש ארבע חמש, שש שבע, שמונה תשע');
  });
});

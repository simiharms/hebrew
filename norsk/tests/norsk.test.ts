import { describe, expect, it } from 'vitest';
import { checkAnswer, checkGerman, containsKeyword, expandVariants, fold, normalize, scoreKeywords, splitAlt, splitWords, stems, wordCount } from '../src/lib/norsk.ts';
import { clockWords, dateWords, numberVariants, numberWords, ordinalWords, sameNumberWords, yearWords } from '../src/lib/numbers.ts';

describe('normalize and fold', () => {
  it('lower-cases and drops punctuation, keeps word-internal hyphens', () => {
    expect(normalize('  Hei, Anna!  ')).toBe('hei anna');
    expect(normalize('«Hva heter du?»')).toBe('hva heter du');
    expect(normalize('e-post – kjempe-fin')).toBe('e-post kjempe-fin');
  });
  it('folds æ ø å and typed stand-ins', () => {
    expect(fold('også')).toBe(fold('ogsaa'));
    expect(fold('bøker')).toBe(fold('boeker'));
    expect(fold('Bøker')).toBe(fold('boker'));
    expect(fold('være')).toBe(fold('vaere'));
  });
});

describe('expandVariants and splitAlt', () => {
  it('expands optional parts and slashes', () => {
    expect(expandVariants('(å) snakke').sort()).toEqual(['snakke', 'å snakke'].sort());
    expect(expandVariants('en/ei bok').sort()).toEqual(['ei bok', 'en bok'].sort());
  });
  it('splits whole-form alternatives', () => {
    expect(splitAlt('gledet seg/gleda seg')).toEqual(['gledet seg', 'gleda seg']);
    expect(splitAlt('husa/husene')).toEqual(['husa', 'husene']);
  });
});

describe('checkAnswer', () => {
  it('accepts exact answers regardless of case and punctuation', () => {
    expect(checkAnswer('Bor', ['bor']).verdict).toBe('correct');
    expect(checkAnswer('jeg bor i Oslo.', ['Jeg bor i Oslo']).verdict).toBe('correct');
  });
  it('treats a missing æ ø å as close, even in strict mode', () => {
    const r = checkAnswer('gaar', ['går'], { strict: true });
    expect(r.verdict).toBe('close');
    expect(r.expected).toBe('går');
  });
  it('forgives a typo normally but not in strict mode', () => {
    expect(checkAnswer('snakkket', ['snakket']).verdict).toBe('close');
    expect(checkAnswer('store', ['stort'], { strict: true }).verdict).toBe('wrong');
  });
  it('rejects wrong answers and names the closest accepted one', () => {
    expect(checkAnswer('hus', ['huset']).verdict).toBe('wrong');
    expect(checkAnswer('hus', ['huset', 'husa'], { strict: true }).verdict).toBe('wrong');
    expect(checkAnswer('hus', ['huset', 'husa'], { strict: true }).expected).toBe('husa');
  });
  it('accepts slash variants inside an answer', () => {
    expect(checkAnswer('ei bok', ['en/ei bok']).verdict).toBe('correct');
  });
});

describe('checkGerman', () => {
  it('ignores articles and accepts any listed meaning', () => {
    expect(checkGerman('Auto', ['das Auto']).verdict).toBe('correct');
    expect(checkGerman('die Wohnung', ['Wohnung, Apartment']).verdict).toBe('correct');
    expect(checkGerman('Apartment', ['Wohnung, Apartment']).verdict).toBe('correct');
    expect(checkGerman('gross', ['groß']).verdict).toBe('correct');
    expect(checkGerman('Bahnhoff', ['der Bahnhof']).verdict).toBe('close');
  });
});

describe('keywords and stems', () => {
  it('finds inflected forms', () => {
    expect(stems('bilene')).toContain('bil');
    expect(stems('grønt')).toContain('grønn');
    expect(containsKeyword('Hun bodde i Bergen', 'bo')).toBe(true);
    expect(containsKeyword('Hun bodde i Bergen', 'Oslo')).toBe(false);
    expect(containsKeyword('Vi kjøpte husene', 'hus')).toBe(true);
    expect(containsKeyword('Hun snakker norsk', 'snakke')).toBe(true);
  });
  it('scores keyword groups', () => {
    const s = scoreKeywords('Hun bor på Sagene', [['Sagene'], ['bor', 'bodde'], ['Bergen']]);
    expect(s.matched).toEqual([true, true, false]);
  });
  it('counts and splits words', () => {
    expect(wordCount('Hei, jeg heter Anna.')).toBe(4);
    expect(splitWords('Hei, Anna!').filter((p) => p.isWord).map((p) => p.w)).toEqual(['Hei', 'Anna']);
    expect(splitWords('e-post').filter((p) => p.isWord).map((p) => p.w)).toEqual(['e-post']);
  });
});

describe('numbers', () => {
  it('says numbers the modern way', () => {
    expect(numberWords(0)).toBe('null');
    expect(numberWords(7)).toBe('sju');
    expect(numberWords(21)).toBe('tjueen');
    expect(numberWords(45)).toBe('førtifem');
    expect(numberWords(100)).toBe('hundre');
    expect(numberWords(250)).toBe('to hundre og femti');
    expect(numberWords(1005)).toBe('tusen og fem');
    expect(numberWords(2025)).toBe('to tusen og tjuefem');
    expect(numberWords(3412)).toBe('tre tusen fire hundre og tolv');
  });
  it('accepts the old system, syv and joined spelling', () => {
    const v = numberVariants(27);
    expect(v).toContain('tjuesju');
    expect(v).toContain('sjuogtjue');
    expect(v).toContain('tjuesyv');
    expect(sameNumberWords('to hundre og femti', 'tohundreogfemti')).toBe(true);
  });
  it('ordinals and dates', () => {
    expect(ordinalWords(1)).toBe('første');
    expect(ordinalWords(2)).toBe('andre');
    expect(ordinalWords(17)).toBe('syttende');
    expect(ordinalWords(20)).toBe('tjuende');
    expect(ordinalWords(21)).toBe('tjueførste');
    expect(dateWords(17, 5)).toBe('den syttende mai');
  });
  it('years', () => {
    expect(yearWords(1984)).toContain('nitten åttifire');
    expect(yearWords(1905)).toContain('nitten hundre og fem');
    expect(yearWords(1814)).toContain('atten fjorten');
    expect(yearWords(2025)).toContain('to tusen og tjuefem');
  });
  it('clock times like German "halb"', () => {
    expect(clockWords(14, 30)[0]).toBe('halv tre');
    expect(clockWords(3, 15)[0]).toBe('kvart over tre');
    expect(clockWords(3, 45)[0]).toBe('kvart på fire');
    expect(clockWords(3, 20)[0]).toBe('ti på halv fire');
    expect(clockWords(3, 35)[0]).toBe('fem over halv fire');
    expect(clockWords(13, 0)[0]).toBe('klokka ett');
    expect(clockWords(12, 30)[0]).toBe('halv ett');
    expect(clockWords(23, 55)[0]).toBe('fem på tolv');
  });
});

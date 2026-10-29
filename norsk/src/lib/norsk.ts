// Norwegian text utilities: normalisation, answer checking, keyword matching.
// Uses only erasable TypeScript so Node can run it directly (validator).

const LETTER = 'a-zA-ZæøåÆØÅéèêóòôüÉÈÊÓÒÔÜäöÄÖ';
const WORD_RE = new RegExp(`[${LETTER}0-9]+(?:[-'’][${LETTER}0-9]+)*`, 'g');
const IS_WORD_CHAR = new RegExp(`[${LETTER}0-9]`);

/** Lower case, unified quotes and dashes, no punctuation, single spaces. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”«»„]/g, '"')
    .replace(/[‐‑–—]/g, '-')
    // A hyphen between letters belongs to the word (kjempe-fin, e-post); elsewhere it is punctuation.
    // (No lookbehind: older iPhones can't parse it.)
    .replace(/-/g, (m, i: number, str: string) => (IS_WORD_CHAR.test(str[i - 1] ?? '') && IS_WORD_CHAR.test(str[i + 1] ?? '') ? m : ' '))
    .replace(/[.,!?;:()[\]{}"…/\\+=*&#@~^|<>]/g, ' ')
    .replace(/(^|\s)'+|'+(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Folds æ ø å (and typed stand-ins like ae, oe, aa) to plain letters, to spot keyboard problems. */
export function fold(s: string): string {
  return normalize(s)
    .replace(/æ|ae|ä/g, 'a')
    .replace(/ø|oe|ö/g, 'o')
    .replace(/å|aa/g, 'a')
    .replace(/é|è|ê/g, 'e')
    .replace(/ó|ò|ô/g, 'o')
    .replace(/ü/g, 'u');
}

export const hasNorwegianLetters = (s: string) => /[æøå]/i.test(s);

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  let cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

function typoBudget(len: number): number {
  if (len >= 10) return 2;
  if (len >= 4) return 1;
  return 0;
}

/**
 * Expand answer notation into plain alternatives:
 * "(å) snakke" -> ["snakke", "å snakke"], "en/ei bok" -> ["en bok", "ei bok"].
 * A slash between whole words separates alternatives for that word.
 */
export function expandVariants(answer: string): string[] {
  let variants = [answer.trim()];
  const opt = /\(([^)]*)\)/;
  for (let guard = 0; guard < 4 && variants.some((v) => opt.test(v)); guard++) {
    variants = variants.flatMap((v) => {
      const m = v.match(opt);
      if (!m) return [v];
      return [v.replace(m[0], ''), v.replace(m[0], m[1])].map((x) => x.replace(/\s+/g, ' ').trim());
    });
  }
  variants = variants.flatMap((v) => {
    let acc: string[] = [''];
    for (const tok of v.split(' ')) {
      const options = tok.includes('/') && !/^\/|\/$/.test(tok) ? tok.split('/') : [tok];
      acc = acc.flatMap((a) => options.map((o) => (a ? `${a} ${o}` : o)));
      if (acc.length > 24) acc = acc.slice(0, 24);
    }
    return acc;
  });
  return [...new Set(variants.filter(Boolean))];
}

/** Alternatives of a whole form: "kastet/kasta", "gledet seg/gleda seg". */
export function splitAlt(form: string): string[] {
  return form
    .split('/')
    .map((x) => x.trim())
    .filter(Boolean);
}

export type Verdict = 'correct' | 'close' | 'wrong' | 'empty';

export interface CheckResult {
  verdict: Verdict;
  expected: string; // the accepted answer closest to the input
  note?: string; // German
}

const KEYBOARD_NOTE = 'Richtig – achte nur auf æ, ø und å.';

/**
 * Check a typed Norwegian answer against the accepted answers.
 * strict: grammar and verb drills, where one letter (stort/store, bodde/bodd) is the point,
 * so typos are not forgiven. Missing æ ø å are always only noted, never counted wrong.
 */
export function checkAnswer(input: string, acceptedRaw: string[], opts: { strict?: boolean } = {}): CheckResult {
  const raw = input.trim();
  const accepted = [...new Set(acceptedRaw.flatMap((a) => [a, ...expandVariants(a)]))];
  const first = expandVariants(acceptedRaw[0] ?? '')[0] ?? acceptedRaw[0] ?? '';
  if (!raw) return { verdict: 'empty', expected: first };
  const n = normalize(raw);
  for (const a of accepted) if (normalize(a) === n) return { verdict: 'correct', expected: a };
  const f = fold(raw);
  for (const a of accepted) {
    if (fold(a) === f) return { verdict: 'close', expected: a, note: KEYBOARD_NOTE };
  }
  let best = first;
  let bestD = Infinity;
  for (const a of accepted) {
    const d = levenshtein(f, fold(a));
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  if (bestD <= typoBudget(fold(best).length)) {
    if (opts.strict) return { verdict: 'wrong', expected: best, note: 'Ganz knapp – aber hier zählt die genaue Form. Vergleiche die Endung.' };
    return { verdict: 'close', expected: best, note: 'Fast richtig – achte auf die Schreibung.' };
  }
  return { verdict: 'wrong', expected: best };
}

// ---------- German meanings (Norwegian → German quizzes) ----------

const DE_STOP = /^(der|die|das|ein|eine|einen|sich|zu|etw|etwas|jdn|jdm) /;

export function normalizeDe(s: string): string {
  let out = s
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[.,!?;:"'„“”‚‘’]/g, ' ')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();
  for (let i = 0; i < 3; i++) out = out.replace(DE_STOP, '');
  return out;
}

/** Check a typed German meaning. Glosses may hold several meanings separated by "/", "," or ";". */
export function checkGerman(input: string, glosses: string[]): CheckResult {
  const raw = input.trim();
  const first = glosses[0] ?? '';
  if (!raw) return { verdict: 'empty', expected: first };
  const n = normalizeDe(raw);
  const options = glosses.flatMap((g) => [g, ...g.split(/[\/,;]/)]).map(normalizeDe).filter(Boolean);
  if (options.includes(n)) return { verdict: 'correct', expected: first };
  const umlaut = (x: string) => x.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
  if (options.some((o) => umlaut(o) === umlaut(n))) return { verdict: 'correct', expected: first };
  for (const o of options) {
    if (o.length >= 4 && levenshtein(umlaut(n), umlaut(o)) <= typoBudget(o.length)) {
      return { verdict: 'close', expected: first, note: 'Fast – achte auf die Schreibung.' };
    }
  }
  return { verdict: 'wrong', expected: first };
}

// ---------- Words, stems and keywords ----------

export function tokenize(s: string): string[] {
  return normalize(s).split(' ').filter(Boolean);
}

export function wordCount(s: string): number {
  return tokenize(s).filter((w) => /[a-zæøå]/.test(w)).length;
}

// Inflection endings, longest first (definite, plural, past, comparison, genitive).
const ENDINGS = ['ene', 'ane', 'ende', 'ede', 'este', 'ste', 'ere', 'est', 'dde', 'ens', 'ets', 'er', 'en', 'et', 'st', 'te', 'de', 'ne', 'a', 'e', 't', 's', 'r'];

/** Possible stems of an inflected word: hus-ene → hus, snakk-et → snakk(e). */
export function stems(word: string): string[] {
  const w = normalize(word);
  const out = new Set<string>();
  for (const e of ENDINGS) {
    if (w.endsWith(e) && w.length - e.length >= 2) {
      const stem = w.slice(0, -e.length);
      out.add(stem);
      out.add(stem + 'e');
      // simplified double consonants: grønt → grønn, dumme → dum
      if (/([bdfgklmnprst])\1$/.test(stem)) out.add(stem.slice(0, -1));
      else if (/[bdfgklmnprst]$/.test(stem)) out.add(stem + stem.slice(-1));
    }
  }
  out.delete(w);
  return [...out];
}

function tokenMatches(t: string, k: string): boolean {
  if (t === k) return true;
  const ft = fold(t);
  const fk = fold(k);
  if (ft === fk) return true;
  const ts = new Set([ft, ...stems(t).map(fold)]);
  if (ts.has(fk)) return true;
  if (stems(k).some((s) => ts.has(fold(s)))) return true;
  if (fk.length >= 5 && levenshtein(ft, fk) <= 1) return true;
  return false;
}

/** Does the text contain the keyword (a word or phrase), allowing inflection and small typos? */
export function containsKeyword(text: string, keyword: string): boolean {
  const tokens = tokenize(text);
  const kws = tokenize(keyword);
  if (!kws.length) return false;
  return kws.every((k) => tokens.some((t) => tokenMatches(t, k)));
}

export interface KeywordScore {
  score: number; // 0..1
  matched: boolean[];
}

export function scoreKeywords(text: string, groups: string[][]): KeywordScore {
  const matched = groups.map((g) => g.some((v) => containsKeyword(text, v)));
  const score = groups.length ? matched.filter(Boolean).length / groups.length : 0;
  return { score, matched };
}

/** Split text into word and non-word chunks for tap-to-translate rendering. */
export function splitWords(text: string): { w: string; isWord: boolean }[] {
  const out: { w: string; isWord: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(WORD_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ w: text.slice(last, i), isWord: false });
    out.push({ w: m[0], isWord: /[a-zæøåA-ZÆØÅ]/.test(m[0]) });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ w: text.slice(last), isWord: false });
  return out;
}

/** Whether `needle` occurs in `hay` as whole words (normalized). */
export function containsPhrase(hay: string, needle: string): boolean {
  const h = ` ${normalize(hay)} `;
  const n = normalize(needle);
  return !!n && h.includes(` ${n} `);
}

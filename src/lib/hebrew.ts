// Hebrew text utilities: normalisation, answer checking, keyword matching.
// Uses only erasable TypeScript so Node can run it directly (validator).

const NIQQUD_RE = /[֑-ׇ]/g;
const HEB_LETTER_RE = /[א-ת]/;
const LATIN_RE = /[a-zA-Z]/;
const UNFINAL: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const FINALS_RE = /[ךםןףץ]/g;
const PREFIX_LETTERS = 'והבכלמש';
// In lenient form (final letters already replaced by regular ones).
const SUFFIXES = ['ויות', 'יות', 'ימ', 'ות', 'ית', 'יה', 'נו', 'כמ', 'כנ', 'המ', 'הנ', 'ה', 'ת', 'י', 'כ', 'ו', 'מ', 'נ'];

export function stripNiqqud(s: string): string {
  return s.replace(NIQQUD_RE, '');
}

export function hasHebrew(s: string): boolean {
  return HEB_LETTER_RE.test(s);
}

export function hasLatin(s: string): boolean {
  return LATIN_RE.test(s);
}

/** Strict-ish normalisation: no niqqud, punctuation or extra spaces. */
export function normalize(s: string): string {
  return stripNiqqud(s)
    .replace(/[׳’‘`´]/g, "'")
    .replace(/[״“”]/g, '"')
    .replace(/[־\-–—/]/g, ' ')
    .replace(/[.,!?;:()[\]{}«»"…‎‏‪-‮⁦-⁩₪%]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lenient form: also ignores final-letter forms, geresh and doubled vav/yod. */
export function lenient(s: string): string {
  return normalize(s)
    .replace(/'/g, '')
    .replace(FINALS_RE, (c) => UNFINAL[c])
    .replace(/יי/g, 'י')
    .replace(/וו/g, 'ו');
}

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

const SHORT_SUFFIX = /^(ת|ה|ית|ים|ות|י|ן|ם)$/;
const TO_REGULAR: Record<string, string> = UNFINAL;

/**
 * Expand gendered/optional notation into plain alternatives:
 * "מצטער/ת" -> ["מצטער", "מצטערת"], "את/אתה" -> ["את", "אתה"], "(ה)מנהל" -> ["מנהל", "המנהל"].
 */
export function expandVariants(answer: string): string[] {
  let variants = [answer.trim()];
  // optional parts in parentheses
  const opt = /\(([^)]*)\)/;
  for (let guard = 0; guard < 4 && variants.some((v) => opt.test(v)); guard++) {
    variants = variants.flatMap((v) => {
      const m = v.match(opt);
      if (!m) return [v];
      return [v.replace(m[0], ''), v.replace(m[0], m[1])].map((x) => x.replace(/\s+/g, ' ').trim());
    });
  }
  // slash alternatives, token by token
  variants = variants.flatMap((v) => {
    const tokens = v.split(' ');
    let acc: string[] = [''];
    for (const tok of tokens) {
      let options: string[];
      if (tok.includes('/') && hasHebrew(tok)) {
        const [first, ...rest] = tok.split('/');
        options = [first];
        for (const r of rest) {
          if (SHORT_SUFFIX.test(r)) {
            const last = first.slice(-1);
            options.push(first.slice(0, -1) + (TO_REGULAR[last] ?? last) + r);
          } else options.push(r);
        }
      } else options = [tok];
      acc = acc.flatMap((a) => options.map((o) => (a ? `${a} ${o}` : o)));
      if (acc.length > 16) acc = acc.slice(0, 16);
    }
    return acc;
  });
  return [...new Set(variants.filter(Boolean))];
}

export type Verdict = 'correct' | 'close' | 'wrong' | 'latin' | 'empty';

export interface CheckResult {
  verdict: Verdict;
  expected: string; // the accepted answer closest to the input
  note?: string;
}

/** Check a typed Hebrew answer against a list of accepted answers. */
export function checkHebrew(input: string, acceptedRaw: string[]): CheckResult {
  const raw = input.trim();
  const first = acceptedRaw[0] ?? '';
  const accepted = [...new Set(acceptedRaw.flatMap((a) => [a, ...expandVariants(a)]))];
  if (!raw) return { verdict: 'empty', expected: first };
  if (hasLatin(raw) && !hasHebrew(raw)) {
    return {
      verdict: 'latin',
      expected: first,
      note: 'That looks like Latin letters — switch to the Hebrew keyboard (🌐 key).',
    };
  }
  const n = normalize(raw);
  const l = lenient(raw);
  for (const a of accepted) if (normalize(a) === n) return { verdict: 'correct', expected: a };
  for (const a of accepted) {
    if (lenient(a) === l) {
      return { verdict: 'correct', expected: a, note: spellingNote(n, normalize(a)) };
    }
  }
  let best = first;
  let bestD = Infinity;
  for (const a of accepted) {
    const d = levenshtein(l, lenient(a));
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  if (bestD <= typoBudget(lenient(best).length)) {
    return { verdict: 'close', expected: best, note: 'Almost — check the spelling.' };
  }
  return { verdict: 'wrong', expected: best };
}

function spellingNote(given: string, expected: string): string | undefined {
  if (given === expected) return undefined;
  const gf = given.replace(FINALS_RE, (c) => UNFINAL[c]);
  const ef = expected.replace(FINALS_RE, (c) => UNFINAL[c]);
  if (gf === ef) return 'Watch the final letters (ך ם ן ף ץ at the end of a word).';
  return 'Accepted — note the standard spelling.';
}

const EN_STOP = /^(to|a|an|the) /;

export function normalizeEn(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[.,!?;:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(EN_STOP, '')
    .replace(EN_STOP, '');
}

/** Check a typed English meaning. Glosses may contain "/" or "," or ";" separated options. */
export function checkEnglish(input: string, glosses: string[]): CheckResult {
  const raw = input.trim();
  const first = glosses[0] ?? '';
  if (!raw) return { verdict: 'empty', expected: first };
  const n = normalizeEn(raw);
  const options = glosses.flatMap((g) => [g, ...g.split(/[\/,;]/)]).map(normalizeEn).filter(Boolean);
  if (options.includes(n)) return { verdict: 'correct', expected: first };
  for (const o of options) {
    if (o.length >= 4 && levenshtein(n, o) <= typoBudget(o.length)) {
      return { verdict: 'close', expected: first, note: 'Close enough — check the spelling.' };
    }
  }
  return { verdict: 'wrong', expected: first };
}

export function tokenize(s: string): string[] {
  return lenient(s).split(' ').filter(Boolean);
}

/** Variants of a single (lenient) token with up to three prefix letters removed. */
export function prefixVariants(token: string): string[] {
  const out = [token];
  let w = token;
  for (let i = 0; i < 3; i++) {
    if (w.length > 2 && PREFIX_LETTERS.includes(w[0])) {
      w = w.slice(1);
      out.push(w);
    } else break;
  }
  return out;
}

function suffixStems(token: string): string[] {
  const out: string[] = [];
  for (const suf of SUFFIXES) {
    if (token.endsWith(suf) && token.length - suf.length >= 3) out.push(token.slice(0, -suf.length));
  }
  return out;
}

function keywordForms(k: string): Set<string> {
  return new Set([k, ...suffixStems(k)]);
}

function tokenForms(t: string): string[] {
  const out: string[] = [];
  for (const p of prefixVariants(t)) {
    out.push(p, ...suffixStems(p));
  }
  return out;
}

function tokenMatches(t: string, k: string): boolean {
  if (t === k) return true;
  const fk = keywordForms(k);
  for (const f of tokenForms(t)) if (fk.has(f)) return true;
  if (k.length >= 5) {
    for (const p of prefixVariants(t)) if (levenshtein(p, k) <= 1) return true;
  }
  return false;
}

/** Does the text contain the keyword (single word or phrase), allowing prefixes/inflection? */
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

export function wordCount(s: string): number {
  return normalize(s).split(' ').filter((w) => hasHebrew(w)).length;
}

/** Split text into word and non-word chunks for tap-to-gloss rendering. */
export function splitWords(text: string): { w: string; isWord: boolean }[] {
  const out: { w: string; isWord: boolean }[] = [];
  const re = /([א-ת֑-ׇ'"׳״]+)|([^א-ת֑-ׇ]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1]) {
      // keep trailing/leading quote marks out of the word unless inside (e.g. ג'ובניק, ת"א)
      const word = m[1];
      const lead = word.match(/^['"׳״]+/)?.[0] ?? '';
      const trail = word.match(/['"׳״]+$/)?.[0] ?? '';
      if (lead) out.push({ w: lead, isWord: false });
      const core = word.slice(lead.length, word.length - trail.length);
      if (core) out.push({ w: core, isWord: true });
      if (trail) out.push({ w: trail, isWord: false });
    } else out.push({ w: m[2], isWord: false });
  }
  return out;
}

/** Lookup keys to try for a word in a reading, best first. */
export function lookupKeys(word: string): string[] {
  const l = lenient(word);
  const keys: string[] = [];
  for (const p of prefixVariants(l)) {
    keys.push(p);
  }
  for (const p of prefixVariants(l)) keys.push(...suffixStems(p));
  return [...new Set(keys)];
}

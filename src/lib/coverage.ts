// Estimates how readable a text is for this learner: the share of its words
// they already know (learned vocabulary, verb forms, and common function words).
import { allVocab, verbs } from './content.ts';
import { strength } from './fsrs.ts';
import { lenient, prefixVariants, splitWords } from './hebrew.ts';
import type { AppState } from './store.ts';

// Very common words a learner past A2 knows, whether or not they're in the deck.
const FUNCTION_WORDS = new Set(
  (
    'של את על עם זה זו זאת אלה הוא היא הם הן אני אתה אנחנו אתם אתן יש אין לא כן גם רק כל עוד כבר אבל או כי אם מה מי איך למה מתי איפה כמה ' +
    'היה הייתה היו יהיה תהיה יהיו אחרי לפני בין אל מן עד כמו יותר פחות מאוד הרבה קצת אחד אחת שני שתי שלוש שלושה אותו אותה אותם לו לה להם לי לך לנו ' +
    'שלו שלה שלהם שלי שלך שלנו אחר אחרת אחרים חדש חדשה חדשים גדול גדולה קטן קטנה טוב טובה היום אתמול מחר עכשיו שנה שנים יום ימים שבוע חודש ' +
    'אחרי ישראל ישראלי ישראלים תל אביב ירושלים חיפה אמר אמרה אומר אומרת לפי בזמן כך כאן שם עדיין צריך אפשר רוצה יכול יכולה'
  )
    .split(' ')
    .map((w) => lenient(w)),
);

export function knownWords(s: AppState): Set<string> {
  const known = new Set<string>();
  for (const v of allVocab()) {
    const st = strength(s.cards[`v:${v.id}`]);
    if (st !== 'known' && st !== 'mature') continue;
    for (const w of [v.he, v.plural, ...(v.alt ?? [])]) if (w && !w.includes(' ')) known.add(lenient(w));
  }
  for (const vb of verbs) {
    const learned = (['present', 'past', 'future'] as const).filter((t) => ['known', 'mature'].includes(strength(s.cards[`c:${vb.id}:${t}`])));
    if (!learned.length) continue;
    known.add(lenient(vb.inf));
    for (const t of learned) for (const f of Object.values(vb[t])) known.add(lenient(f[0]));
  }
  return known;
}

export interface Coverage {
  ratio: number; // 0..1 share of words known
  total: number;
  unknown: string[]; // distinct unknown words, in order
}

export function coverage(text: string, known: Set<string>): Coverage {
  const words = splitWords(text)
    .filter((p) => p.isWord)
    .map((p) => p.w);
  let hits = 0;
  const unknown: string[] = [];
  for (const w of words) {
    const variants = prefixVariants(lenient(w));
    if (variants.some((v) => FUNCTION_WORDS.has(v) || known.has(v))) hits++;
    else if (!unknown.includes(w)) unknown.push(w);
  }
  return { ratio: words.length ? hits / words.length : 0, total: words.length, unknown };
}

export function difficultyLabel(ratio: number): { label: string; cls: string } {
  if (ratio >= 0.9) return { label: 'Easy for you', cls: 'good' };
  if (ratio >= 0.75) return { label: 'Manageable', cls: 'warn' };
  return { label: 'Challenging', cls: 'bad' };
}

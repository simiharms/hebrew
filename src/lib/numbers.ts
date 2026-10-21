// Hebrew numbers: cardinal words with gender, counting nouns, prices, time, phone numbers.

export type G = 'm' | 'f';

const M_UNITS = ['', 'אחד', 'שניים', 'שלושה', 'ארבעה', 'חמישה', 'שישה', 'שבעה', 'שמונה', 'תשעה'];
const F_UNITS = ['', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע'];
const M_TEENS = ['עשרה', 'אחד עשר', 'שנים עשר', 'שלושה עשר', 'ארבעה עשר', 'חמישה עשר', 'שישה עשר', 'שבעה עשר', 'שמונה עשר', 'תשעה עשר'];
const F_TEENS = ['עשר', 'אחת עשרה', 'שתים עשרה', 'שלוש עשרה', 'ארבע עשרה', 'חמש עשרה', 'שש עשרה', 'שבע עשרה', 'שמונה עשרה', 'תשע עשרה'];
const TENS = ['', '', 'עשרים', 'שלושים', 'ארבעים', 'חמישים', 'שישים', 'שבעים', 'שמונים', 'תשעים'];
const HUNDREDS = ['', 'מאה', 'מאתיים', 'שלוש מאות', 'ארבע מאות', 'חמש מאות', 'שש מאות', 'שבע מאות', 'שמונה מאות', 'תשע מאות'];
const THOUSANDS = ['', 'אלף', 'אלפיים', 'שלושת אלפים', 'ארבעת אלפים', 'חמשת אלפים', 'ששת אלפים', 'שבעת אלפים', 'שמונת אלפים', 'תשעת אלפים', 'עשרת אלפים'];

function below1000(n: number, g: G): string[] {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (r >= 10 && r < 20) parts.push((g === 'm' ? M_TEENS : F_TEENS)[r - 10]);
  else {
    const t = Math.floor(r / 10);
    const u = r % 10;
    if (t) parts.push(TENS[t]);
    if (u) parts.push((g === 'm' ? M_UNITS : F_UNITS)[u]);
  }
  return parts;
}

function joinParts(parts: string[]): string {
  if (parts.length > 1) parts[parts.length - 1] = 'ו' + parts[parts.length - 1];
  return parts.join(' ');
}

/** Cardinal number in words. Feminine is the default "counting" form. */
export function numberWords(n: number, g: G = 'f'): string {
  if (!Number.isInteger(n) || n < 0 || n >= 1e9) throw new Error(`unsupported number ${n}`);
  if (n === 0) return 'אפס';
  const millions = Math.floor(n / 1e6);
  const thousands = Math.floor((n % 1e6) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) {
    if (millions === 1) parts.push('מיליון');
    else if (millions === 2) parts.push('שני מיליון');
    else parts.push(joinParts(below1000(millions, 'm')) + ' מיליון');
  }
  if (thousands) {
    if (thousands <= 10) parts.push(THOUSANDS[thousands]);
    else parts.push(joinParts(below1000(thousands, 'm')) + ' אלף');
  }
  parts.push(...below1000(rest, g));
  return joinParts(parts);
}

export interface CountNoun {
  sg: string;
  pl: string;
  g: G;
  dual?: string;
  en: string;
  enPl: string;
  trap?: string; // what makes this noun tricky
}

export const COUNT_NOUNS: CountNoun[] = [
  { sg: 'עובד', pl: 'עובדים', g: 'm', en: 'employee', enPl: 'employees' },
  { sg: 'לקוח', pl: 'לקוחות', g: 'm', en: 'client', enPl: 'clients', trap: 'masculine, even though the plural ends in -ות' },
  { sg: 'שקל', pl: 'שקלים', g: 'm', en: 'shekel', enPl: 'shekels' },
  { sg: 'מחשב', pl: 'מחשבים', g: 'm', en: 'computer', enPl: 'computers' },
  { sg: 'חדר', pl: 'חדרים', g: 'm', en: 'room', enPl: 'rooms' },
  { sg: 'יום', pl: 'ימים', g: 'm', dual: 'יומיים', en: 'day', enPl: 'days' },
  { sg: 'שבוע', pl: 'שבועות', g: 'm', dual: 'שבועיים', en: 'week', enPl: 'weeks', trap: 'masculine, even though the plural ends in -ות' },
  { sg: 'חודש', pl: 'חודשים', g: 'm', dual: 'חודשיים', en: 'month', enPl: 'months' },
  { sg: 'דולר', pl: 'דולרים', g: 'm', en: 'dollar', enPl: 'dollars' },
  { sg: 'מייל', pl: 'מיילים', g: 'm', en: 'email', enPl: 'emails' },
  { sg: 'פרויקט', pl: 'פרויקטים', g: 'm', en: 'project', enPl: 'projects' },
  { sg: 'שולחן', pl: 'שולחנות', g: 'm', en: 'table', enPl: 'tables', trap: 'masculine, even though the plural ends in -ות' },
  { sg: 'פגישה', pl: 'פגישות', g: 'f', en: 'meeting', enPl: 'meetings' },
  { sg: 'שעה', pl: 'שעות', g: 'f', dual: 'שעתיים', en: 'hour', enPl: 'hours' },
  { sg: 'דקה', pl: 'דקות', g: 'f', en: 'minute', enPl: 'minutes' },
  { sg: 'שנה', pl: 'שנים', g: 'f', dual: 'שנתיים', en: 'year', enPl: 'years', trap: 'feminine, even though the plural ends in -ים' },
  { sg: 'הודעה', pl: 'הודעות', g: 'f', en: 'message', enPl: 'messages' },
  { sg: 'חשבונית', pl: 'חשבוניות', g: 'f', en: 'invoice', enPl: 'invoices' },
  { sg: 'מכונית', pl: 'מכוניות', g: 'f', en: 'car', enPl: 'cars' },
  { sg: 'עיר', pl: 'ערים', g: 'f', en: 'city', enPl: 'cities', trap: 'feminine, even though the plural ends in -ים' },
  { sg: 'מילה', pl: 'מילים', g: 'f', en: 'word', enPl: 'words', trap: 'feminine, even though the plural ends in -ים' },
  { sg: 'פעם', pl: 'פעמים', g: 'f', dual: 'פעמיים', en: 'time (occurrence)', enPl: 'times', trap: 'feminine' },
];

/** Standard phrase for "n nouns", e.g. 3 meetings -> שלוש פגישות. */
export function countNoun(n: number, noun: CountNoun): string {
  if (n === 1) return `${noun.sg} ${noun.g === 'm' ? 'אחד' : 'אחת'}`;
  if (n === 2) return noun.dual ?? `${noun.g === 'm' ? 'שני' : 'שתי'} ${noun.pl}`;
  return `${numberWords(n, noun.g)} ${noun.pl}`;
}

/** Price in shekels (and agorot) as spoken in standard Hebrew. */
export function priceWords(shekels: number, agorot = 0): string {
  const sh = shekels ? countNoun(shekels, COUNT_NOUNS[2]) : '';
  if (!agorot) return sh;
  const ag = agorot === 1 ? 'אגורה אחת' : agorot === 2 ? 'שתי אגורות' : `${numberWords(agorot, 'f')} אגורות`;
  return sh ? `${sh} ו${ag}` : ag;
}

const HOURS = ['שתים עשרה', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר', 'אחת עשרה', 'שתים עשרה'];

function partOfDay(h24: number): string {
  if (h24 < 5) return 'בלילה';
  if (h24 < 12) return 'בבוקר';
  if (h24 < 15) return 'בצהריים';
  if (h24 < 18) return 'אחר הצהריים';
  if (h24 < 22) return 'בערב';
  return 'בלילה';
}

/** Spoken clock time, e.g. 15:45 -> "רבע לארבע אחר הצהריים". Minutes should be a multiple of 5. */
export function timeWords(h24: number, min: number, withPart = true): string {
  const h = h24 % 12;
  const hourWord = HOURS[h === 0 ? 12 : h];
  const next = HOURS[((h + 1) % 12) || 12];
  let core: string;
  if (min === 0) core = hourWord;
  else if (min === 15) core = `${hourWord} ורבע`;
  else if (min === 30) core = `${hourWord} וחצי`;
  else if (min === 45) core = `רבע ל${next}`;
  else if (min === 5) core = `${hourWord} וחמישה`;
  else if (min === 10) core = `${hourWord} ועשרה`;
  else core = `${hourWord} ו${numberWords(min, 'f')}`;
  return withPart ? `${core} ${partOfDay(h24)}` : core;
}

const DIGITS = ['אפס', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע'];

/** Phone number read digit by digit in groups: 052-3456789 -> "אפס חמש שתיים, שלוש ארבע חמש, ..." */
export function phoneWords(phone: string): string {
  const d = phone.replace(/\D/g, '');
  const groups = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8)].filter(Boolean);
  return groups.map((g) => [...g].map((c) => DIGITS[+c]).join(' ')).join(', ');
}

export function yearWords(y: number): string {
  return numberWords(y, 'f');
}

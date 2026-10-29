// Loads all bundled content and builds lookup indexes.
import type { Lesson, LessonText, PronunciationGuide, Word } from '../content/types.ts';
import { fold, normalize, splitAlt, stems } from './norsk.ts';
import { numberWords, ordinalWords } from './numbers.ts';
import { PLAN } from './plan.ts';

const lessonMods = import.meta.glob('../content/lesson-*.json', { eager: true, import: 'default' }) as Record<string, Lesson>;
const vocabMods = import.meta.glob('../content/vocab-*.json', { eager: true, import: 'default' }) as Record<string, Word[]>;
const guideMods = import.meta.glob('../content/aussprache.json', { eager: true, import: 'default' }) as Record<string, PronunciationGuide>;

export const lessons: Lesson[] = Object.values(lessonMods).sort((a, b) => a.n - b.n);
export const lessonByN = new Map(lessons.map((l) => [l.n, l]));
export const aussprache: PronunciationGuide | undefined = Object.values(guideMods)[0];
export const LESSON_COUNT = PLAN.length;

// A word that several lessons list is kept once, in the first lesson that has
// it; a later lesson can add forms (comparison) the first one didn't give.
const firstByKey = new Map<string, Word>();
export const words: Word[] = Object.entries(vocabMods)
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([, list]) => list)
  .filter((w) => {
    const k = `${normalize(w.no)}|${w.pos}`;
    const first = firstByKey.get(k);
    if (!first) {
      firstByKey.set(k, w);
      return true;
    }
    if (w.forms && (first.forms?.length ?? 0) < w.forms.length) first.forms = w.forms;
    if (w.alt) first.alt = [...new Set([...(first.alt ?? []), ...w.alt])];
    return false;
  });
export const wordById = new Map(words.map((w) => [w.id, w]));
export const verbs = words.filter((w) => w.pos === 'verb' && w.vf);

export function wordsOfLesson(n: number): Word[] {
  return words.filter((w) => w.lesson === n);
}

export function textById(n: number, id: string): LessonText | undefined {
  const L = lessonByN.get(n);
  if (!L) return undefined;
  return [L.text, ...L.extra].find((t) => t.id === id);
}

export const ARTICLE: Record<string, string> = { m: 'en', f: 'ei', n: 'et' };
export const GENDER_DE: Record<string, string> = { m: 'maskulin', f: 'feminin', n: 'neutrum' };

/** The word as shown on a card: "en bil", "ei bok", "et hus", "å snakke", "stor". */
export function display(w: Word): string {
  if (w.pos === 'noun' && w.gender && !w.plOnly) return `${ARTICLE[w.gender]} ${w.no}`;
  if (w.pos === 'verb') return `å ${w.no}`;
  return w.no;
}

/** Every Norwegian answer accepted for a word card (with and without article or å). */
export function acceptedNo(w: Word, extra: string[] = []): string[] {
  const base = [w.no, ...(w.alt ?? []), ...extra];
  const out = new Set<string>(base);
  for (const b of base) {
    if (w.pos === 'noun' && w.gender && !w.plOnly) {
      out.add(`${ARTICLE[w.gender]} ${b}`);
      if (w.gender === 'f') out.add(`en ${b}`);
    }
    if (w.pos === 'verb') out.add(`å ${b}`);
  }
  return [...out];
}

// ---------- dictionary for tap-to-translate ----------

export interface DictEntry {
  no: string; // dictionary form
  de: string;
  pos?: string;
  form?: string; // German label of the form tapped: "bestimmt Plural", "Präteritum"
  wordId?: string;
  note?: string;
  gloss?: boolean; // from a text glossary (meaning in that context)
}

const NOUN_FORMS = ['unbestimmt Singular', 'bestimmt Singular', 'unbestimmt Plural', 'bestimmt Plural'];
const ADJ_FORMS = ['Grundform', 'Neutrum', 'Plural / bestimmt', 'Komparativ', 'Superlativ'];
const VERB_FORMS = ['Präsens', 'Präteritum', 'Perfekt (Partizip)', 'Imperativ'];

const dict = new Map<string, DictEntry[]>();
let built = false;

function add(key: string, e: DictEntry) {
  const k = normalize(key);
  if (!k) return;
  const list = dict.get(k) ?? [];
  if (!list.some((x) => x.no === e.no && x.de === e.de && x.form === e.form)) list.push(e);
  dict.set(k, list);
}

/** Adds every spelling variant; a phrase is also found from its first word. */
function addForm(form: string, e: DictEntry) {
  for (const v of splitAlt(form)) {
    const parts = normalize(v).split(' ');
    if (parts.length === 1) add(v, e);
    else if (e.pos === 'verb' || e.pos === 'noun') add(parts[0], e); // "glede seg", "stå opp"
    else if (e.pos === 'adj') add(parts[parts.length - 1], e); // "mer praktisk": found from "praktisk", not "mer"
    else if (parts[0].length >= 3) add(parts[0], { ...e, form: e.form ?? 'Wendung' });
  }
}

export function buildDictionary(): void {
  if (built) return;
  built = true;
  for (const w of words) {
    const e: DictEntry = { no: display(w), de: w.de, pos: w.pos, wordId: w.id, note: w.note };
    addForm(w.no, e);
    w.alt?.forEach((a) => addForm(a, e));
    if (w.pos === 'noun' && w.forms) {
      w.forms.forEach((f, i) => {
        if (i === 0) return;
        addForm(f, { ...e, form: NOUN_FORMS[i] });
        // genitive: bilens, husets
        for (const v of splitAlt(f)) add(v + 's', { ...e, form: `${NOUN_FORMS[i]}, Genitiv` });
        // feminine nouns are also written with -en: boka / boken
        if (i === 1 && w.gender === 'f') for (const v of splitAlt(f)) if (v.endsWith('a')) add(v.slice(0, -1) + 'en', { ...e, form: NOUN_FORMS[1] });
      });
    }
    if (w.pos === 'adj' && w.forms) {
      w.forms.forEach((f, i) => i > 0 && addForm(f, { ...e, form: ADJ_FORMS[i] }));
      if (w.forms[4]) for (const v of splitAlt(w.forms[4])) add(v + 'e', { ...e, form: 'Superlativ, bestimmt' });
    }
    // pronouns and others with forms: min – mi – mitt – mine, annen – annet – andre
    if (w.pos !== 'noun' && w.pos !== 'adj' && w.pos !== 'verb' && w.forms) w.forms.forEach((f, i) => i > 0 && addForm(f, e));
    if (w.pos === 'verb' && w.vf) {
      w.vf.forEach((f, i) => {
        if (!f) return;
        addForm(f, { ...e, form: VERB_FORMS[i] });
        if (i === 1 && w.vg === '1') for (const v of splitAlt(f)) if (v.endsWith('et')) addForm(v.slice(0, -2) + 'a', { ...e, form: VERB_FORMS[1] });
      });
      // s-passive and participles used as adjectives
      add(w.no.split(' ')[0] + 's', { ...e, form: 'Passiv (s-Form)' });
    }
  }
  addFunctionWords();
  const gloss = (no: string, de: string) => addForm(no, { no, de, gloss: true });
  for (const L of lessons) {
    for (const t of [L.text, ...L.extra]) t.glossary.forEach((g) => gloss(g.no, g.de));
    L.wk.phrases.forEach((p) => gloss(p.no, p.de));
  }
}

// The smallest words, which no lesson lists as vocabulary.
const FUNCTION_WORDS: [string, string, string?][] = [
  ['en', 'ein, eine (maskulin; auch feminin)', 'unbestimmter Artikel'],
  ['ei', 'eine (feminin)', 'unbestimmter Artikel'],
  ['et', 'ein (neutrum)', 'unbestimmter Artikel'],
  ['ett', 'eins; ein (neutrum, betont)'],
  ['å', 'zu (vor dem Infinitiv)', 'Infinitivzeichen'],
  ['og', 'und'],
  ['i', 'in, im'],
  ['på', 'auf, an, in'],
  ['til', 'zu, nach, bis'],
  ['fra', 'von, aus'],
  ['med', 'mit'],
  ['av', 'von, aus'],
  ['for', 'für; denn'],
  ['om', 'über; ob; in (zeitlich)'],
  ['men', 'aber'],
  ['eller', 'oder'],
  ['som', 'der, die, das (Relativpronomen); wie, als'],
  ['at', 'dass'],
  ['ikke', 'nicht'],
  ['ja', 'ja'],
  ['nei', 'nein'],
  ['jo', 'doch'],
  ['den', 'er, sie, es (für en-/ei-Wörter); der, die, das'],
  ['det', 'es; das'],
  ['de', 'sie (Plural); die'],
  ['dem', 'sie, ihnen (Objektform von de)'],
  ['én', 'ein, eine (betont: genau einer, eine)'],
  ['oi', 'oh! hoppla!', 'Ausruf'],
  ['åh', 'ach! oh!', 'Ausruf'],
  ['aha', 'aha!', 'Ausruf'],
  ['hm', 'hm', 'Ausruf'],
  ['mmm', 'mmm (lecker!)', 'Ausruf'],
  ['æsj', 'igitt!', 'Ausruf'],
  ['uff', 'uff! oje!', 'Ausruf'],
  ['jaså', 'ach so?', 'Ausruf'],
  // Days and months: written in lower case in Norwegian.
  ['mandag', 'Montag'],
  ['tirsdag', 'Dienstag'],
  ['onsdag', 'Mittwoch'],
  ['torsdag', 'Donnerstag'],
  ['fredag', 'Freitag'],
  ['lørdag', 'Samstag'],
  ['søndag', 'Sonntag'],
  ['januar', 'Januar'],
  ['februar', 'Februar'],
  ['mars', 'März'],
  ['april', 'April'],
  ['mai', 'Mai'],
  ['juni', 'Juni'],
  ['juli', 'Juli'],
  ['august', 'August'],
  ['september', 'September'],
  ['oktober', 'Oktober'],
  ['november', 'November'],
  ['desember', 'Dezember'],
];

export interface LookupResult {
  entries: DictEntry[];
  parts?: [DictEntry, DictEntry]; // a compound: barne + tog
  name?: boolean; // probably a name (capitalised, unknown)
}

function addFunctionWords() {
  // numbers in words: tjuefem, trettiåtte, hundre, første …
  for (let n = 0; n <= 100; n++) {
    for (const old of [false, true]) {
      const no = numberWords(n, { old });
      if (!dict.has(no)) add(no, { no, de: String(n), form: 'Zahl' });
    }
    if (n > 0 && n < 100) {
      const o = ordinalWords(n);
      if (!dict.has(o)) add(o, { no: o, de: `${n}.`, form: 'Ordnungszahl' });
    }
  }
  add('tusen', { no: 'tusen', de: '1000', form: 'Zahl' });
  for (const [no, de, form] of FUNCTION_WORDS) {
    if (!dict.has(no)) add(no, { no, de, form });
    // weekdays also with -en / -er: mandagen, mandager
    if (/dag$/.test(no)) for (const f of ['en', 'er', 'ene', 's']) if (!dict.has(no + f)) add(no + f, { no, de, form });
  }
}

/** sentenceStart: the word opens a sentence, so a capital letter says nothing about it being a name. */
export function lookup(word: string, sentenceStart = false): LookupResult {
  buildDictionary();
  const k = normalize(word);
  const capital = /^[A-ZÆØÅ]/.test(word) && !sentenceStart;
  const person = capital ? PEOPLE[k] : undefined;
  const exact = dict.get(k);
  if (person) return { entries: [person, ...sortEntries(exact ?? [])] };
  if (exact) return { entries: sortEntries(exact) };
  for (const s of stems(k)) {
    const hit = dict.get(s);
    if (hit) return { entries: sortEntries(hit) };
  }
  // A capitalised unknown word is most likely a name (Aker, Finland), not a compound.
  if (capital) return { entries: [], name: true };
  // tv-kanalene: the parts are known words
  if (k.includes('-')) {
    const [a, ...rest] = k.split('-');
    const pa = lookup(a).entries[0];
    const pb = lookup(rest.join('-')).entries[0];
    if (pa && pb) return { entries: [], parts: [pa, pb] };
  }
  const parts = compound(k);
  // Unknown and written with a capital at the start of a sentence: a name (Henrik, Bergen).
  return { entries: [], parts, name: !parts && /^[A-ZÆØÅ]/.test(word) };
}

// The people of the story, so that tapping a name says who it is.
const PEOPLE: Record<string, DictEntry> = Object.fromEntries(
  (
    [
      ['susanne', 'Susanne Becker, 24, Studentin aus Freiburg'],
      ['matthias', 'Matthias Steiner, 26, Ingenieur aus Bern'],
      ['torunn', 'Torunn Haugen, die Lehrerin im Sprachkurs'],
      ['elin', 'Elin, Schwedin aus Göteborg, im Sprachkurs'],
      ['mads', 'Mads, Däne aus Aarhus, im Sprachkurs'],
      ['anna', 'Anna Nygård, 25, Medizinstudentin'],
      ['kari', 'Kari Nygård, Annas Mutter, Lehrerin'],
      ['per', 'Per Nygård, Annas Vater'],
      ['ola', 'Ola Nygård, 16, Annas Bruder'],
      ['ingrid', 'Ingrid, Annas Großmutter (bestemor)'],
      ['bamse', 'Bamse, der Hund der Familie Nygård'],
      ['jonas', 'Jonas, Annas Freund'],
      ['arne', 'Onkel Arne, Karis Bruder aus Ålesund'],
      ['inga', 'Inga Eira, Samin aus Kautokeino, Susannes Mitbewohnerin in Tromsø'],
      ['erik', 'Erik Hansen aus Svolvær, arbeitet auf der Hurtigrute'],
      ['nygård', 'die Familie Nygård in Oslo'],
    ] as const
  ).map(([k, de]) => [k, { no: k[0].toUpperCase() + k.slice(1), de, form: 'Person in der Geschichte' }]),
);

// Vocabulary entries first, then single-word glossary entries, then phrases.
function sortEntries(list: DictEntry[]): DictEntry[] {
  const rank = (e: DictEntry) => (e.wordId ? 0 : e.no.includes(' ') ? 2 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b));
}

/** Splits an unknown compound into two known words: "barnetoget" → barn(e) + toget. */
function compound(w: string): [DictEntry, DictEntry] | undefined {
  if (w.length < 6) return undefined;
  // Norwegian compounds end in a noun (sometimes an adjective) and start with a noun, adjective or verb.
  const headOk = (e: DictEntry) => e.pos === 'noun' || e.pos === 'adj';
  const modOk = (e: DictEntry) => e.pos === 'noun' || e.pos === 'adj' || e.pos === 'verb';
  for (let i = 3; i <= w.length - 3; i++) {
    const head = w.slice(i);
    const headHit = [...(dict.get(head) ?? []), ...stems(head).flatMap((s) => dict.get(s) ?? [])].find(headOk);
    if (!headHit) continue;
    const mod = w.slice(0, i);
    const modHit = [...(dict.get(mod) ?? []), ...(/[se]$/.test(mod) ? dict.get(mod.slice(0, -1)) ?? [] : [])].find(modOk);
    if (modHit) return [modHit, headHit];
  }
  return undefined;
}

/** Search the vocabulary in both directions (for the word list). */
export function searchWords(q: string): Word[] {
  const n = fold(q);
  if (!n) return [];
  const de = (w: Word) => [w.de, ...(w.deAlt ?? [])].join(' ').toLowerCase();
  const hits = words.filter((w) => fold(w.no).includes(n) || de(w).includes(q.toLowerCase().trim()));
  const score = (w: Word) => (fold(w.no) === n ? 0 : fold(w.no).startsWith(n) ? 1 : de(w).startsWith(q.toLowerCase()) ? 2 : 3);
  return hits.sort((a, b) => score(a) - score(b) || a.lesson - b.lesson).slice(0, 60);
}

// Loads all bundled content and builds lookup indexes.
import type { EmailTask, GrammarLesson, Level, Reading, Scene, Verb, VocabItem } from '../content/types.ts';
import { LEVELS } from '../content/types.ts';
import { expandVariants, lenient, lookupKeys, prefixVariants } from './hebrew.ts';
import { getState } from './store.ts';

const mods = import.meta.glob('../content/*.json', { eager: true, import: 'default' }) as Record<string, unknown[]>;

function collect<T>(prefix: string): T[] {
  return Object.entries(mods)
    .filter(([k]) => (k.split('/').pop() ?? '').startsWith(prefix))
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([, v]) => v as T[]);
}

export const levelRank = (l: Level | string) => Math.max(0, LEVELS.indexOf(l as Level));
const byLevel = <T extends { level: Level }>(a: T, b: T) => levelRank(a.level) - levelRank(b.level);

export const vocab: VocabItem[] = collect<VocabItem>('vocab');
export const verbs: Verb[] = collect<Verb>('verbs').sort(byLevel);
export const readings: Reading[] = collect<Reading>('readings').sort(byLevel);
export const scenes: Scene[] = collect<Scene>('scenes').sort(byLevel);
export const grammar: GrammarLesson[] = collect<GrammarLesson>('grammar').sort(byLevel);
export const emails: EmailTask[] = collect<EmailTask>('emails').sort(byLevel);

const vocabById = new Map(vocab.map((v) => [v.id, v]));
export const verbById = new Map(verbs.map((v) => [v.id, v]));

export function allVocab(): VocabItem[] {
  return [...vocab, ...getState().custom];
}

export function findVocab(id: string): VocabItem | undefined {
  return vocabById.get(id) ?? getState().custom.find((c) => c.id === id);
}

export const TOPIC_LABELS: Record<string, string> = {
  work: 'Work & office',
  meetings: 'Meetings',
  email: 'Email & calls',
  money: 'Money & banking',
  sales: 'Sales & clients',
  tech: 'Tech & startups',
  'phrases-biz': 'Business phrases',
  bureaucracy: 'Bureaucracy',
  home: 'Home & renting',
  food: 'Food',
  shopping: 'Shopping',
  transport: 'Transport',
  health: 'Health',
  social: 'People & feelings',
  time: 'Time',
  travel: 'Travel',
  'phrases-daily': 'Everyday phrases',
  slang: 'Slang',
  news: 'News',
  society: 'Society',
  abstract: 'Ideas & abstract',
  connectors: 'Connectors',
  economy: 'Economy',
  environment: 'Environment & science',
  custom: 'My words',
};

const BUSINESS_TOPICS = new Set(['work', 'meetings', 'email', 'money', 'sales', 'tech', 'phrases-biz', 'economy']);

/** Order in which new words are introduced, based on focus and level. */
export function newWordOrder(): VocabItem[] {
  const { focus, } = getState().settings;
  const userRank = levelRank(getState().level);
  const vocabLevelRank = (l: string) => (l === 'A2' ? 0 : l === 'B1' ? 2 : 4);
  const score = (v: VocabItem) => {
    // distance from the learner's level, slightly preferring easier words
    const lr = vocabLevelRank(v.level);
    let s = lr <= userRank ? (userRank - lr) * 0.6 : (lr - userRank) * 1.5;
    const biz = BUSINESS_TOPICS.has(v.topic);
    if (focus === 'business' && !biz) s += 1.2;
    if (focus === 'daily' && biz) s += 1.2;
    return s;
  };
  const indexed = allVocab().map((v, i) => ({ v, k: score(v) + (i % 7) * 0.01 }));
  // interleave topics: stable sort by score, then by position within topic
  const topicPos = new Map<string, number>();
  const withPos = indexed.map(({ v, k }) => {
    const p = topicPos.get(v.topic) ?? 0;
    topicPos.set(v.topic, p + 1);
    return { v, k: k + p * 0.004 };
  });
  return withPos.sort((a, b) => a.k - b.k).map((x) => x.v);
}

// ---------- Dictionary for tap-to-gloss ----------

export interface DictEntry {
  he: string; // dictionary form
  en: string;
  tr?: string;
  root?: string;
  pos?: string;
  form?: string; // e.g. "past · we"
  vocabId?: string;
  verbId?: string;
  note?: string;
}

const PRONOUN_LABEL: Record<string, string> = {
  '1s': 'I',
  '2ms': 'you (m)',
  '2fs': 'you (f)',
  '3ms': 'he',
  '3fs': 'she',
  '1p': 'we',
  '2mp': 'you (pl)',
  '2fp': 'you (f pl)',
  '3p': 'they',
  ms: 'm sg',
  fs: 'f sg',
  mp: 'm pl',
  fp: 'f pl',
};

const primary = new Map<string, DictEntry[]>();
const secondary = new Map<string, DictEntry[]>();
let built = false;

function add(map: Map<string, DictEntry[]>, key: string, e: DictEntry) {
  if (!key) return;
  const list = map.get(key) ?? [];
  if (!list.some((x) => x.he === e.he && x.en === e.en && x.form === e.form)) list.push(e);
  map.set(key, list);
}

function addWord(word: string, e: DictEntry) {
  for (const w of expandVariants(word)) {
    const key = lenient(w);
    if (!key) continue;
    if (!key.includes(' ')) {
      add(primary, key, e);
      continue;
    }
    // Compounds and phrases (סטארט-אפ, שכר דירה): findable from their first word.
    const first = key.split(' ')[0];
    if (first.length >= 3) add(primary, first, { ...e, form: e.form ?? 'phrase' });
  }
}

export function invalidateDictionary() {
  built = false;
  primary.clear();
  secondary.clear();
}

export function buildDictionary() {
  if (built) return;
  built = true;
  for (const v of allVocab()) {
    const e: DictEntry = { he: v.he, en: v.en, tr: v.tr, root: v.root, pos: v.pos, vocabId: v.id, note: v.note };
    addWord(v.he, e);
    v.alt?.forEach((a) => addWord(a, e));
    if (v.plural) addWord(v.plural, { ...e, form: 'plural' });
  }
  for (const vb of verbs) {
    const base: DictEntry = { he: vb.inf, en: vb.en, tr: vb.tr, root: vb.root, pos: 'verb', verbId: vb.id };
    addWord(vb.inf, { ...base, form: 'infinitive' });
    const tenses: [string, Record<string, [string, string]> | undefined][] = [
      ['present', vb.present],
      ['past', vb.past],
      ['future', vb.future],
      ['imperative', vb.imp],
    ];
    for (const [tense, table] of tenses) {
      if (!table) continue;
      for (const [p, f] of Object.entries(table)) {
        addWord(f[0], { ...base, form: `${tense} · ${PRONOUN_LABEL[p] ?? p}`, tr: f[1] });
      }
    }
  }
  const gloss = (he: string, en: string, tr?: string) => {
    addWord(he, { he, en, tr });
    // Multi-word entries ("להשתמש ב", "יוקר המחיה") are also found from their first word.
    const words = lenient(he).split(' ');
    if (words.length > 1 && words[0].length >= 3) add(primary, words[0], { he, en, tr, form: 'phrase' });
  };
  readings.forEach((r) => r.glossary.forEach((g) => gloss(g.he, g.en, g.tr)));
  scenes.forEach((s) => s.expressions.forEach((x) => gloss(x.he, x.en)));
  emails.forEach((m) => m.phrases.forEach((p) => gloss(p.he, p.en, p.tr)));
  for (const [key, entries] of primary) {
    for (const k of lookupKeys(key).slice(1)) {
      if (k.length >= 3 && !primary.has(k)) entries.forEach((e) => add(secondary, k, e));
    }
  }
}

const PREFIX_MEANING: Record<string, string> = {
  'ו': 'and',
  'ה': 'the',
  'ב': 'in / at',
  'כ': 'like / as',
  'ל': 'to / for',
  'מ': 'from',
  'ש': 'that / which',
};

export interface LookupResult {
  entries: DictEntry[];
  prefix: string; // stripped prefix letters, e.g. "וב"
  prefixMeaning: string;
}

export function lookup(word: string): LookupResult {
  buildDictionary();
  const l = lenient(word);
  const variants = prefixVariants(l);
  for (const v of variants) {
    const hit = primary.get(v);
    if (hit) return withPrefix(l, v, hit);
  }
  for (const k of lookupKeys(word)) {
    const hit = primary.get(k) ?? secondary.get(k);
    if (hit) {
      const base = variants.find((v) => v.startsWith(k)) ?? l;
      return withPrefix(l, base, hit);
    }
  }
  return { entries: [], prefix: '', prefixMeaning: '' };
}

function withPrefix(full: string, base: string, entries: DictEntry[]): LookupResult {
  const prefix = full.slice(0, full.length - base.length);
  const prefixMeaning = [...prefix].map((c) => `${c}- ${PREFIX_MEANING[c] ?? ''}`).join(' · ');
  return { entries, prefix, prefixMeaning };
}

// ---------- Roots ----------

export function rootKey(root?: string): string {
  return root ? lenient(root).replace(/[^א-ת]/g, '') : '';
}

export function rootFamily(root?: string): { vocab: VocabItem[]; verbs: Verb[] } {
  const k = rootKey(root);
  if (!k) return { vocab: [], verbs: [] };
  return {
    vocab: allVocab().filter((v) => rootKey(v.root) === k),
    verbs: verbs.filter((v) => rootKey(v.root) === k),
  };
}

export function allRoots(): { root: string; count: number }[] {
  const m = new Map<string, { root: string; count: number }>();
  for (const v of [...allVocab(), ...verbs]) {
    const k = rootKey(v.root);
    if (k.length < 3) continue;
    const cur = m.get(k) ?? { root: v.root!, count: 0 };
    cur.count++;
    m.set(k, cur);
  }
  return [...m.values()].filter((r) => r.count >= 2).sort((a, b) => b.count - a.count);
}

export function displayRoot(root: string): string {
  return [...root.replace(/[^א-ת]/g, '')].join('.');
}

export function levelsUpTo(level: Level): Level[] {
  return LEVELS.slice(0, levelRank(level) + 1);
}

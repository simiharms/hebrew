// Builds practice sessions for words and verbs.
import type { Form, Verb, VocabItem } from '../content/types.ts';
import { findVocab, levelRank, newWordOrder, verbById, verbs } from './content.ts';
import type { CardState } from './fsrs.ts';
import { lenient, prefixVariants, splitWords } from './hebrew.ts';
import { getState, today } from './store.ts';
import { ttsSupported } from './tts.ts';

export type WordMode = 'intro' | 'en2he' | 'he2en' | 'listen' | 'cloze';

export interface WordTask {
  cardId: string;
  item: VocabItem;
  mode: WordMode;
  isNew: boolean;
  retry?: boolean;
  tries?: number; // in-session retries after a wrong answer
}

export function dueWordCards(now = Date.now()): [string, CardState][] {
  return Object.entries(getState().cards)
    .filter(([id, c]) => id.startsWith('v:') && c.due <= now)
    .sort((a, b) => a[1].due - b[1].due);
}

export function newWordsToday(): number {
  const log = getState().days.find((d) => d.date === today());
  return log?.newWords ?? 0;
}

export function newWordsLeft(): number {
  return Math.max(0, getState().settings.newPerDay - newWordsToday());
}

export function pickNewWords(n: number): VocabItem[] {
  const s = getState();
  const out: VocabItem[] = [];
  const seen = new Set<string>();
  for (const id of s.queue) {
    const v = findVocab(id);
    if (v && !s.cards[`v:${id}`] && !seen.has(id)) {
      out.push(v);
      seen.add(id);
    }
    if (out.length >= n) return out;
  }
  for (const v of newWordOrder()) {
    if (out.length >= n) break;
    if (!s.cards[`v:${v.id}`] && !seen.has(v.id)) {
      out.push(v);
      seen.add(v.id);
    }
  }
  return out;
}

export function findCloze(item: VocabItem): { before: string; prefix: string; answer: string; after: string } | null {
  const sentence = item.ex.he;
  const targets = new Set([item.he, item.plural, ...(item.alt ?? [])].filter(Boolean).map((x) => lenient(x!)));
  if (item.he.includes(' ')) {
    const idx = sentence.indexOf(item.he);
    if (idx < 0) return null;
    return { before: sentence.slice(0, idx), prefix: '', answer: item.he, after: sentence.slice(idx + item.he.length) };
  }
  const parts = splitWords(sentence);
  let pos = 0;
  for (const p of parts) {
    if (p.isWord) {
      const variants = prefixVariants(lenient(p.w));
      const hit = variants.findIndex((v) => targets.has(v));
      if (hit >= 0) {
        const prefixLen = lenient(p.w).length - variants[hit].length;
        return {
          before: sentence.slice(0, pos),
          prefix: p.w.slice(0, prefixLen),
          answer: p.w.slice(prefixLen),
          after: sentence.slice(pos + p.w.length),
        };
      }
    }
    pos += p.w.length;
  }
  return null;
}

function pickMode(item: VocabItem, card: CardState): WordMode {
  const r = Math.random();
  if (card.s < 3) return r < 0.8 ? 'en2he' : 'he2en';
  const canCloze = !!findCloze(item);
  const canListen = ttsSupported();
  if (r < 0.45) return 'en2he';
  if (r < 0.7 && canCloze) return 'cloze';
  if (r < 0.9 && canListen) return 'listen';
  return r < 0.95 ? 'he2en' : 'en2he';
}

export function buildWordSession(maxReviews = 40): WordTask[] {
  const reviews: WordTask[] = [];
  for (const [id, card] of dueWordCards().slice(0, maxReviews)) {
    const item = findVocab(id.slice(2));
    if (item) reviews.push({ cardId: id, item, mode: pickMode(item, card), isNew: false });
  }
  const fresh = pickNewWords(newWordsLeft()).map<WordTask>((item) => ({
    cardId: `v:${item.id}`,
    item,
    mode: 'intro',
    isNew: true,
  }));
  // Interleave: two reviews, then one new word.
  const out: WordTask[] = [];
  let ri = 0;
  let ni = 0;
  while (ri < reviews.length || ni < fresh.length) {
    for (let k = 0; k < 2 && ri < reviews.length; k++) out.push(reviews[ri++]);
    if (ni < fresh.length) out.push(fresh[ni++]);
  }
  return out;
}

export function acceptedHebrew(item: VocabItem, cardId: string): string[] {
  return [item.he, ...(item.alt ?? []), ...(getState().extraAnswers[cardId] ?? [])];
}

// ---------- Verbs ----------

export type Tense = 'present' | 'past' | 'future';
export const TENSES: Tense[] = ['present', 'past', 'future'];

export interface VerbTask {
  cardId: string;
  verb: Verb;
  tense: Tense;
  person: string;
  pronoun: string;
  pronounEn: string;
  answer: Form;
}

const PRESENT_PRONOUNS: Record<string, [string, string][]> = {
  ms: [['אני', 'I (m)'], ['אתה', 'you (m)'], ['הוא', 'he']],
  fs: [['אני', 'I (f)'], ['את', 'you (f)'], ['היא', 'she']],
  mp: [['אנחנו', 'we (m)'], ['אתם', 'you (m pl)'], ['הם', 'they (m)']],
  fp: [['אנחנו', 'we (f)'], ['אתן', 'you (f pl)'], ['הן', 'they (f)']],
};
const PERSON_PRONOUNS: Record<string, [string, string][]> = {
  '1s': [['אני', 'I']],
  '2ms': [['אתה', 'you (m)']],
  '2fs': [['את', 'you (f)']],
  '3ms': [['הוא', 'he']],
  '3fs': [['היא', 'she']],
  '1p': [['אנחנו', 'we']],
  '2mp': [['אתם', 'you (pl)']],
  '2fp': [['אתן', 'you (f pl)']],
  '3p': [['הם', 'they (m)'], ['הן', 'they (f)']],
};
const FUTURE_PRONOUNS: Record<string, [string, string][]> = {
  ...PERSON_PRONOUNS,
  '2mp': [['אתם', 'you (m pl)'], ['אתן', 'you (f pl)']],
};

const rand = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

export function makeVerbTask(verb: Verb, tense: Tense, exclude?: string): VerbTask {
  const table = verb[tense] as Record<string, Form>;
  const persons = Object.keys(table).filter((p) => p !== exclude);
  const person = rand(persons);
  const pr = rand((tense === 'present' ? PRESENT_PRONOUNS : tense === 'future' ? FUTURE_PRONOUNS : PERSON_PRONOUNS)[person]);
  return {
    cardId: `c:${verb.id}:${tense}`,
    verb,
    tense,
    person,
    pronoun: pr[0],
    pronounEn: pr[1],
    answer: table[person],
  };
}

/** Verb-tense combinations in teaching order: chunks of 6 verbs, present → past → future. */
export function verbCardOrder(): { verb: Verb; tense: Tense }[] {
  const lr = levelRank(getState().level);
  const dist = (v: Verb) => {
    const d = levelRank(v.level) - lr;
    return d <= 0 ? -d * 0.5 : d * 1.5;
  };
  const sorted = [...verbs].sort((a, b) => dist(a) - dist(b));
  const out: { verb: Verb; tense: Tense }[] = [];
  for (let i = 0; i < sorted.length; i += 6) {
    const chunk = sorted.slice(i, i + 6);
    for (const t of TENSES) for (const v of chunk) out.push({ verb: v, tense: t });
  }
  return out;
}

export function buildVerbSession(onlyVerb?: string, size = 12): VerbTask[] {
  const s = getState();
  const now = Date.now();
  if (onlyVerb) {
    const v = verbById.get(onlyVerb);
    if (!v) return [];
    const tasks: VerbTask[] = [];
    for (let i = 0; i < size; i++) tasks.push(makeVerbTask(v, TENSES[i % 3]));
    return tasks;
  }
  const due = Object.entries(s.cards)
    .filter(([id, c]) => id.startsWith('c:') && c.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => {
      const [, vid, tense] = id.split(':');
      return { verb: verbById.get(vid)!, tense: tense as Tense };
    })
    .filter((x) => x.verb);
  const half = Math.ceil(size / 2);
  const picked = due.slice(0, half);
  const fresh = verbCardOrder().filter((x) => !s.cards[`c:${x.verb.id}:${x.tense}`]);
  const newCap = picked.length >= half ? 1 : Math.min(4, half - picked.length);
  picked.push(...fresh.slice(0, newCap));
  const tasks: VerbTask[] = [];
  for (const p of picked) {
    const t1 = makeVerbTask(p.verb, p.tense);
    tasks.push(t1);
    if (tasks.length < size) tasks.push(makeVerbTask(p.verb, p.tense, t1.person));
  }
  // shuffle lightly so the two prompts for one card aren't adjacent
  for (let i = tasks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
  }
  return tasks.slice(0, size);
}

export function dueVerbCount(now = Date.now()): number {
  return Object.entries(getState().cards).filter(([id, c]) => id.startsWith('c:') && c.due <= now).length;
}

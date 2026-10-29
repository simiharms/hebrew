// Spaced repetition of words, verb forms and Wörterkiste phrases.
// Card ids: "w:<wordId>" a word, "v:<wordId>" a verb's forms, "p:<lesson>:<i>" a phrase.
import type { Phrase, Word } from '../content/types.ts';
import { lessonByN, wordById, words } from './content.ts';
import { type Rating, review } from './fsrs.ts';
import { type AppState, getState, setState, today, todayLog } from './store.ts';

export type CardRef = { kind: 'word'; id: string; word: Word } | { kind: 'phrase'; id: string; phrase: Phrase; lesson: number };

export function resolveCard(id: string): CardRef | undefined {
  if (id.startsWith('w:')) {
    const word = wordById.get(id.slice(2));
    return word ? { kind: 'word', id, word } : undefined;
  }
  if (id.startsWith('p:')) {
    const [, n, i] = id.split(':');
    const phrase = lessonByN.get(Number(n))?.wk.phrases[Number(i)];
    return phrase ? { kind: 'phrase', id, phrase, lesson: Number(n) } : undefined;
  }
  return undefined;
}

/** Word and phrase cards due now, oldest due first. */
export function dueCards(s: AppState, now = Date.now()): string[] {
  return Object.entries(s.cards)
    .filter(([id, c]) => c.due <= now && (id.startsWith('w:') || id.startsWith('p:')) && resolveCard(id))
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

export function dueCount(s: AppState, now = Date.now()): number {
  return dueCards(s, now).length;
}

/** New words in course order: words the learner picked first, then the lessons up to the current one. */
export function newWordQueue(s: AppState, lesson?: number): Word[] {
  if (lesson) return words.filter((w) => w.lesson === lesson && !s.cards[`w:${w.id}`]);
  const picked = s.queue.map((id) => wordById.get(id)).filter((w): w is Word => !!w && !s.cards[`w:${w.id}`]);
  const pool = words.filter((w) => !s.cards[`w:${w.id}`] && w.lesson <= s.lesson && !s.queue.includes(w.id));
  return [...picked, ...pool.sort((a, b) => a.lesson - b.lesson)];
}

export function queueWord(id: string): 'added' | 'known' | 'queued' {
  const s = getState();
  if (s.cards[`w:${id}`]) return 'known';
  if (s.queue.includes(id)) return 'queued';
  setState((st) => {
    st.queue.push(id);
  });
  return 'added';
}

/** How many new words are still allowed today. */
export function newLeftToday(s: AppState): number {
  const log = s.days.find((d) => d.date === today());
  return Math.max(0, s.settings.newPerDay - (log?.newWords ?? 0));
}

export function rateCard(id: string, g: Rating, isNew = false): void {
  setState((s) => {
    s.cards[id] = review(s.cards[id], g, Date.now(), s.settings.retention);
    if (isNew && id.startsWith('w:')) s.queue = s.queue.filter((q) => q !== id.slice(2));
    const log = todayLog(s);
    log.reviews++;
    if (g >= 3) log.correct++;
    if (isNew) log.newWords++;
  });
}

/** Learned = the card exists and was remembered at least once. */
export function lessonWordProgress(s: AppState, n: number): { learned: number; total: number } {
  const list = words.filter((w) => w.lesson === n);
  return { learned: list.filter((w) => s.cards[`w:${w.id}`]).length, total: list.length };
}

export function toggleStar(id: string): void {
  setState((s) => {
    s.starred = s.starred.includes(id) ? s.starred.filter((x) => x !== id) : [...s.starred, id];
  });
}

export function isStarred(id: string): boolean {
  return getState().starred.includes(id);
}

/**
 * For a learner who starts in the middle of the book: the words of the earlier
 * lessons count as known and come back as reviews, spread over the next weeks.
 */
export function seedKnownUpTo(lesson: number): number {
  const list = words.filter((w) => w.lesson < lesson);
  const now = Date.now();
  const DAY = 86_400_000;
  setState((s) => {
    list.forEach((w, i) => {
      const id = `w:${w.id}`;
      if (s.cards[id]) return;
      const spread = 1 + Math.floor((i / Math.max(1, list.length)) * 40);
      s.cards[id] = { due: now + spread * DAY, s: spread, d: 5, reps: 1, lapses: 0, last: now };
    });
  });
  return list.length;
}

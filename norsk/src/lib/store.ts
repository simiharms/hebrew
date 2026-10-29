// Persistent app state in localStorage, with a tiny subscribe mechanism.
import { useEffect, useState } from 'preact/hooks';
import type { CardState } from './fsrs.ts';

export interface Settings {
  newPerDay: number; // new words per day
  rate: number; // speech rate
  voiceURI?: string;
  retention: number; // target recall for the scheduler
  reviewMode: 'type' | 'flip'; // word reviews: type the answer, or turn the card and rate yourself
  direction: 'de2no' | 'no2de' | 'mixed'; // which side a word card asks
  fontScale: number; // 1, 1.15, 1.3
  showDe: boolean; // German translation under each line of a text
  theme: 'auto' | 'light' | 'dark';
}

export interface DoneEntry {
  at: number;
  score: number; // 0..1
}

export interface Mistake {
  kind: 'word' | 'verb' | 'drill' | 'number' | 'dictation' | 'translate';
  ref: string; // id of the item (e.g. "g03_adjektiv#4")
  prompt: string;
  answer: string;
  given: string;
  at: number;
}

export interface DayLog {
  date: string; // YYYY-MM-DD
  reviews: number;
  correct: number;
  newWords: number;
  tasks: string[]; // ids of steps done today
}

export interface AppState {
  version: 1;
  onboarded: boolean;
  lesson: number; // the lesson the learner is on (1..23)
  settings: Settings;
  cards: Record<string, CardState>; // "w:<wordId>" words, "v:<wordId>" verb forms, "p:<lesson>:<i>" Wörterkiste phrases
  done: Record<string, DoneEntry>; // "L3:text", "L3:g03_adjektiv", "L3:check" …
  mistakes: Mistake[];
  days: DayLog[];
  writings: Record<string, { text: string; at: number; self?: number }>;
  starred: string[]; // card ids
  queue: string[]; // word ids the learner picked to learn next (tapped in a text)
  extraAnswers: Record<string, string[]>; // answers the learner accepted as right, per card
  updatedAt?: number;
}

const KEY = 'nordlys-state-v1';

export function defaultState(): AppState {
  return {
    version: 1,
    onboarded: false,
    lesson: 1,
    settings: {
      newPerDay: 8,
      rate: 0.9,
      retention: 0.9,
      reviewMode: 'flip',
      direction: 'mixed',
      fontScale: 1.15,
      showDe: false,
      theme: 'auto',
    },
    cards: {},
    done: {},
    mistakes: [],
    days: [],
    writings: {},
    starred: [],
    queue: [],
    extraAnswers: {},
  };
}

/** Fills in fields that older saved states don't have yet. */
function withDefaults(saved: AppState): AppState {
  const base = defaultState();
  return { ...base, ...saved, settings: { ...base.settings, ...saved.settings } };
}

export function isAppState(x: unknown): x is AppState {
  const s = x as AppState | null;
  return !!s && s.version === 1 && typeof s.cards === 'object' && typeof s.lesson === 'number';
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return withDefaults(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function setState(update: (s: AppState) => void): void {
  const next: AppState = typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
  update(next);
  next.updatedAt = Date.now();
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable (private mode); keep working in memory
  }
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useAppState(): AppState {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force((n) => n + 1)), []);
  return state;
}

export function today(): string {
  return dayKey(new Date());
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayLog(s: AppState): DayLog {
  const t = today();
  let log = s.days.find((d) => d.date === t);
  if (!log) {
    log = { date: t, reviews: 0, correct: 0, newWords: 0, tasks: [] };
    s.days.push(log);
    if (s.days.length > 400) s.days.splice(0, s.days.length - 400);
  }
  return log;
}

/** Records a finished step (best score wins) and counts it for today. */
export function markDone(id: string, score: number): void {
  setState((s) => {
    const prev = s.done[id];
    s.done[id] = { at: Date.now(), score: Math.max(score, prev?.score ?? 0) };
    const log = todayLog(s);
    if (!log.tasks.includes(id)) log.tasks.push(id);
  });
}

export function addMistake(m: Omit<Mistake, 'at'>): void {
  setState((s) => {
    s.mistakes = s.mistakes.filter((x) => !(x.ref === m.ref && x.kind === m.kind));
    s.mistakes.push({ ...m, at: Date.now() });
    if (s.mistakes.length > 300) s.mistakes.splice(0, s.mistakes.length - 300);
  });
}

export function clearMistake(kind: Mistake['kind'], ref: string): void {
  if (!getState().mistakes.some((x) => x.ref === ref && x.kind === kind)) return;
  setState((s) => {
    s.mistakes = s.mistakes.filter((x) => !(x.ref === ref && x.kind === kind));
  });
}

/** Consecutive days (ending today or yesterday) with any activity. */
export function streak(s: AppState): number {
  const active = new Set(s.days.filter((d) => d.reviews > 0 || d.tasks.length > 0).map((d) => d.date));
  const d = new Date();
  if (!active.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (active.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function exportState(): string {
  return JSON.stringify({ app: 'nordlys', exportedAt: new Date().toISOString(), state }, null, 1);
}

export function importState(json: string): void {
  const parsed = JSON.parse(json);
  const incoming = parsed?.state ?? parsed;
  if (!isAppState(incoming)) throw new Error('Diese Datei ist keine Nordlys-Sicherung.');
  setState((s) => Object.assign(s, withDefaults(incoming)));
}

export function resetState(): void {
  setState((s) => Object.assign(s, defaultState()));
}

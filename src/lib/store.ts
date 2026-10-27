// Persistent app state in localStorage, with a tiny subscribe mechanism.
import { useEffect, useState } from 'preact/hooks';
import type { CardState } from './fsrs.ts';
import type { Level, VocabItem } from '../content/types.ts';
import type { Profile } from './skills.ts';

export type Focus = 'business' | 'daily' | 'both';

export interface Settings {
  newPerDay: number;
  rate: number; // speech rate
  voiceURI?: string;
  showTr: boolean;
  retention: number;
  focus: Focus;
  semantic: boolean; // experimental on-device AI grading
  dailyMinutes: number;
  deckDir: 'he2en' | 'en2he'; // which side of a flash card you see first
  verbsOnly: boolean; // the daily plan is all verb practice
}

export interface DoneEntry {
  at: number;
  score: number; // 0..1
}

export interface Mistake {
  kind: 'vocab' | 'verb' | 'drill' | 'number' | 'dictation';
  ref: string; // id of the item (e.g. "g_piel#3")
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
  tasks: string[]; // ids of plan items done today
}

export interface OwnText {
  id: string;
  title: string;
  text: string;
  at: number;
}

export interface AppState {
  version: 1;
  onboarded: boolean;
  level: Level;
  settings: Settings;
  cards: Record<string, CardState>;
  custom: VocabItem[];
  extraAnswers: Record<string, string[]>; // user-accepted answers per card id
  done: Record<string, DoneEntry>;
  mistakes: Mistake[];
  days: DayLog[];
  writings: Record<string, { text: string; at: number; self?: number }>;
  own: OwnText[];
  queue: string[]; // vocab ids the learner picked to learn next
  starred: string[]; // card ids starred in the card decks
  profile: Profile; // skill estimates (see skills.ts)
  courseUnit: number; // index of the course unit the learner is on
  courseVersion?: number; // 2 = the A1–C1 course (see migrate)
  updatedAt?: number; // time of the last change (ms), to tell which saved copy is newer
}

const KEY = 'shoresh-state-v1';

export function defaultState(): AppState {
  return {
    version: 1,
    onboarded: false,
    level: 'A2+',
    settings: {
      newPerDay: 8,
      rate: 0.9,
      showTr: true,
      retention: 0.9,
      focus: 'both',
      semantic: false,
      dailyMinutes: 20,
      deckDir: 'he2en',
      verbsOnly: false,
    },
    cards: {},
    custom: [],
    extraAnswers: {},
    done: {},
    mistakes: [],
    days: [],
    writings: {},
    own: [],
    queue: [],
    starred: [],
    profile: { skills: {}, topics: {} },
    courseUnit: 0,
    courseVersion: 2,
  };
}

// The first course had these 17 units, saved by index (unit:3:check). The
// A1–C1 course put 14 units in front of them and saves progress by unit id.
const LEGACY_UNIT_IDS = ['u_roots_present', 'u_et_prepositions', 'u_describing', 'u_binyanim', 'u_numbers_time', 'u_hifil', 'u_smichut', 'u_hitpael_nifal', 'u_weak_roots', 'u_she_time', 'u_modals', 'u_conditionals', 'u_connectors', 'u_formal', 'u_verbal_nouns', 'u_passive', 'u_opinion'];
const UNITS_BEFORE_LEGACY = 14;

function migrate(s: AppState): AppState {
  if ((s.courseVersion ?? 1) >= 2) return s;
  const rename = (k: string) => k.replace(/^unit:(\d+):/, (m, n) => (LEGACY_UNIT_IDS[Number(n)] ? `unit:${LEGACY_UNIT_IDS[Number(n)]}:` : m));
  const done: AppState['done'] = {};
  for (const [k, v] of Object.entries(s.done)) done[rename(k)] = v;
  return {
    ...s,
    done,
    days: s.days.map((d) => ({ ...d, tasks: d.tasks.map(rename) })),
    courseUnit: s.onboarded ? s.courseUnit + UNITS_BEFORE_LEGACY : s.courseUnit,
    courseVersion: 2,
  };
}

/** Fills in fields that older saved states don't have yet. */
function withDefaults(saved: AppState): AppState {
  const base = defaultState();
  return migrate({
    ...base,
    ...saved,
    courseVersion: saved.courseVersion,
    settings: { ...base.settings, ...saved.settings },
    profile: { ...base.profile, ...saved.profile },
  });
}

/** Whether a parsed JSON value looks like a Shoresh state. */
export function isAppState(x: unknown): x is AppState {
  const s = x as AppState | null;
  return !!s && s.version === 1 && typeof s.cards === 'object';
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
  const next = structuredClone(state);
  update(next);
  next.updatedAt = Date.now();
  commit(next);
}

/** Takes over a state saved elsewhere as it is, keeping its updatedAt. */
export function restoreState(saved: AppState): void {
  commit(withDefaults(saved));
}

function commit(next: AppState): void {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable (private mode); keep working in memory
  }
  listeners.forEach((l) => l());
}

export function replaceState(next: AppState): void {
  setState((s) => Object.assign(s, next));
}

/** Calls `l` after every change; returns the unsubscribe function. */
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
  const d = new Date();
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

export function markTask(task: string): void {
  setState((s) => {
    const log = todayLog(s);
    if (!log.tasks.includes(task)) log.tasks.push(task);
  });
}

export function markDone(id: string, score: number): void {
  setState((s) => {
    const prev = s.done[id];
    s.done[id] = { at: Date.now(), score: Math.max(score, prev?.score ?? 0) };
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
  setState((s) => {
    s.mistakes = s.mistakes.filter((x) => !(x.ref === ref && x.kind === kind));
  });
}

/** Consecutive days (ending today or yesterday) with any activity. */
export function streak(s: AppState): number {
  const active = new Set(s.days.filter((d) => d.reviews > 0 || d.tasks.length > 0).map((d) => d.date));
  const d = new Date();
  const fmt = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  if (!active.has(fmt(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (active.has(fmt(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function exportState(): string {
  return JSON.stringify({ app: 'shoresh', exportedAt: new Date().toISOString(), state }, null, 1);
}

export function importState(json: string): void {
  const parsed = JSON.parse(json);
  const incoming = parsed?.state ?? parsed;
  if (!isAppState(incoming)) throw new Error('This file is not a Shoresh backup.');
  replaceState(withDefaults(incoming));
}

export function resetState(): void {
  replaceState(defaultState());
}

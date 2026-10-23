// The learner's skill profile: a rolling estimate per skill and per weak-spot
// topic (grammar lesson, binyan, tense), fed by every exercise, plus the
// result of the last full assessment.
import type { Level } from '../content/types.ts';
import { LEVELS } from '../content/types.ts';
import { type AppState, getState, setState } from './store.ts';

export type Skill = 'vocab' | 'verbs' | 'grammar' | 'reading' | 'listening' | 'writing' | 'numbers';

export const SKILLS: { id: Skill; label: string; emoji: string }[] = [
  { id: 'vocab', label: 'Vocabulary', emoji: '🌱' },
  { id: 'verbs', label: 'Verb forms', emoji: '🔁' },
  { id: 'grammar', label: 'Grammar', emoji: '🧩' },
  { id: 'reading', label: 'Reading', emoji: '📰' },
  { id: 'listening', label: 'Listening', emoji: '📺' },
  { id: 'writing', label: 'Writing', emoji: '✍️' },
  { id: 'numbers', label: 'Numbers', emoji: '🔢' },
];

export interface Stat {
  score: number; // 0..1, recent performance
  n: number; // number of observations
  at: number;
}

export interface Assessment {
  at: number;
  level: Level;
  skills: Partial<Record<Skill, Level>>;
  scores: Partial<Record<Skill, number>>;
}

export interface Profile {
  skills: Partial<Record<Skill, Stat>>;
  topics: Record<string, Stat>; // "g_numbers", "binyan:hifil", "tense:future"
  assessment?: Assessment;
}

function update(stat: Stat | undefined, value: number, weight: number): Stat {
  const n = (stat?.n ?? 0) + weight;
  // Early observations count more; later ones form a moving average of roughly the last 25.
  const alpha = Math.max(0.04, Math.min(1, weight / n));
  const score = stat ? stat.score + alpha * (value - stat.score) : value;
  return { score: Math.max(0, Math.min(1, score)), n, at: Date.now() };
}

/** Record one result (value 0..1) for a skill and optional weak-spot topics. */
export function record(skill: Skill, value: number, topics: string[] = [], weight = 1): void {
  setState((s) => applyRecord(s, skill, value, topics, weight));
}

export function applyRecord(s: AppState, skill: Skill, value: number, topics: string[] = [], weight = 1): void {
  const p = s.profile;
  p.skills[skill] = update(p.skills[skill], value, weight);
  for (const t of topics) p.topics[t] = update(p.topics[t], value, weight);
}

/** Map a 0..1 score on material of a given level to an estimated level. */
export function levelFromScore(score: number): Level {
  if (score >= 0.85) return 'B2';
  if (score >= 0.7) return 'B1+';
  if (score >= 0.55) return 'B1';
  if (score >= 0.4) return 'A2+';
  if (score >= 0.25) return 'A2';
  return 'A1';
}

/** Current estimate per skill: the assessment, nudged by practice since then. */
export function skillLevel(skill: Skill, s: AppState = getState()): Level | null {
  const a = s.profile.assessment?.skills[skill];
  const live = s.profile.skills[skill];
  if (!a && !live) return null;
  if (!live || live.n < 8) return a ?? null;
  // Practice accuracy is measured on material at the learner's level, so it moves
  // the estimate up or down by at most one step.
  const base = LEVELS.indexOf(a ?? s.level);
  const step = live.score >= 0.85 ? 1 : live.score < 0.55 ? -1 : 0;
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, base + step))];
}

/** Skills ordered weakest first (only skills with some evidence). */
export function weakestSkills(s: AppState = getState()): Skill[] {
  const scored = SKILLS.map(({ id }) => {
    const lvl = skillLevel(id, s);
    const live = s.profile.skills[id];
    const fromLevel = lvl ? LEVELS.indexOf(lvl) / (LEVELS.length - 1) : null;
    const fromLive = live && live.n >= 5 ? live.score : null;
    const v = fromLevel !== null && fromLive !== null ? 0.5 * fromLevel + 0.5 * fromLive : (fromLevel ?? fromLive);
    return { id, v };
  }).filter((x) => x.v !== null) as { id: Skill; v: number }[];
  return scored.sort((a, b) => a.v - b.v).map((x) => x.id);
}

/** Topics (grammar lessons, binyanim, tenses) with the lowest recent accuracy. */
export function weakTopics(prefix: string, s: AppState = getState(), minN = 3): { topic: string; score: number }[] {
  return Object.entries(s.profile.topics)
    .filter(([k, v]) => k.startsWith(prefix) && v.n >= minN && v.score < 0.75)
    .map(([topic, v]) => ({ topic, score: v.score }))
    .sort((a, b) => a.score - b.score);
}

export function verdictValue(verdict: string): number {
  return verdict === 'correct' ? 1 : verdict === 'close' ? 0.6 : 0;
}

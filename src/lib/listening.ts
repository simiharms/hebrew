// Short sentences for the listening trainer, by level: scene lines, word and
// verb examples, and one-sentence reading paragraphs (all with a matching
// English translation).
import type { Level } from '../content/types.ts';
import { levelRank, readings, scenes, verbs, vocab } from './content.ts';

export interface Sentence {
  he: string;
  en: string;
  level: Level;
  gender?: 'm' | 'f';
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const fits = (s: string) => words(s) >= 3 && words(s) <= 14 && !/["“”]/.test(s);

let cache: Sentence[] | null = null;

export function allSentences(): Sentence[] {
  if (cache) return cache;
  const out: Sentence[] = [];
  for (const sc of scenes) for (const l of sc.lines) if (fits(l.he)) out.push({ he: l.he, en: l.en, level: sc.level, gender: sc.speakers[l.s]?.gender });
  for (const v of vocab) if (fits(v.ex.he)) out.push({ he: v.ex.he, en: v.ex.en, level: v.level });
  for (const v of verbs) for (const e of [v.ex, ...(v.exs ?? [])]) if (fits(e.he)) out.push({ he: e.he, en: e.en, level: v.level });
  for (const r of readings) for (const p of r.paragraphs) if (fits(p.he) && !/[.!?].+[.!?]/.test(p.he.trim().slice(0, -1))) out.push({ he: p.he, en: p.en, level: r.level });
  const seen = new Set<string>();
  cache = out.filter((s) => !seen.has(s.he) && seen.add(s.he));
  return cache;
}

/** Sentences at this level or one step easier. */
export function sentencesAt(level: Level): Sentence[] {
  const r = levelRank(level);
  return allSentences().filter((s) => {
    const d = r - levelRank(s.level);
    return d >= 0 && d <= 1;
  });
}

export function pickSentences(level: Level, n: number): Sentence[] {
  const pool = sentencesAt(level);
  return [...pool].sort(() => Math.random() - 0.5).slice(0, n);
}

/** Two wrong English options of similar length from the same level. */
export function distractors(target: Sentence, n = 2): string[] {
  const pool = sentencesAt(target.level).filter((s) => s.en !== target.en && Math.abs(s.en.length - target.en.length) < 40);
  return [...pool].sort(() => Math.random() - 0.5).slice(0, n).map((s) => s.en);
}

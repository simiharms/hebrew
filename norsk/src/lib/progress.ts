// The steps of a lesson and how far the learner is in each.
import type { Lesson } from '../content/types.ts';
import { lessonByN, wordsOfLesson } from './content.ts';
import { PLAN } from './plan.ts';
import type { AppState } from './store.ts';

export type StepKind = 'text' | 'vocab' | 'grammar' | 'ex' | 'wk' | 'extra' | 'listen' | 'write' | 'check';

export interface Step {
  id: string; // key in AppState.done
  kind: StepKind;
  title: string;
  sub?: string;
  route: string;
}

export const STEP_EMOJI: Record<StepKind, string> = {
  text: '📖',
  vocab: '🗂️',
  grammar: '🧩',
  ex: '✏️',
  wk: '💬',
  extra: '🌍',
  listen: '🎧',
  write: '📝',
  check: '✅',
};

export function lessonSteps(L: Lesson): Step[] {
  const n = L.n;
  const r = (p: string) => `lektion/${n}/${p}`;
  return [
    { id: `L${n}:text`, kind: 'text', title: 'Text lesen und hören', sub: L.text.title, route: r('text') },
    { id: `L${n}:vocab`, kind: 'vocab', title: 'Neue Wörter lernen', sub: `${wordsOfLesson(n).length} Wörter`, route: r('woerter') },
    ...L.grammar.map((g): Step => ({ id: `L${n}:${g.id}`, kind: 'grammar', title: g.title, sub: 'Grammatik', route: r(`grammatik/${g.id}`) })),
    { id: `L${n}:ex`, kind: 'ex', title: 'Übungen zum Text', sub: 'Richtig/falsch, Fragen, Übersetzen', route: r('uebungen') },
    { id: `L${n}:wk`, kind: 'wk', title: `Wörterkiste: ${L.wk.title}`, sub: L.wk.titleDe, route: r('woerterkiste') },
    ...L.extra.map((x): Step => ({ id: `L${n}:${x.id}`, kind: 'extra', title: x.title, sub: 'Landeskunde', route: r(`lesen/${x.id}`) })),
    { id: `L${n}:listen`, kind: 'listen', title: 'Hören und Diktat', sub: 'Sätze aus dem Text', route: r('hoeren') },
    { id: `L${n}:write`, kind: 'write', title: 'Schreiben', sub: L.writing.prompt.slice(0, 60) + (L.writing.prompt.length > 60 ? '…' : ''), route: r('schreiben') },
    { id: `L${n}:check`, kind: 'check', title: 'Lektionstest', sub: 'Ab 70 % geht es weiter', route: r('test') },
  ];
}

export function stepDone(s: AppState, st: Step): boolean {
  if (st.kind === 'vocab') {
    const n = Number(st.id.slice(1).split(':')[0]);
    const list = wordsOfLesson(n);
    return !!s.done[st.id] || (list.length > 0 && list.every((w) => s.cards[`w:${w.id}`]));
  }
  if (st.kind === 'check') return (s.done[st.id]?.score ?? 0) >= 0.7;
  return !!s.done[st.id];
}

export function lessonProgress(s: AppState, n: number): { done: number; total: number } {
  const L = lessonByN.get(n);
  if (!L) return { done: 0, total: 1 };
  const steps = lessonSteps(L);
  return { done: steps.filter((st) => stepDone(s, st)).length, total: steps.length };
}

/** The first step of the lesson that isn't done yet. */
export function nextStep(s: AppState, n: number): Step | undefined {
  const L = lessonByN.get(n);
  if (!L) return undefined;
  return lessonSteps(L).find((st) => !stepDone(s, st));
}

export function planOf(n: number) {
  return PLAN.find((p) => p.n === n);
}

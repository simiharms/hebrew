// The daily plan on the Today screen, tailored to the course position and the
// skill profile: the weakest skill gets an extra, clearly marked item.
import type { Level } from '../content/types.ts';
import { LEVELS } from '../content/types.ts';
import { emails, grammar, levelRank, readings, scenes } from './content.ts';
import { currentUnit, stepDone, UNITS, unitSteps } from './course.ts';
import { dueVerbCount, dueWordCards, newWordsLeft } from './session.ts';
import { type Skill, SKILLS, skillLevel, weakestSkills, weakTopics } from './skills.ts';
import { type AppState, today } from './store.ts';

export interface PlanItem {
  id: string;
  emoji: string;
  title: string;
  sub: string;
  route: string;
  done: boolean;
  minutes: number;
  focus?: boolean; // extra practice for the weakest skill
}

const STEP_EMOJI: Record<string, string> = { grammar: '🧩', read: '📰', listen: '📺', write: '✉️', verbs: '🔁', numbers: '🔢', check: '✅' };
const STEP_SKILL: Record<string, Skill> = { grammar: 'grammar', read: 'reading', listen: 'listening', write: 'writing', verbs: 'verbs', numbers: 'numbers', check: 'grammar' };
const STEP_MIN: Record<string, number> = { grammar: 8, read: 10, listen: 8, write: 8, verbs: 4, numbers: 3, check: 4 };

function preferenceKey(itemLevel: Level, target: Level): number {
  const d = levelRank(itemLevel) - levelRank(target);
  if (d === 0) return 0;
  if (d < 0) return 1 - d;
  return 3 + d;
}

/** Next unfinished item closest to the target level (or one finished today). */
function nextOf<T extends { id: string; level: Level }>(list: T[], s: AppState, doneToday: string[], target: Level, exclude: Set<string>) {
  const todayItem = list.find((x) => doneToday.includes(x.id) && !exclude.has(x.id));
  if (todayItem) return { item: todayItem, done: true };
  const open = list
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => !s.done[x.id] && !exclude.has(x.id))
    .sort((a, b) => preferenceKey(a.x.level, target) - preferenceKey(b.x.level, target) || a.i - b.i);
  return open[0] ? { item: open[0].x, done: false } : null;
}

const BINYAN: Record<string, string> = { paal: "pa'al", piel: "pi'el", hifil: "hif'il", hitpael: "hitpa'el", nifal: "nif'al" };

export function verbFocusLabel(s: AppState): string | null {
  const b = weakTopics('binyan:', s)[0]?.topic.slice(7);
  const t = weakTopics('tense:', s)[0]?.topic.slice(6);
  const parts = [b && BINYAN[b], t].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export function newsItems() {
  return readings.filter((r) => r.date).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

export function todaysPlan(s: AppState): PlanItem[] {
  const log = s.days.find((d) => d.date === today());
  const tasks = log?.tasks ?? [];
  const due = dueWordCards().length;
  const fresh = newWordsLeft();
  const items: PlanItem[] = [];
  const used = new Set<string>();
  const weak = weakestSkills(s);
  const focus: Skill | undefined = weak[0];

  items.push({
    id: 'words',
    emoji: '🌱',
    title: 'Words',
    sub: due + fresh ? `${due} to review · ${fresh} new` : 'All done for today',
    route: 'session/words',
    done: tasks.includes('words') || due + fresh === 0,
    minutes: Math.max(3, Math.round((due * 8 + fresh * 30) / 60)),
    focus: focus === 'vocab',
  });

  // Course: the next two steps of the current unit (and any finished today).
  const n = currentUnit(s);
  const unit = UNITS[n];
  if (unit) {
    const steps = unitSteps(unit, n);
    const doneToday = steps.filter((st) => tasks.includes(st.id));
    const open = steps.filter((st) => !stepDone(s, st) && !doneToday.includes(st));
    // Two open steps of different kinds (e.g. grammar + reading), so a day isn't all lessons.
    const picks = open.slice(0, 1);
    const other = open.find((st) => picks[0] && st.kind !== picks[0].kind);
    if (other) picks.push(other);
    for (const st of [...doneToday, ...picks].slice(0, Math.max(2, doneToday.length + 1))) {
      used.add(st.id);
      items.push({
        id: st.id,
        emoji: STEP_EMOJI[st.kind],
        title: `Unit ${n + 1}: ${st.title}`,
        sub: unit.title,
        route: st.route,
        done: stepDone(s, st) && (tasks.includes(st.id) || st.kind === 'numbers'),
        minutes: STEP_MIN[st.kind],
        focus: !!focus && STEP_SKILL[st.kind] === focus,
      });
    }
  }

  const vdue = dueVerbCount();
  const vfocus = verbFocusLabel(s);
  items.push({
    id: 'verbs',
    emoji: '🔁',
    title: 'Verb forms',
    sub: vfocus ? `focus on ${vfocus}${vdue ? ` · ${vdue} due` : ''}` : vdue ? `${vdue} verb-tenses due` : '12 quick conjugations',
    route: 'session/verbs',
    done: tasks.includes('verbs'),
    minutes: 4,
    focus: focus === 'verbs',
  });

  // This week's easy news.
  const news = newsItems().find((r) => tasks.includes(r.id) || !s.done[r.id]);
  if (news) {
    used.add(news.id);
    items.push({ id: news.id, emoji: '🗞️', title: `News: ${news.titleEn}`, sub: `${news.level} · ${news.title}`, route: `read/${news.id}`, done: !!s.done[news.id] && tasks.includes(news.id), minutes: 6 });
  }

  // Extra practice for the weakest skill, at that skill's own level.
  const lvl = (k: Skill) => skillLevel(k, s) ?? s.level;
  const extra = focusItem(s, focus, lvl, tasks, used);
  if (extra) items.push(extra);

  if (focus !== 'numbers' && !used.has('numbers') && (tasks.includes('numbers') || Math.floor(Date.now() / 86_400_000) % 3 === 0)) {
    items.push({ id: 'numbers', emoji: '🔢', title: 'Numbers by ear', sub: 'Prices, phone numbers, times', route: 'numbers', done: tasks.includes('numbers'), minutes: 3 });
  }
  return items;
}

function focusItem(s: AppState, focus: Skill | undefined, lvl: (k: Skill) => Level, tasks: string[], used: Set<string>): PlanItem | null {
  if (!focus) return null;
  const label = SKILLS.find((x) => x.id === focus)!.label;
  const sub = (x: string) => `Focus: ${label.toLowerCase()} · ${x}`;
  switch (focus) {
    case 'listening': {
      const sc = nextOf(scenes, s, tasks, lvl('listening'), used);
      return sc && { id: sc.item.id, emoji: '📺', title: `Watch: ${sc.item.titleEn}`, sub: sub(sc.item.level), route: `listen/${sc.item.id}`, done: sc.done, minutes: 8, focus: true };
    }
    case 'reading': {
      const r = nextOf(readings.filter((x) => !x.date), s, tasks, lvl('reading'), used);
      return r && { id: r.item.id, emoji: '📰', title: `Read: ${r.item.titleEn}`, sub: sub(r.item.level), route: `read/${r.item.id}`, done: r.done, minutes: 10, focus: true };
    }
    case 'grammar': {
      // The course already brings new grammar; the focus item reviews a measured weak spot.
      const weakLesson = weakTopics('g_', s)
        .map((t) => grammar.find((g) => g.id === t.topic))
        .find((g) => g && !used.has(g.id));
      if (weakLesson) {
        return { id: weakLesson.id, emoji: '🧩', title: `Review: ${weakLesson.title}`, sub: sub('your weakest topic'), route: `grammar/${weakLesson.id}`, done: tasks.includes(weakLesson.id), minutes: 8, focus: true };
      }
      if (s.mistakes.length >= 3) {
        return { id: 'mistakes', emoji: '🩹', title: 'Mistake bank', sub: sub(`${s.mistakes.length} saved answers to fix`), route: 'mistakes', done: false, minutes: 5, focus: true };
      }
      return null;
    }
    case 'writing': {
      const e = nextOf(emails.map((x) => ({ ...x, id: `${x.id}:w` })), s, tasks, lvl('writing'), used);
      return e && { id: e.item.id, emoji: '✉️', title: `Write: ${e.item.title}`, sub: sub(e.item.level), route: `write/${e.item.id.replace(/:w$/, '')}`, done: e.done, minutes: 8, focus: true };
    }
    case 'numbers':
      return { id: 'numbers', emoji: '🔢', title: 'Numbers by ear', sub: sub('prices, phone numbers, times'), route: 'numbers', done: tasks.includes('numbers'), minutes: 3, focus: true };
    default:
      return null; // vocab and verbs are already marked on their own items
  }
}

/** Suggest moving up when most material at the current level is done well. */
export function levelUpSuggestion(s: AppState): Level | null {
  const idx = levelRank(s.level);
  if (idx >= LEVELS.length - 1) return null;
  const pool = [...readings.filter((r) => !r.date), ...scenes].filter((x) => x.level === s.level);
  if (pool.length < 3) return null;
  const done = pool.filter((x) => (s.done[x.id]?.score ?? 0) >= 0.6).length;
  return done / pool.length >= 0.75 ? LEVELS[idx + 1] : null;
}

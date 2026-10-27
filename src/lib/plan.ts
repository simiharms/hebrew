// The daily plan on the Today screen, tailored to the course position and the
// skill profile: the weakest skill gets an extra, clearly marked item.
import type { Level } from '../content/types.ts';
import { LEVELS } from '../content/types.ts';
import { emails, grammar, levelRank, readings, scenes, verbById, verbs } from './content.ts';
import { currentUnit, stepDone, UNITS, unitSteps } from './course.ts';
import { deckById, deckQueue } from './decks.ts';
import { drillable, dueVerbCount, dueWordCards, newWordsLeft, TENSES } from './session.ts';
import { ttsSupported } from './tts.ts';
import { type VKind, VKINDS } from './verbdrill.ts';
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

const STEP_EMOJI: Record<string, string> = { grammar: '🧩', read: '📰', listen: '📺', write: '✉️', verbs: '🔁', numbers: '🔢', deck: '🃏', check: '✅' };
const STEP_SKILL: Record<string, Skill> = { grammar: 'grammar', read: 'reading', listen: 'listening', write: 'writing', verbs: 'verbs', numbers: 'numbers', deck: 'vocab', check: 'grammar' };
const STEP_MIN: Record<string, number> = { grammar: 8, read: 10, listen: 8, write: 8, verbs: 4, numbers: 3, deck: 5, check: 4 };

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

// Grammar lessons about verbs, in course order.
const VERB_LESSONS = ['g_a1_present', 'g_a1_infinitive', 'g_a2_past_paal', 'g_a2_future_paal', 'g_a2_imperative', 'g_paal', 'g_binyanim_map', 'g_piel', 'g_hifil', 'g_hitpael', 'g_nifal', 'g_weak_roots', 'g_passive', 'g_c1_pual_hufal'];
const BINYAN_LESSON: Record<string, string> = { paal: 'g_paal', piel: 'g_piel', hifil: 'g_hifil', hitpael: 'g_hitpael', nifal: 'g_nifal' };

/** Verbs-only mode: the whole day is verb practice, aimed at the weakest binyan and tense. */
export function verbPlan(s: AppState): PlanItem[] {
  const tasks = s.days.find((d) => d.date === today())?.tasks ?? [];
  const weakB = weakTopics('binyan:', s)[0]?.topic.slice(7);
  const vfocus = verbFocusLabel(s);
  const vdue = dueVerbCount();
  const items: PlanItem[] = [];
  items.push({
    id: 'verbs',
    emoji: '🔁',
    title: 'Verb review',
    sub: vfocus ? `focus on ${vfocus}${vdue ? ` · ${vdue} due` : ''}` : vdue ? `${vdue} verb-tenses due` : '12 mixed exercises',
    route: 'session/verbs',
    done: tasks.includes('verbs'),
    minutes: 5,
  });

  const deckId = levelRank(s.level) <= 1 ? 'v:essential' : weakB && deckById(`v:${weakB}`) ? `v:${weakB}` : 'v:weak';
  const deck = deckById(deckId) ?? deckById('v:essential');
  if (deck) {
    const left = deckQueue(deck).length;
    items.push({
      id: `deck:${deck.id}`,
      emoji: '🃏',
      title: `Verb cards: ${deck.title}`,
      sub: left ? `${left} cards: infinitive, meaning and key forms` : 'All caught up',
      route: `session/deck/${deck.id}`,
      done: tasks.includes(`deck:${deck.id}`) || !left,
      minutes: 5,
    });
  }

  const day = Math.round(new Date(today()).getTime() / 86_400_000); // local date, not UTC
  const rotating: VKind[] = ttsSupported() ? ['listen', 'infinitive', 'binyan'] : ['infinitive', 'binyan'];
  const kinds: VKind[] = ['context', 'identify', rotating[day % rotating.length]];
  for (const t of tasks) if (t.startsWith('vkind:') && !kinds.includes(t.slice(6) as VKind)) kinds.push(t.slice(6) as VKind);
  for (const kind of kinds) {
    const k = VKINDS.find((x) => x.id === kind)!;
    items.push({ id: `vkind:${kind}`, emoji: k.emoji, title: k.label, sub: k.sub, route: `session/vkind/${kind}`, done: tasks.includes(`vkind:${kind}`), minutes: 4 });
  }

  // Table challenge: the verb-tense you know least well.
  const shaky = Object.entries(s.cards)
    .filter(([id]) => {
      const [k, vid, t] = id.split(':');
      const v = verbById.get(vid);
      return k === 'c' && v && TENSES.includes(t as 'past') && drillable(v, t as 'past');
    })
    .sort((a, b) => a[1].s - b[1].s)[0];
  const [, vid, tense] = shaky ? shaky[0].split(':') : [];
  const target = vid ? { v: verbById.get(vid)!, t: tense } : { v: verbs.find((v) => ['A1', 'A2'].includes(v.level) && drillable(v, 'past'))!, t: 'past' };
  if (target.v) {
    items.push({
      id: 'vtable',
      emoji: '📋',
      title: `Table challenge: ${target.v.inf}`,
      sub: `Fill in the whole ${target.t} tense`,
      route: `verbs/table/${target.v.id}/${target.t}`,
      done: tasks.includes('vtable'),
      minutes: 3,
    });
  }

  const lessonId = (weakB && BINYAN_LESSON[weakB] && !s.done[BINYAN_LESSON[weakB]] ? BINYAN_LESSON[weakB] : undefined) ?? VERB_LESSONS.find((id) => grammar.some((g) => g.id === id) && (!s.done[id] || tasks.includes(id)));
  const lesson = lessonId && grammar.find((g) => g.id === lessonId);
  if (lesson) items.push({ id: lesson.id, emoji: '🧩', title: `Lesson: ${lesson.title}`, sub: `${lesson.level} · the grammar behind the forms`, route: `grammar/${lesson.id}`, done: tasks.includes(lesson.id), minutes: 8 });
  return items;
}

export function todaysPlan(s: AppState): PlanItem[] {
  if (s.settings.verbsOnly) return verbPlan(s);
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
        done: stepDone(s, st) && tasks.includes(st.id),
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
      const r = nextOf(readings, s, tasks, lvl('reading'), used);
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
  const pool = [...readings, ...scenes].filter((x) => x.level === s.level);
  if (pool.length < 3) return null;
  const done = pool.filter((x) => (s.done[x.id]?.score ?? 0) >= 0.6).length;
  return done / pool.length >= 0.75 ? LEVELS[idx + 1] : null;
}

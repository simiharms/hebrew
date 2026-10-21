// The daily plan shown on the Today screen.
import type { Level } from '../content/types.ts';
import { LEVELS } from '../content/types.ts';
import { emails, grammar, levelRank, readings, scenes } from './content.ts';
import { dueVerbCount, dueWordCards, newWordsLeft } from './session.ts';
import { type AppState, today } from './store.ts';

export interface PlanItem {
  id: string;
  emoji: string;
  title: string;
  sub: string;
  route: string;
  done: boolean;
  minutes: number;
}

function preferenceKey(itemLevel: Level, userLevel: Level): number {
  const d = levelRank(itemLevel) - levelRank(userLevel);
  if (d === 0) return 0;
  if (d < 0) return 1 - d; // easier material next
  return 3 + d; // then harder
}

function nextOf<T extends { id: string; level: Level }>(list: T[], s: AppState, doneToday: string[]): { item: T; done: boolean } | null {
  const today = list.find((x) => doneToday.includes(x.id));
  if (today) return { item: today, done: true };
  const open = list
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => !s.done[x.id])
    .sort((a, b) => preferenceKey(a.x.level, s.level) - preferenceKey(b.x.level, s.level) || a.i - b.i);
  return open[0] ? { item: open[0].x, done: false } : null;
}

export function todaysPlan(s: AppState): PlanItem[] {
  const log = s.days.find((d) => d.date === today());
  const tasks = log?.tasks ?? [];
  const due = dueWordCards().length;
  const fresh = newWordsLeft();
  const items: PlanItem[] = [];

  items.push({
    id: 'words',
    emoji: '🌱',
    title: 'Words',
    sub: due + fresh ? `${due} to review · ${fresh} new` : 'All done for today',
    route: 'session/words',
    done: tasks.includes('words') || due + fresh === 0,
    minutes: Math.max(3, Math.round((due * 8 + fresh * 30) / 60)),
  });

  const vdue = dueVerbCount();
  items.push({
    id: 'verbs',
    emoji: '🔁',
    title: 'Verb forms',
    sub: vdue ? `${vdue} verb-tenses due` : '12 quick conjugations',
    route: 'session/verbs',
    done: tasks.includes('verbs'),
    minutes: 4,
  });

  const g = nextOf(grammar, s, tasks);
  if (g) items.push({ id: g.item.id, emoji: '🧩', title: `Grammar: ${g.item.title}`, sub: g.item.summary, route: `grammar/${g.item.id}`, done: g.done, minutes: 8 });

  const r = nextOf(readings, s, tasks);
  if (r) items.push({ id: r.item.id, emoji: '📰', title: `Read: ${r.item.titleEn}`, sub: `${r.item.level} · ${r.item.title}`, route: `read/${r.item.id}`, done: r.done, minutes: 10 });

  const sc = nextOf(scenes, s, tasks);
  if (sc) items.push({ id: sc.item.id, emoji: '📺', title: `Watch: ${sc.item.titleEn}`, sub: `${sc.item.level} · ${sc.item.genre}`, route: `listen/${sc.item.id}`, done: sc.done, minutes: 8 });

  items.push({
    id: 'numbers',
    emoji: '🔢',
    title: 'Numbers by ear',
    sub: 'Prices, phone numbers, times',
    route: 'numbers',
    done: tasks.includes('numbers'),
    minutes: 3,
  });

  // A writing task every other day keeps output practice going.
  const dayNum = Math.floor(Date.now() / 86_400_000);
  const e = nextOf(
    emails.map((x) => ({ ...x, id: `${x.id}:w` })),
    s,
    tasks,
  );
  if (e && (dayNum % 2 === 0 || e.done)) {
    items.push({ id: e.item.id, emoji: '✉️', title: `Write: ${e.item.title}`, sub: e.item.situation, route: `write/${e.item.id.replace(/:w$/, '')}`, done: e.done, minutes: 8 });
  }
  return items;
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

// Today's ride: the line of short rounds planned for the day, how far along it
// is, and what the dock (the big button above the tab bar) offers next.
//
// kit.ts loads this file through import.meta.glob and this file imports the
// kit, so nothing from the kit may be read at module top level: only inside
// functions.
import { levelRank } from '../lib/content.ts';
import { weakestSkills } from '../lib/skills.ts';
import { type AppState, type GameId, getState, setState, today } from '../lib/store.ts';
import { hebrewVoices } from '../lib/tts.ts';
import { daySeed, GAMES, peekRound, seeded } from './kit.ts';

// Days since 1970 for a YYYY-MM-DD date (parsed as UTC midnight, so exact).
const dayIndex = (date: string) => Math.round(new Date(date).getTime() / 86_400_000);

function stopCount(s: AppState): number {
  const n = Math.round(Number(s.settings.rideStops));
  return n >= 2 && n <= 4 ? n : 3;
}

/** Echo only rides along when the learner turned game speech on and a Hebrew voice exists. */
function voiceReady(s: AppState): boolean {
  return s.settings.gameVoice && hebrewVoices().length > 0;
}

/**
 * The day's line, seeded by the date so it stays put all day:
 *   1. a tap warm-up on verbs (Who's talking?, or Time Machine from A2 on);
 *   2. Verb Forge, the production round, in every ride;
 *   3. a round for the weakest skill (verbs-only mode: another verb round).
 * Two stops keep the first two; a fourth adds another short round.
 */
export function planRide(s: AppState, date: string = today()): GameId[] {
  const rnd = seeded(daySeed(date));
  const a2 = levelRank(s.level) >= 1;
  const warm: GameId = a2 && rnd() < 0.5 ? 'sort' : 'snap';
  // Time Machine needs past and future, so A1 gets Table Smash instead.
  const otherVerb: GameId = warm === 'sort' ? 'snap' : a2 ? 'sort' : 'smash';
  let third: GameId;
  if (s.settings.verbsOnly) third = otherVerb;
  else {
    const weak = weakestSkills(s)[0];
    if (weak === 'grammar') third = 'gap';
    else if (weak === 'vocab') third = 'match';
    else if (weak === 'listening') third = voiceReady(s) ? 'echo' : 'match';
    else if (weak === 'verbs') third = otherVerb;
    else third = (['gender', 'gap', 'match'] as GameId[])[dayIndex(date) % 3];
  }
  const plan: GameId[] = [warm, 'forge', third];
  const stops = stopCount(s);
  if (stops === 2) return plan.slice(0, 2);
  if (stops === 4) {
    const fits = (g: GameId) => !plan.includes(g) && (a2 || g !== 'sort');
    const verbish = s.settings.verbsOnly ? (['smash', 'snap', 'sort'] as GameId[]).filter(fits) : [];
    const pool = verbish.length ? verbish : (['gap', 'match', 'gender'] as GameId[]).filter(fits);
    plan.push(pool[Math.floor(rnd() * pool.length)]);
  }
  return plan;
}

export interface RideStatus {
  plan: GameId[];
  done: GameId[];
  goal: number; // stops on the line
  next: GameId | null; // the next stop to ride (null once the line is finished)
  met: boolean; // every stop done today
  terminusOpen: boolean; // line finished, the ×2 round not played yet
  terminusDone: boolean;
  started: boolean; // today's ride exists in the state
}

/** Today's line: the saved ride, or the plan it will get when it starts. */
export function rideStatus(s: AppState): RideStatus {
  const t = today();
  const ride = s.play.ride && s.play.ride.date === t ? s.play.ride : null;
  const plan = ride ? ride.plan : planRide(s, t);
  const done = ride ? plan.filter((g) => ride.done.includes(g)) : [];
  const next = plan.find((g) => !done.includes(g)) ?? null;
  const met = plan.length > 0 && next === null;
  const terminusDone = !!ride?.terminus;
  return { plan, done, goal: plan.length, next, met, terminusOpen: met && !terminusDone, terminusDone, started: !!ride };
}

/** Saves today's ride if it isn't saved yet (so its plan stays fixed) and returns the next stop. */
export function startRide(): GameId | null {
  const t = today();
  if (getState().play.ride?.date !== t) {
    setState((s) => {
      s.play.ride = { date: t, plan: planRide(s, t), done: [], terminus: false };
    });
  }
  return rideStatus(getState()).next;
}

export type SixMark = '' | 'g' | 'y' | 'r';

/** Today's Verb of the Day grid: six marks ('' not answered yet). */
export function sixStatus(s: AppState): { marks: SixMark[]; started: boolean; done: boolean; open: boolean } {
  const t = today();
  const d = s.play.daily && s.play.daily.date === t ? s.play.daily : null;
  const marks: SixMark[] = d && d.marks.length ? [...d.marks] : ['', '', '', '', '', ''];
  // Only today's grid says whether today's verb is done (a grid begun last
  // night and finished after midnight is yesterday's).
  const done = !!d && d.marks.length > 0 && d.marks.every(Boolean);
  // Daily Six is an A2 game (it needs past, future and the imperative).
  return { marks, started: marks.some(Boolean), done, open: levelRank(s.level) >= 1 };
}

export type DockKind = 'resume' | 'stop' | 'terminus' | 'six' | 'free';

export interface DockAction {
  kind: DockKind;
  icon: string;
  label: string;
  sub: string;
  route: string;
}

/** The route of a game in a mode: play/snap, play/forge/ride, play/sort/sprint. */
export function gameRoute(game: GameId, mode: string): string {
  return mode === 'free' ? `play/${game}` : `play/${game}/${mode}`;
}

/**
 * What the dock offers, in this order: resume a round left half-way, the next
 * stop of today's line, the 👑 terminus round, today's Verb of the Day, free play.
 */
export function dockAction(s: AppState): DockAction {
  const meta = (g: GameId) => GAMES.find((x) => x.id === g);
  const st = rideStatus(s);
  const peek = peekRound();
  if (peek) {
    const m = meta(peek.game);
    const where =
      peek.mode === 'ride' && st.plan.includes(peek.game)
        ? `Stop ${st.plan.indexOf(peek.game) + 1}/${st.goal}`
        : peek.mode === 'terminus'
          ? '👑 Terminus'
          : peek.mode === 'sprint'
            ? '⚡ Sprint'
            : 'Free play';
    const progress = peek.mode === 'sprint' ? `${peek.answered} answered, clock paused` : `${peek.answered} of ${peek.total} done`;
    return { kind: 'resume', icon: m?.emoji ?? '▶', label: `Resume · ${m?.title ?? peek.game}`, sub: `${where} · ${progress}`, route: gameRoute(peek.game, peek.mode) };
  }
  if (st.next) {
    const m = meta(st.next);
    const first = st.done.length === 0;
    return {
      kind: 'stop',
      icon: m?.emoji ?? '🚌',
      label: `Stop ${st.plan.indexOf(st.next) + 1}/${st.goal} · ${m?.title ?? st.next}`,
      sub: first ? `Today's line · ${st.goal} short rounds, about ${Math.round(st.goal * 1.6)} min` : (m?.pitch ?? ''),
      route: gameRoute(st.next, 'ride'),
    };
  }
  if (st.terminusOpen) {
    return { kind: 'terminus', icon: '👑', label: 'Terminus · Table Smash ×2', sub: 'Line finished! One bonus round at double XP', route: 'play/smash/terminus' };
  }
  const six = sixStatus(s);
  if (six.open && !six.done) {
    return { kind: 'six', icon: '🟩', label: 'Verb of the Day', sub: six.started ? 'Finish today’s six forms' : 'Six forms of one verb · once a day', route: 'play/six' };
  }
  return { kind: 'free', icon: '🚌', label: 'Free play', sub: 'Line finished today · every round still earns XP', route: 'play' };
}

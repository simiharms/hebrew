// Shoresh Play game kit: scoring, honest FSRS evidence, round snapshots, sound
// and the verb and vocab helpers every mode shares. Taps never create cards or
// raise stability; only built (Forge) and typed (Daily Six) answers review a
// card, and only when it is due.
import type { Level, Verb, VocabItem } from '../content/types.ts';
import { findVocab, levelRank, newWordOrder, verbById, verbs } from '../lib/content.ts';
import { type CardState, isDue, type Rating, review, strength } from '../lib/fsrs.ts';
import { lenient, normalizeEn } from '../lib/hebrew.ts';
import { drillable, FUTURE_PRONOUNS, PERSON_PRONOUNS, PRESENT_PRONOUNS, type Tense, TENSES, verbCardOrder } from '../lib/session.ts';
import { applyRecord, type Skill, weakTopics } from '../lib/skills.ts';
import { type AppState, dateKey, type GameId, getState, logFor, type Mistake, PLAY_ROUND_KEY, setState, today, todayLog } from '../lib/store.ts';
import { speak, ttsSupported } from '../lib/tts.ts';
import { tableOf, type TenseKey } from '../lib/verbdrill.ts';

// planRide lives in ride.ts (the hub), which imports this kit. A glob import
// keeps the kit loadable on its own (unit tests, modes built before the hub).
const rideMod = Object.values(import.meta.glob<{ planRide?: (s: AppState, date?: string) => GameId[] }>('./ride.ts', { eager: true }))[0];

function ridePlan(s: AppState, date: string): GameId[] {
  if (rideMod?.planRide) return rideMod.planRide(s, date);
  const stops = Math.max(2, Math.min(4, s.settings.rideStops || 3));
  return (levelRank(s.level) >= 1 ? ['sort', 'forge', 'gap', 'match'] : ['snap', 'forge', 'gender', 'match']).slice(0, stops) as GameId[];
}

export type GameMode = 'free' | 'ride' | 'terminus' | 'sprint';
export type Tier = 'tap' | 'build' | 'typed';
export interface GameProps {
  mode: GameMode;
}
export interface GameMeta {
  id: GameId;
  title: string;
  titleHe: string;
  emoji: string;
  pitch: string;
  input: 'tap' | 'tiles' | 'typing' | 'audio';
  tier: Tier;
  verbs: boolean;
  minLevel: Level;
  sprint?: boolean;
  needsVoice?: boolean;
}

export const GAMES: GameMeta[] = [
  { id: 'snap', title: "Who's talking?", titleHe: 'מי מדבר?', emoji: '🗣️', pitch: 'See a verb form, tap who says it', input: 'tap', tier: 'tap', verbs: true, minLevel: 'A1' },
  { id: 'sort', title: 'Time Machine', titleHe: 'מכונת זמן', emoji: '⏳', pitch: 'Past, present or future? Send each form there', input: 'tap', tier: 'tap', verbs: true, minLevel: 'A2', sprint: true },
  { id: 'forge', title: 'Verb Forge', titleHe: 'בונים פועל', emoji: '🔨', pitch: 'Build the form from its stem and endings', input: 'tiles', tier: 'build', verbs: true, minLevel: 'A1' },
  { id: 'smash', title: 'Table Smash', titleHe: 'שוברים טבלה', emoji: '🧱', pitch: 'Fill a whole verb table, row by row', input: 'tap', tier: 'tap', verbs: true, minLevel: 'A1' },
  { id: 'six', title: 'Verb of the Day', titleHe: 'פועל היום', emoji: '🟩', pitch: 'Type six forms of one verb, once a day', input: 'typing', tier: 'typed', verbs: true, minLevel: 'A2' },
  { id: 'echo', title: 'Echo', titleHe: 'הד', emoji: '🎧', pitch: 'Hear a sentence, pick the missing verb', input: 'audio', tier: 'tap', verbs: true, minLevel: 'A1', needsVoice: true },
  { id: 'match', title: 'Match Rush', titleHe: 'זוגות', emoji: '⚡', pitch: 'Pair Hebrew words with their English', input: 'tap', tier: 'tap', verbs: false, minLevel: 'A1', sprint: true },
  { id: 'gender', title: 'He or She?', titleHe: 'זכר או נקבה', emoji: '⚖️', pitch: 'Masculine or feminine? Watch for surprises', input: 'tap', tier: 'tap', verbs: false, minLevel: 'A1' },
  { id: 'gap', title: 'Gap Dash', titleHe: 'השלמה', emoji: '🧩', pitch: 'Pick the word that completes the sentence', input: 'tap', tier: 'tap', verbs: false, minLevel: 'A1' },
];

export const XP: { tap: 10; build: 15; typed: 20; round: 20; perfect: 30; goal: 50 } = { tap: 10, build: 15, typed: 20, round: 20, perfect: 30, goal: 50 };

// `from` is the first level of the rank.
export const RANKS: { from: number; he: string; en: string; emoji: string }[] = [
  { from: 1, he: 'כרטיס', en: 'Ticket', emoji: '🎫' },
  { from: 5, he: 'תחנה', en: 'Stop', emoji: '🚏' },
  { from: 10, he: 'קו', en: 'Bus line', emoji: '🚌' },
  { from: 15, he: 'כביש', en: 'Highway', emoji: '🛣️' },
  { from: 20, he: 'כל הארץ', en: 'Whole country', emoji: '🗺️' },
];

export const TENSE_LABEL: Record<TenseKey, { he: string; en: string; cue: string; cueEn: string }> = {
  past: { he: 'עבר', en: 'Past', cue: 'אתמול', cueEn: 'yesterday' },
  present: { he: 'הווה', en: 'Present', cue: 'עכשיו', cueEn: 'now' },
  future: { he: 'עתיד', en: 'Future', cue: 'מחר', cueEn: 'tomorrow' },
  imp: { he: 'ציווי', en: 'Command', cue: '!', cueEn: 'do it!' },
};

export const IMP_PRONOUNS: Record<'ms' | 'fs' | 'mp', [string, string][]> = {
  ms: [['אתה', 'you (m)']],
  fs: [['את', 'you (f)']],
  mp: [['אתם', 'you (m pl)'], ['אתן', 'you (f pl)']],
};

// ---------- Scoring ----------

export function comboMultiplier(combo: number): 1 | 1.5 | 2 | 3 {
  if (combo >= 10) return 3;
  if (combo >= 6) return 2;
  if (combo >= 3) return 1.5;
  return 1;
}

/** XP for one right answer; `combo` is the combo count after this answer. */
export function itemXp(tier: Tier, combo: number, scale = 1, terminus = false): number {
  return Math.round(XP[tier] * comboMultiplier(combo) * scale * (terminus ? 2 : 1));
}

/** Stars for a round: by first-try share, or (sprint) by the number right. */
export function starsFor(firstTry: number, total: number, sprint = false): 1 | 2 | 3 {
  if (sprint) return firstTry >= 25 ? 3 : firstTry >= 15 ? 2 : 1;
  const r = total > 0 ? firstTry / total : 0;
  return r >= 0.95 ? 3 : r >= 0.8 ? 2 : 1;
}

/** XP needed to reach a level: 50·L·(L−1). */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + Math.max(0, xp) / 12.5)) / 2));
}

export function playerLevel(xp: number): { level: number; rank: (typeof RANKS)[number]; into: number; span: number } {
  const level = levelFromXp(xp);
  const rank = [...RANKS].reverse().find((r) => level >= r.from) ?? RANKS[0];
  return { level, rank, into: Math.max(0, xp - xpForLevel(level)), span: xpForLevel(level + 1) - xpForLevel(level) };
}

/** Adds play money (e.g. after a typed session). */
export function grantXp(n: number): void {
  const xp = Math.round(n);
  if (!(xp > 0)) return;
  setState((s) => {
    s.play.xp += xp;
    const log = todayLog(s);
    log.xp = (log.xp ?? 0) + xp;
  });
}

// ---------- Evidence ----------

export interface Evidence {
  tier: Tier;
  ok: boolean;
  skill: Skill;
  topics?: string[];
  cardId?: string | null; // 'c:<verbId>:<tense>' | 'v:<id>' | 'vp:<id>' | 'a:<letter>'
  grade?: Rating; // typed only
  weight?: number; // overrides the tier weight
  mistake?: Omit<Mistake, 'at'>;
}

const TIER_WEIGHT: Record<Tier, number> = { tap: 0.25, build: 0.6, typed: 1 };

function pushMistake(s: AppState, m: Omit<Mistake, 'at'>, now: number): void {
  s.mistakes = s.mistakes.filter((x) => !(x.ref === m.ref && x.kind === m.kind));
  s.mistakes.push({ ...m, at: now });
  if (s.mistakes.length > 300) s.mistakes.splice(0, s.mistakes.length - 300);
}

/**
 * Applies a batch of answers in one write and returns the number of FSRS
 * reviews written with g ≥ 2 ("Strengthened").
 *   tap: right does nothing to the card; wrong only pulls `due` forward.
 *   build/typed: the first evidence for a card this round (tracked in `rated`)
 *   reviews it if it is due (build: 3 or 1; typed: `grade` 1–3 if given, else 3 or 1); a
 *   wrong answer on a card that isn't due makes it due now. Later evidence can
 *   only pull it forward. Call once per item, after its last try.
 * Cards are never created. Build/typed answers below g 3 go to the mistake bank.
 */
export function applyEvidence(list: Evidence[], rated: Set<string>, now = Date.now()): number {
  return bookAnswer(list, rated, 0, today(), now);
}

/**
 * One answer in one write: its evidence (as applyEvidence) and its item XP,
 * banked at once into play.xp and the log of `date` (the round's day), so XP
 * shown during a round is never lost with the round.
 */
export function bookAnswer(list: Evidence[], rated: Set<string>, xp: number, date: string = today(), now = Date.now()): number {
  const gain = Math.max(0, Math.round(xp));
  if (!list.length && !gain) return 0;
  let strengthened = 0;
  setState((s) => {
    if (gain) {
      s.play.xp += gain;
      const day = logFor(s, date);
      day.xp = (day.xp ?? 0) + gain;
    }
    for (const e of list) {
      const g: Rating = e.tier === 'typed' && e.grade ? (Math.max(1, Math.min(3, e.grade)) as Rating) : e.ok ? 3 : 1;
      const value = e.tier === 'tap' ? (e.ok ? 1 : 0) : g >= 3 ? 1 : g === 2 ? 0.6 : 0;
      applyRecord(s, e.skill, value, e.topics ?? [], e.weight ?? TIER_WEIGHT[e.tier]);
      const id = e.cardId;
      const card: CardState | undefined = id ? s.cards[id] : undefined;
      if (e.tier === 'tap') {
        if (card && !e.ok) card.due = Math.min(card.due, now);
        continue;
      }
      if (g < 3 && e.mistake) pushMistake(s, e.mistake, now);
      if (!id || !card) continue;
      if (rated.has(id)) {
        if (g === 1) card.due = Math.min(card.due, now);
        continue;
      }
      rated.add(id);
      if (isDue(card, now)) {
        s.cards[id] = review(card, g, now, s.settings.retention);
        const log = todayLog(s);
        log.reviews++;
        if (g >= 3) log.correct++;
        if (g >= 2) strengthened++;
      } else if (g === 1) card.due = now;
    }
  });
  return strengthened;
}

// ---------- Live round ----------

export interface RoundSnapshot<I = unknown> {
  v: 1;
  game: GameId;
  mode: GameMode;
  date: string; // the day the round started: it is booked on that day
  startedAt: number;
  savedAt: number;
  items: I[];
  results: ({ ok: boolean; firstTry: boolean } | null)[];
  missed: number[];
  xp: number; // item XP earned in the round
  banked?: number; // ...of which already added to play.xp (missing: none)
  combo: number;
  bestCombo: number;
  strengthened: number;
  rated: string[];
  misses: string[];
  verbIds: string[];
  timeLeftMs?: number;
  double?: boolean; // a terminus round opened while the ×2 was still due (set when it starts)
  prior?: { total: number; firstTry: number }; // answers from before this round that its stars count (Daily Six rows)
}

const ROUND_KEY = PLAY_ROUND_KEY;
const ROUND_TTL = 6 * 3600_000;
const MAX_ROUNDS = 4; // kept per game and mode, the most recent first

const roundId = (game: GameId, mode: GameMode) => `${game}:${mode}`;

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
}

// A round that can still be resumed: whole, begun today or (across midnight)
// yesterday, saved in the last 6 h, with something left to answer.
function resumable(x: unknown): x is RoundSnapshot {
  const r = x as RoundSnapshot | null;
  if (!r || r.v !== 1 || typeof r.game !== 'string' || typeof r.mode !== 'string' || !Array.isArray(r.items) || !Array.isArray(r.results) || r.results.length !== r.items.length) return false;
  if ((r.date !== today() && r.date !== yesterday()) || !(Date.now() - r.savedAt <= ROUND_TTL)) return false;
  if (r.results.every(Boolean)) return false;
  return !(r.timeLeftMs !== undefined && r.timeLeftMs <= 0);
}

// Every saved round, one per game and mode, so playing one game never wipes
// another's paused round. Reads the first format (a single snapshot) too.
function readRounds(): Record<string, RoundSnapshot> {
  const out: Record<string, RoundSnapshot> = {};
  try {
    if (typeof localStorage === 'undefined') return out;
    const raw = localStorage.getItem(ROUND_KEY);
    if (!raw) return out;
    const x = JSON.parse(raw);
    const list: unknown[] = x && x.v === 2 && x.rounds && typeof x.rounds === 'object' ? Object.values(x.rounds) : [x];
    for (const r of list) if (resumable(r)) out[roundId(r.game, r.mode)] = r;
  } catch {
    // unreadable: nothing to resume
  }
  return out;
}

function writeRounds(rounds: Record<string, RoundSnapshot>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const keep = Object.values(rounds)
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, MAX_ROUNDS);
    if (!keep.length) localStorage.removeItem(ROUND_KEY);
    else localStorage.setItem(ROUND_KEY, JSON.stringify({ v: 2, rounds: Object.fromEntries(keep.map((r) => [roundId(r.game, r.mode), r])) }));
  } catch {
    // storage full or unavailable; the round just won't resume
  }
}

export function saveRound(r: RoundSnapshot): void {
  const id = roundId(r.game, r.mode);
  const rest = readRounds();
  delete rest[id];
  writeRounds({ [id]: r, ...rest }); // the newest first, so it wins a savedAt tie
}

export function loadRound<I>(game: GameId, mode: GameMode): RoundSnapshot<I> | null {
  return (readRounds()[roundId(game, mode)] as RoundSnapshot<I> | undefined) ?? null;
}

/** The round to offer as "Resume": the most recently played one with an answer. */
export function peekRound(): { game: GameId; mode: GameMode; answered: number; total: number } | null {
  const r = Object.values(readRounds())
    .filter((x) => x.results.some(Boolean))
    .sort((a, b) => b.savedAt - a.savedAt)[0];
  return r ? { game: r.game, mode: r.mode, answered: r.results.filter(Boolean).length, total: r.items.length } : null;
}

/** Drops the saved round of one game and mode, or (no arguments) every saved round. */
export function clearRound(game?: GameId, mode?: GameMode): void {
  if (game && mode) {
    const all = readRounds();
    if (!all[roundId(game, mode)]) return;
    delete all[roundId(game, mode)];
    writeRounds(all);
    return;
  }
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(ROUND_KEY);
  } catch {
    // ignore
  }
}

export interface FinishSummary {
  game: GameId;
  mode: GameMode;
  total: number;
  firstTry: number;
  stars: 1 | 2 | 3;
  xp: number;
  bonuses: { label: string; xp: number }[];
  bestCombo: number;
  newBest: boolean;
  practised: number;
  strengthened: number;
  misses: string[];
  level: { before: number; after: number };
  medals: { verbId: string; medal: 1 | 2 | 3 }[];
  badges: string[];
  goalJustMet: boolean;
  nextStop: GameId | null;
}

/**
 * Books a finished round in one write, on the day it started: the XP not
 * banked yet and the bonuses (item XP was already ×2 in terminus), best,
 * plays, the day log, the ride, medals and badges. Only a round that started
 * while the terminus ×2 was due (`double`) counts as the terminus; any other
 * terminus round is free play.
 * In a sprint `total` is the number answered and stars go by the number right.
 */
export function finishRound(r: RoundSnapshot): FinishSummary {
  const sprint = r.mode === 'sprint';
  const answered = r.results.filter(Boolean) as { ok: boolean; firstTry: boolean }[];
  const right = answered.filter((x) => x.ok).length;
  const prior = !sprint && r.prior ? r.prior : { total: 0, firstTry: 0 };
  const firstTry = answered.filter((x) => x.ok && x.firstTry).length + prior.firstTry;
  const total = sprint ? answered.length : r.items.length + prior.total;
  const stars = starsFor(sprint ? right : firstTry, total, sprint);
  const banked = Math.max(0, Math.min(r.xp, r.banked ?? 0));
  const bonuses: { label: string; xp: number }[] = [];
  if (answered.length) bonuses.push({ label: 'Round finished', xp: XP.round });
  if (answered.length && stars === 3) bonuses.push({ label: '★★★', xp: XP.perfect });
  const startLevel = (xp: number) => levelFromXp(Math.max(0, xp - banked));
  const summary: FinishSummary = {
    game: r.game,
    mode: r.mode,
    total,
    firstTry,
    stars,
    xp: r.xp,
    bonuses,
    bestCombo: r.bestCombo,
    newBest: false,
    practised: answered.length,
    strengthened: r.strengthened,
    misses: [...new Set(r.misses)].slice(0, 5),
    level: { before: startLevel(getState().play.xp), after: levelFromXp(getState().play.xp) },
    medals: [],
    badges: [],
    goalJustMet: false,
    nextStop: null,
  };
  if (!answered.length) return summary; // a sprint that ran out untouched
  const terminus = r.mode === 'terminus' && !!r.double;
  setState((s) => {
    const p = s.play;
    const log = logFor(s, r.date || today());
    const before = startLevel(p.xp);
    // A terminus round paid item XP ×2; its best counts the plain item XP so bests stay comparable.
    const score = sprint ? right : (terminus ? Math.round(r.xp / 2) : r.xp) + bonuses.reduce((a, b) => a + b.xp, 0);
    if (r.mode === 'ride' || terminus) {
      log.stops = (log.stops ?? 0) + 1;
      // A stop finished today without a ride saved starts today's ride; one
      // begun yesterday fills yesterday's ride if that is still the saved one.
      if (r.mode === 'ride' && log.date === today() && (!p.ride || p.ride.date !== log.date)) p.ride = { date: log.date, plan: ridePlan(s, log.date), done: [], terminus: false };
      const ride = p.ride && p.ride.date === log.date ? p.ride : null;
      if (ride && terminus) ride.terminus = true;
      else if (ride) {
        if (ride.plan.includes(r.game) && !ride.done.includes(r.game)) ride.done.push(r.game);
        if (ride.plan.every((id) => ride.done.includes(id)) && !log.tasks.includes('ride')) {
          log.tasks.push('ride');
          bonuses.push({ label: 'Line finished', xp: XP.goal });
          summary.goalJustMet = true;
        }
        summary.nextStop = log.date === today() ? (ride.plan.find((id) => !ride.done.includes(id)) ?? null) : null;
      }
    }
    const xp = r.xp + bonuses.reduce((a, b) => a + b.xp, 0);
    p.xp += xp - banked;
    log.xp = (log.xp ?? 0) + xp - banked;
    summary.xp = xp;
    const key = sprint ? `${r.game}:sprint` : r.game;
    const prev = p.best[key];
    summary.newBest = score > 0 && score > (prev?.score ?? 0);
    p.best[key] = {
      stars: Math.max(prev?.stars ?? 0, stars) as 0 | 1 | 2 | 3,
      score: Math.max(prev?.score ?? 0, score),
      combo: Math.max(prev?.combo ?? 0, r.bestCombo),
      at: summary.newBest || !prev ? Date.now() : prev.at,
    };
    p.plays[r.game] = (p.plays[r.game] ?? 0) + 1;
    const task = `play:${r.game}`;
    if (!log.tasks.includes(task)) log.tasks.push(task);
    for (const id of new Set(r.verbIds)) {
      const v = verbById.get(id);
      if (!v) continue;
      const m = verbMedal(v, s.cards);
      if (m > (p.medals[id] ?? 0)) {
        p.medals[id] = m as 1 | 2 | 3;
        summary.medals.push({ verbId: id, medal: m as 1 | 2 | 3 });
      }
    }
    for (const b of BADGES) {
      if (!p.badges.includes(b.id) && b.test(s)) {
        p.badges.push(b.id);
        summary.badges.push(b.id);
      }
    }
    summary.level = { before, after: levelFromXp(p.xp) };
  });
  return summary;
}

// ---------- Juice ----------

let ctx: AudioContext | null = null;

// Created on first use, which is always inside a tap (iOS needs a gesture).
function audio(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  const sleep = () => {
    if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) sleep();
    });
  }
  window.addEventListener('pagehide', sleep);
  return ctx;
}

function wake(c: AudioContext): void {
  if (c.state !== 'running') c.resume().catch(() => {});
}

function tone(c: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = 'sine', gain = 0.08): void {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

export function sfx(kind: 'right' | 'wrong' | 'combo' | 'done' | 'tap'): void {
  if (!getState().settings.sound) return;
  const c = audio();
  if (!c) return;
  try {
    wake(c);
    const t = c.currentTime + 0.01;
    if (kind === 'right') {
      tone(c, 660, t, 0.06);
      tone(c, 880, t + 0.06, 0.06);
    } else if (kind === 'wrong') tone(c, 196, t, 0.12, 'triangle', 0.1);
    else if (kind === 'combo') [523, 659, 784].forEach((f, i) => tone(c, f, t + i * 0.05, 0.05));
    else if (kind === 'done') [523, 659, 784, 1047].forEach((f, i) => tone(c, f, t + i * 0.09, i === 3 ? 0.22 : 0.09));
    else tone(c, 1200, t, 0.02, 'sine', 0.03);
  } catch {
    // audio is a nicety
  }
}

/** Call from the Sound toggle's onClick: unlocks audio on iOS. */
export function primeAudio(): void {
  const c = audio();
  if (!c) return;
  try {
    wake(c);
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
  } catch {
    // ignore
  }
}

export function say(text: string, gender?: 'm' | 'f'): void {
  if (!getState().settings.gameVoice || !ttsSupported()) return;
  speak(text, { gender }).catch(() => {});
}

export function calm(): boolean {
  if (getState().settings.calm) return true;
  try {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// ---------- Randomness ----------

/** mulberry32 */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function daySeed(date?: string): number {
  return hashSeed(date ?? today());
}

export function shuffle<T>(xs: T[], rnd: () => number = Math.random): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function sample<T>(xs: T[], n: number, rnd: () => number = Math.random): T[] {
  const out = [...xs];
  const k = Math.max(0, Math.min(n, out.length));
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rnd() * (out.length - i));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, k);
}

// ---------- Verb content ----------

export const PRONOUNS: string[] = ['אני', 'אתה', 'את', 'הוא', 'היא', 'אנחנו', 'אתם', 'אתן', 'הם', 'הן'];
const ALL_TENSES: TenseKey[] = ['present', 'past', 'future', 'imp'];

export function allowedTenses(s: AppState): TenseKey[] {
  if (levelRank(s.level) >= 1) return [...ALL_TENSES];
  const carded = new Set(Object.keys(s.cards).filter((k) => k.startsWith('c:')).map((k) => k.split(':')[2]));
  return ALL_TENSES.filter((t) => t === 'present' || carded.has(t));
}

export function levelOk(itemLevel: string, s: AppState, ahead = 1): boolean {
  return levelRank(itemLevel) <= levelRank(s.level) + ahead;
}

export interface VerbPick {
  verb: Verb;
  tense: TenseKey;
  cardId: string | null;
  due: boolean;
}

/**
 * Verb-tenses to practise: due cards (oldest first), then other cards (weak
 * binyan/tense first, then lowest stability), then uncarded ones in teaching
 * order. `opts.tenses` is narrowed to allowedTenses(s). Without dueFirst about
 * 70 % come from carded tenses and the result is shuffled. Among not-due and
 * uncarded tenses the pick varies within a window twice the size needed.
 */
export function pickVerbTenses(
  s: AppState,
  n: number,
  opts: { tenses?: TenseKey[]; dueFirst?: boolean; maxPerVerb?: number; rnd?: () => number } = {},
): VerbPick[] {
  const rnd = opts.rnd ?? Math.random;
  const maxPerVerb = opts.maxPerVerb ?? 2;
  const allowed = allowedTenses(s);
  const tenses = (opts.tenses ?? allowed).filter((t) => allowed.includes(t));
  const now = Date.now();
  const weakB = weakTopics('binyan:', s)[0]?.topic.slice(7);
  const weakT = weakTopics('tense:', s)[0]?.topic.slice(6);
  const focus = (p: VerbPick) => (p.verb.binyan === weakB ? 0 : 1) + (p.tense === weakT ? 0 : 1);
  const order = new Map<string, number>();
  verbCardOrder().forEach((x, i) => order.set(`${x.verb.id}:${x.tense}`, i));
  // The imperative has no card: it comes right after the verb's other tenses.
  const rank = (p: VerbPick) => {
    const k = (t: string) => order.get(`${p.verb.id}:${t}`);
    if (p.tense !== 'imp') return k(p.tense) ?? Infinity;
    return (k('future') ?? k('past') ?? k('present') ?? Infinity) + 0.5;
  };
  type Cand = { pick: VerbPick; card?: CardState; used?: boolean };
  const a: Cand[] = [];
  const b: Cand[] = [];
  const c: Cand[] = [];
  for (const verb of verbs) {
    if (!levelOk(verb.level, s)) continue;
    for (const tense of tenses) {
      if (!drillable(verb, tense)) continue;
      const cardId = tense === 'imp' ? null : `c:${verb.id}:${tense}`;
      const card = cardId ? s.cards[cardId] : undefined;
      const due = !!card && isDue(card, now);
      (card ? (due ? a : b) : c).push({ pick: { verb, tense, cardId, due }, card });
    }
  }
  a.sort((x, y) => x.card!.due - y.card!.due);
  b.sort((x, y) => focus(x.pick) - focus(y.pick) || x.card!.s - y.card!.s);
  c.sort((x, y) => rank(x.pick) - rank(y.pick));
  const out: VerbPick[] = [];
  const perVerb = new Map<string, number>();
  const take = (list: Cand[], need: number, varied: boolean) => {
    if (need <= 0) return;
    const win = varied ? need * 2 : 0;
    let got = 0;
    for (const x of [...shuffle(list.slice(0, win), rnd), ...list.slice(win)]) {
      if (got >= need) break;
      const k = perVerb.get(x.pick.verb.id) ?? 0;
      if (x.used || k >= maxPerVerb) continue;
      perVerb.set(x.pick.verb.id, k + 1);
      x.used = true;
      out.push(x.pick);
      got++;
    }
  };
  if (opts.dueFirst) {
    take(a, n, false);
    take(b, n - out.length, true);
    take(c, n - out.length, true);
    return out;
  }
  const carded = Math.round(n * 0.7);
  take(a, carded, false);
  take(b, carded - out.length, true);
  take(c, n - out.length, true);
  take(a, n - out.length, false);
  take(b, n - out.length, true);
  return shuffle(out, rnd);
}

function pronounMap(t: TenseKey): Record<string, [string, string][]> {
  return t === 'present' ? PRESENT_PRONOUNS : t === 'future' ? FUTURE_PRONOUNS : t === 'imp' ? IMP_PRONOUNS : PERSON_PRONOUNS;
}

export function pronounsFor(t: TenseKey, person: string): [string, string][] {
  return pronounMap(t)[person] ?? [];
}

/** Persons a pronoun can be in a tense: present אני → ['ms', 'fs']; future אתן → ['2mp']. */
export function personsFor(t: TenseKey, pronoun: string): string[] {
  return Object.entries(pronounMap(t))
    .filter(([, prs]) => prs.some(([p]) => p === pronoun))
    .map(([k]) => k);
}

export function formOf(v: Verb, t: TenseKey, person: string): string | undefined {
  return tableOf(v, t)?.[person]?.[0];
}

export function sameForm(a: string, b: string): boolean {
  return lenient(a) === lenient(b);
}

/** Every pronoun that can say this form in this tense (כתבת → אתה, את). */
export function validPronouns(v: Verb, t: TenseKey, form: string): string[] {
  const found = new Set<string>();
  for (const [person, f] of Object.entries(tableOf(v, t) ?? {})) {
    if (sameForm(f[0], form)) for (const [p] of pronounsFor(t, person)) found.add(p);
  }
  return PRONOUNS.filter((p) => found.has(p));
}

const TO_FINAL: Record<string, string> = { 'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ' };
const TO_REGULAR: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

export function unfinal(w: string): string {
  return w.replace(/[ךםןףץ]/g, (c) => TO_REGULAR[c]);
}

/** Final letters at the end of each word (and only there): קמ → קם. */
export function finalize(w: string): string {
  return unfinal(w).replace(/[כמנפצ](?=[֑-ׇ]*(?:$|[^֑-ׇא-ת'׳"״]))/g, (c) => TO_FINAL[c]);
}

// Longest substring shared by all words (the leftmost one in the shortest word).
function commonStem(words: string[]): string {
  const [base, ...rest] = [...words].sort((x, y) => x.length - y.length);
  if (base === undefined) return '';
  for (let len = base.length; len > 0; len--) {
    for (let i = 0; i + len <= base.length; i++) {
      const sub = base.slice(i, i + len);
      if (rest.every((w) => w.includes(sub))) return sub;
    }
  }
  return '';
}

/**
 * A tense table as stem + prefix and suffix chunks, all without final letters
 * (finalize() for display). Null when the stem is under 2 letters (ליפול future).
 */
export function splitTable(v: Verb, t: Tense): { stem: string; pre: string[]; suf: string[]; parts: Record<string, { pre: string; suf: string }> } | null {
  const table = tableOf(v, t);
  if (!table) return null;
  const rows = Object.entries(table).map(([person, f]) => [person, unfinal(f[0])] as const);
  const stem = commonStem(rows.map(([, f]) => f));
  if (stem.length < 2) return null;
  const pre: string[] = [];
  const suf: string[] = [];
  const parts: Record<string, { pre: string; suf: string }> = {};
  for (const [person, f] of rows) {
    const i = f.indexOf(stem);
    const part = { pre: f.slice(0, i), suf: f.slice(i + stem.length) };
    parts[person] = part;
    if (!pre.includes(part.pre)) pre.push(part.pre);
    if (!suf.includes(part.suf)) suf.push(part.suf);
  }
  return { stem, pre, suf, parts };
}

/**
 * Wrong forms of the same verb to offer next to `person`'s form: other persons
 * of the tense and forms of its other drillable tenses (one of each when
 * n ≥ 2). None is sameForm to the target, to `exclude` or to another.
 */
export function confuserForms(v: Verb, t: TenseKey, person: string, n: number, rnd: () => number = Math.random, exclude: string[] = []): string[] {
  const target = formOf(v, t, person);
  if (!target || n <= 0) return [];
  const taken = [target, ...exclude];
  const fresh = (f: string) => !taken.some((x) => sameForm(x, f));
  const same = shuffle(
    Object.entries(tableOf(v, t) ?? {})
      .filter(([p]) => p !== person)
      .map(([, f]) => f[0]),
    rnd,
  );
  const other = shuffle(
    ALL_TENSES.filter((x) => x !== t && drillable(v, x)).flatMap((x) => Object.values(tableOf(v, x) ?? {}).map((f) => f[0])),
    rnd,
  );
  const out: string[] = [];
  const add = (pool: string[], max: number) => {
    for (const f of pool) {
      if (out.length >= max) return;
      if (fresh(f)) {
        out.push(f);
        taken.push(f);
      }
    }
  };
  if (n >= 2) {
    add(same, 1);
    add(other, out.length + 1);
  }
  add(shuffle([...same, ...other], rnd), n);
  return shuffle(out, rnd);
}

let formIdx: Map<string, { verbId: string; tense: TenseKey; person: string }[]> | null = null;

/** Every drillable verb form by its lenient spelling. */
export function formIndex(): Map<string, { verbId: string; tense: TenseKey; person: string }[]> {
  if (formIdx) return formIdx;
  const m = new Map<string, { verbId: string; tense: TenseKey; person: string }[]>();
  for (const v of verbs) {
    for (const tense of ALL_TENSES) {
      if (!drillable(v, tense)) continue;
      for (const [person, f] of Object.entries(tableOf(v, tense) ?? {})) {
        const k = lenient(f[0]);
        const list = m.get(k) ?? [];
        list.push({ verbId: v.id, tense, person });
        m.set(k, list);
      }
    }
  }
  formIdx = m;
  return m;
}

// ---------- Vocab ----------

function glosses(x: VocabItem): Set<string> {
  const out = new Set<string>();
  for (const g of [x.en, ...(x.enAlt ?? [])]) {
    for (const part of [g, ...g.split(/[/,;]/)]) {
      const n = normalizeEn(part);
      if (n) out.add(n);
    }
  }
  return out;
}

/** Whether two words share an English gloss (so one English tile could fit both). */
export function sameGloss(a: VocabItem, b: VocabItem): boolean {
  const ga = glosses(a);
  for (const g of glosses(b)) if (ga.has(g)) return true;
  return false;
}

export function isSingleWord(he: string): boolean {
  return !/[\s/]/.test(he.trim());
}

/**
 * Words for a tap round: carded words that are due or still learning, then
 * known ones seen longest ago, then new words at the learner's level (cardId
 * null). Each group varies within a window twice the size needed. Grouped by
 * topic so that runs share a topic.
 */
export function vocabPool(s: AppState, n: number, rnd: () => number = Math.random): { item: VocabItem; cardId: string | null }[] {
  const now = Date.now();
  type Cand = { item: VocabItem; cardId: string | null; card?: CardState };
  const hot: Cand[] = [];
  const warm: Cand[] = [];
  for (const [id, card] of Object.entries(s.cards)) {
    if (!id.startsWith('v:')) continue;
    const item = findVocab(id.slice(2)) ?? s.custom.find((x) => x.id === id.slice(2));
    if (!item) continue;
    (isDue(card, now) || card.s < 4 ? hot : warm).push({ item, cardId: id, card });
  }
  hot.sort((x, y) => x.card!.due - y.card!.due);
  warm.sort((x, y) => x.card!.last - y.card!.last);
  const out: { item: VocabItem; cardId: string | null }[] = [];
  const seen = new Set<string>();
  const take = (list: Cand[]) => {
    const need = n - out.length;
    if (need <= 0) return;
    for (const x of [...shuffle(list.slice(0, need * 2), rnd), ...list.slice(need * 2)]) {
      if (out.length >= n) return;
      if (seen.has(x.item.id)) continue;
      seen.add(x.item.id);
      out.push({ item: x.item, cardId: x.cardId });
    }
  };
  take(hot);
  take(warm);
  if (out.length < n) {
    const fresh: Cand[] = [];
    const want = (n - out.length) * 2;
    for (const item of newWordOrder()) {
      if (fresh.length >= want) break;
      if (!seen.has(item.id) && !s.cards[`v:${item.id}`] && levelOk(item.level, s)) fresh.push({ item, cardId: null });
    }
    take(fresh);
  }
  const topics = [...new Set(out.map((x) => x.item.topic))];
  return topics.flatMap((t) => out.filter((x) => x.item.topic === t));
}

// ---------- Collection and badges ----------

/** 🥉 one drillable tense known · 🥈 all known · 🥇 all mature (FSRS only). */
export function verbMedal(v: Verb, cards: AppState['cards']): 0 | 1 | 2 | 3 {
  const st = TENSES.filter((t) => drillable(v, t)).map((t) => strength(cards[`c:${v.id}:${t}`]));
  if (!st.length) return 0;
  const known = (x: string) => x === 'known' || x === 'mature';
  if (st.every((x) => x === 'mature')) return 3;
  if (st.every(known)) return 2;
  return st.some(known) ? 1 : 0;
}

const daysWith = (s: AppState, task: string) => s.days.filter((d) => d.tasks.includes(task)).length;
const MAIN_BINYANIM = ['paal', 'piel', 'hifil', 'hitpael', 'nifal'];

export const BADGES: { id: string; emoji: string; he: string; en: string; test: (s: AppState) => boolean }[] = [
  { id: 'first-stop', emoji: '🚏', he: 'תחנה ראשונה', en: 'First stop: a round finished', test: (s) => Object.values(s.play.plays).some((n) => n > 0) },
  { id: 'regular', emoji: '🎟️', he: 'כרטיסייה מלאה', en: 'Regular: 7 days with a full ride', test: (s) => daysWith(s, 'ride') >= 7 },
  { id: 'combo-10', emoji: '🔥', he: 'וואלה!', en: 'Combo of 10', test: (s) => Object.values(s.play.best).some((b) => b.combo >= 10) },
  { id: 'perfect', emoji: '⭐', he: 'מושלם', en: 'A ★★★ round', test: (s) => Object.values(s.play.best).some((b) => b.stars === 3) },
  { id: 'six-7', emoji: '🟩', he: 'שבוע של פעלים', en: '7 days of Verb of the Day', test: (s) => daysWith(s, 'play:six') >= 7 },
  { id: 'smith', emoji: '🔨', he: 'נפחייה', en: 'Smith: 10 Verb Forge rounds', test: (s) => (s.play.plays.forge ?? 0) >= 10 },
  { id: 'gold', emoji: '🥇', he: 'זהב', en: 'A gold verb', test: (s) => verbs.some((v) => verbMedal(v, s.cards) === 3) },
  { id: 'binyanim', emoji: '🏗️', he: 'חמשת הבניינים', en: 'Silver in all five binyanim', test: (s) => MAIN_BINYANIM.every((b) => verbs.some((v) => v.binyan === b && verbMedal(v, s.cards) >= 2)) },
  { id: 'driver', emoji: '🚌', he: 'על ההגה', en: 'Level 10', test: (s) => levelFromXp(s.play.xp) >= 10 },
];

// Shoresh Play UI kit: the round hook (snapshot resume, combo, XP, advance),
// the game shell with its bottom controls and result card, and the shared
// widgets every mode uses (choices, tiles, tense band, Shorshi, the line map).
import type { ComponentChildren, JSX } from 'preact';
import { createContext } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { verbById } from '../lib/content.ts';
import { isMac } from '../lib/platform.ts';
import { go } from '../lib/router.ts';
import { type GameId, getState, setState, today, useAppState } from '../lib/store.ts';
import { stopSpeaking } from '../lib/tts.ts';
import type { TenseKey } from '../lib/verbdrill.ts';
import {
  applyEvidence,
  BADGES,
  calm,
  clearRound,
  comboMultiplier,
  type Evidence,
  type FinishSummary,
  finishRound,
  GAMES,
  type GameMode,
  itemXp,
  loadRound,
  playerLevel,
  primeAudio,
  RANKS,
  type RoundSnapshot,
  saveRound,
  sfx,
  TENSE_LABEL,
  type Tier,
} from './kit.ts';

// ---------- Round ----------

export interface Outcome {
  ok: boolean;
  firstTry?: boolean; // default: no miss() was recorded for the item
  index?: number; // defaults to the current item
  evidence?: Evidence[];
  xpTier?: Tier;
  xpScale?: number;
  miss?: string; // label for the result card when not right first try, e.g. "אנחנו · עתיד → נדבר"
  verbId?: string; // checked for new medals when the round ends
}

export interface Round<I> {
  items: I[];
  index: number;
  item: I | null; // the first unanswered item, or the one just answered while its reveal is up
  answered: number;
  total: number;
  status: boolean | null; // the verdict on screen (null: waiting for an answer)
  combo: number;
  bestCombo: number;
  xp: number;
  lastGain: number;
  timeLeft: number | null; // whole seconds left in a sprint
  summary: FinishSummary | null;
  resumed: boolean;
  rated: Set<string>; // cards already reviewed this round (seed it to carry one over, e.g. Daily Six)
  // Applies evidence, XP, combo and sfx, saves the snapshot and returns the XP gained.
  //   'auto' (default): right moves on after 450 ms; wrong shows Continue (live after 400 ms).
  //   'now': moves on at once. 'hold': always shows Continue.
  answer(o: Outcome, advance?: 'auto' | 'now' | 'hold'): number;
  miss(evidence?: Evidence[], index?: number): void; // a wrong try that doesn't end the item (Match, Smash)
  next(): void; // what Continue does
  restart(): void; // a fresh round (Again)
  shell?: ShellState; // read by GameShell
}

// Extra round state for GameShell.
export interface ShellState {
  hold: boolean; // Continue is showing
  ready: boolean; // ...and takes taps
  sprintSec?: number;
  misses: number; // misses on the current item
  right: number;
  double: boolean; // terminus round paying item XP ×2
}

export interface RoundOpts<I> {
  game: GameId;
  mode: GameMode;
  tier: Tier;
  build: () => I[];
  sprintSec?: number;
}

interface Live<I> {
  snap: RoundSnapshot<I>;
  rated: Set<string>;
  resumed: boolean;
  saved: boolean; // the stored snapshot is this round's
  double: boolean; // terminus: item XP ×2
  index: number;
  status: boolean | null;
  hold: boolean; // Continue is showing
  ready: boolean; // ...and takes taps
  lastGain: number;
  misses: number; // misses on the current item, for the live region
  right: number;
  summary: FinishSummary | null;
  pending: FinishSummary | null; // booked; shown once the last reveal is done
  finished: boolean;
  msLeft: number | null;
  last: number | null; // when the sprint clock last ticked (null: paused)
}

const AUTO_MS = 450; // a right answer moves on by itself
const CONTINUE_MS = 400; // Continue ignores taps this long after an answer
const COMBO_STEPS = [3, 6, 10];
const PRAISE: Record<number, string> = { 3: 'יופי!', 6: 'אש!', 10: 'וואלה!' };

const firstOpen = (results: RoundSnapshot['results']) => results.findIndex((r) => !r);
const begun = (s: RoundSnapshot) => s.results.some(Boolean) || s.missed.length > 0;

// Terminus pays ×2 once a day, after the line is finished.
function terminusOpen(): boolean {
  const ride = getState().play.ride;
  return !!ride && ride.date === today() && ride.plan.length > 0 && ride.plan.every((g) => ride.done.includes(g)) && !ride.terminus;
}

function begin<I>(o: RoundOpts<I>, resume: boolean): Live<I> {
  const saved = resume ? loadRound<I>(o.game, o.mode) : null;
  let snap = saved;
  if (!snap) {
    const items = o.build();
    const now = Date.now();
    snap = {
      v: 1,
      game: o.game,
      mode: o.mode,
      date: today(),
      startedAt: now,
      savedAt: now,
      items,
      results: items.map(() => null),
      missed: [],
      xp: 0,
      combo: 0,
      bestCombo: 0,
      strengthened: 0,
      rated: [],
      misses: [],
      verbIds: [],
    };
    if (o.sprintSec) snap.timeLeftMs = o.sprintSec * 1000;
  }
  return {
    snap,
    rated: new Set(snap.rated),
    resumed: !!saved,
    saved: !!saved,
    double: o.mode === 'terminus' && terminusOpen(),
    index: Math.max(0, firstOpen(snap.results)),
    status: null,
    hold: false,
    ready: false,
    lastGain: 0,
    misses: 0,
    right: snap.results.filter((x) => x?.ok).length,
    summary: null,
    pending: null,
    finished: false,
    msLeft: o.sprintSec ? (snap.timeLeftMs ?? o.sprintSec * 1000) : null,
    last: null,
  };
}

// Verbs whose medals to check at the end: the outcome's own and any c: card touched.
function noteVerbs(snap: RoundSnapshot, verbId?: string, evidence?: Evidence[]): void {
  const ids = [verbId, ...(evidence ?? []).map((e) => (e.cardId?.startsWith('c:') ? e.cardId.split(':')[1] : undefined))];
  for (const id of ids) if (id && !snap.verbIds.includes(id)) snap.verbIds.push(id);
}

function sync<I>(l: Live<I>): void {
  l.snap.rated = [...l.rated];
  l.snap.savedAt = Date.now();
  if (l.msLeft !== null) l.snap.timeLeftMs = l.msLeft;
}

// Saves an unfinished round that has begun (an untouched one just starts over).
function keep<I>(l: Live<I>): void {
  if (l.finished || !begun(l.snap)) return;
  sync(l);
  saveRound(l.snap);
  l.saved = true;
}

type Timer = ReturnType<typeof setTimeout>;

/** The round behind useRound, without Preact (node tests drive it directly). */
export interface RoundMachine<I> {
  readonly id: string; // `${game}:${mode}`: another game or mode is another round
  view(): Round<I>;
  setOpts(o: RoundOpts<I>): void;
  timed(): boolean; // a sprint clock is running
  clock(now: number, hidden: boolean): void; // advances the sprint clock; hidden pauses it
  hide(): void; // the page was hidden: save, pause the clock
  dispose(): void; // unmount: stop timers, keep a sprint's time left
}

export function createRound<I extends { key: string }>(o: RoundOpts<I>, onChange: () => void): RoundMachine<I> {
  let opts = o;
  let l = begin(o, true);
  let autoT: Timer | undefined;
  let readyT: Timer | undefined;
  const stopTimers = () => {
    clearTimeout(autoT);
    clearTimeout(readyT);
    autoT = readyT = undefined;
  };
  // Books the round (XP, bests, ride, medals) as soon as it is over, so closing
  // the app during the last reveal loses nothing.
  const finish = (): FinishSummary => {
    stopTimers();
    sync(l);
    l.finished = true;
    const sum = finishRound(l.snap);
    // Only drop the stored round if it is this one (an untouched round never saved).
    if (l.saved) clearRound();
    sfx('done');
    return sum;
  };
  const next = () => {
    stopTimers();
    if (l.pending) {
      l.summary = l.pending;
      l.pending = null;
    }
    l.status = null;
    l.hold = false;
    l.ready = false;
    const i = firstOpen(l.snap.results);
    if (i >= 0) l.index = i;
    onChange();
  };
  const answer = (out: Outcome, advance: 'auto' | 'now' | 'hold' = 'auto'): number => {
    const { snap } = l;
    const i = out.index ?? l.index;
    if (l.finished || i < 0 || i >= snap.items.length || snap.results[i]) return 0;
    const firstTry = out.ok && (out.firstTry ?? !snap.missed.includes(i));
    snap.results[i] = { ok: out.ok, firstTry };
    if (out.evidence?.length) snap.strengthened += applyEvidence(out.evidence, l.rated);
    noteVerbs(snap, out.verbId, out.evidence);
    snap.combo = firstTry ? snap.combo + 1 : 0;
    snap.bestCombo = Math.max(snap.bestCombo, snap.combo);
    const gain = out.ok ? itemXp(out.xpTier ?? opts.tier, snap.combo, out.xpScale, l.double) : 0;
    snap.xp += gain;
    if (out.miss && !firstTry) snap.misses.push(out.miss);
    l.lastGain = gain;
    l.misses = 0;
    if (out.ok) l.right++;
    sfx(!out.ok ? 'wrong' : COMBO_STEPS.includes(snap.combo) ? 'combo' : 'right');
    stopTimers();
    if (snap.results.every(Boolean)) l.pending = finish();
    else keep(l);
    if (advance === 'now') {
      next();
      return gain;
    }
    l.index = i;
    l.status = out.ok;
    l.hold = advance === 'hold' || !out.ok;
    l.ready = false;
    const mine = l;
    if (l.hold) {
      readyT = setTimeout(() => {
        mine.ready = true;
        onChange();
      }, CONTINUE_MS);
    } else autoT = setTimeout(next, AUTO_MS);
    onChange();
    return gain;
  };
  const miss = (evidence?: Evidence[], index?: number) => {
    const { snap } = l;
    const i = index ?? l.index;
    if (l.finished || i < 0 || i >= snap.items.length || snap.results[i]) return;
    if (!snap.missed.includes(i)) snap.missed.push(i);
    if (evidence?.length) snap.strengthened += applyEvidence(evidence, l.rated);
    noteVerbs(snap, undefined, evidence);
    snap.combo = 0;
    l.lastGain = 0;
    l.misses++;
    sfx('wrong');
    keep(l);
    onChange();
  };
  const restart = () => {
    stopTimers();
    if (l.saved && !l.finished) clearRound();
    l = begin(opts, false);
    onChange();
  };
  // Time is up: the round ends on the spot, even mid-reveal.
  const timeUp = () => {
    if (l.finished) return;
    l.msLeft = 0;
    l.summary = finish();
    l.pending = null;
    l.status = null;
    l.hold = false;
    l.ready = false;
    onChange();
  };
  const timed = () => l.msLeft !== null && !l.finished && l.snap.items.length > 0;
  return {
    id: `${o.game}:${o.mode}`,
    setOpts: (x) => {
      opts = x;
    },
    timed,
    clock(now, hidden) {
      if (!timed()) return;
      if (hidden || l.last === null) {
        l.last = hidden ? null : now;
        return;
      }
      const before = l.msLeft!;
      l.msLeft = Math.max(0, before - Math.max(0, now - l.last));
      l.last = now;
      if (l.msLeft <= 0) timeUp();
      else if (Math.ceil(l.msLeft / 1000) !== Math.ceil(before / 1000)) onChange();
    },
    hide() {
      keep(l);
      l.last = null;
    },
    dispose() {
      stopTimers();
      if (l.msLeft !== null) keep(l);
      l.last = null;
    },
    view() {
      const { snap } = l;
      return {
        items: snap.items,
        index: l.index,
        item: l.summary ? null : (snap.items[l.index] ?? null),
        answered: snap.results.filter(Boolean).length,
        total: snap.items.length,
        status: l.status,
        combo: snap.combo,
        bestCombo: snap.bestCombo,
        xp: snap.xp,
        lastGain: l.lastGain,
        timeLeft: l.msLeft === null ? null : Math.ceil(l.msLeft / 1000),
        summary: l.summary,
        resumed: l.resumed,
        rated: l.rated,
        answer,
        miss,
        next,
        restart,
        shell: { hold: l.hold, ready: l.ready, sprintSec: opts.sprintSec, misses: l.misses, right: l.right, double: l.double },
      };
    },
  };
}

/**
 * One round of a game: resumes today's snapshot of the same game and mode, else
 * calls `build` once. Books it with finishRound (once) as soon as every item is
 * answered or the sprint clock runs out; the result card shows after the last
 * reveal. The sprint clock stops while the page is hidden. A new game or mode
 * (ride → terminus on the same screen) starts a new round.
 */
export function useRound<I extends { key: string }>(o: { game: GameId; mode: GameMode; tier: Tier; build: () => I[]; sprintSec?: number }): Round<I> {
  const [, force] = useState(0);
  const ref = useRef<RoundMachine<I> | null>(null);
  if (ref.current?.id !== `${o.game}:${o.mode}`) {
    ref.current?.dispose();
    ref.current = createRound(o, () => force((n) => n + 1));
  } else ref.current.setOpts(o);
  const m = ref.current;
  const view = m.view();
  const timed = m.timed();

  // Sprint clock: runs only while the page is visible.
  useEffect(() => {
    if (!timed) return;
    const tick = () => m.clock(Date.now(), document.hidden);
    const onVis = () => (document.hidden ? m.hide() : tick());
    tick();
    const t = setInterval(tick, 250);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [m, timed, view.items]);

  // Leaving mid-sprint keeps the time left; other rounds are saved after every answer.
  useEffect(() => () => ref.current?.dispose(), []);

  return view;
}

// ---------- Bump guard ----------

// Taps within `ms` of `dep` changing are ignored (a bus bump, a double tap).
// Widgets also mark their buttons disabled meanwhile, so tests and assistive
// tech see the same thing; the buttons don't change look.
function useGuard(dep: unknown, ms: number): [boolean, () => boolean] {
  const g = useRef<{ dep: unknown; at: number } | null>(null);
  const [tick, force] = useState(0);
  if (!g.current || !Object.is(g.current.dep, dep)) g.current = { dep, at: Date.now() };
  const { at } = g.current;
  const locked = Date.now() - at < ms;
  useEffect(() => {
    if (!locked) return;
    const t = setTimeout(() => force((n) => n + 1), Math.max(0, at + ms - Date.now()) + 10);
    return () => clearTimeout(t);
  }, [at, locked, tick]);
  return [locked, () => Date.now() - at < ms];
}

export function useBumpGuard(dep: unknown, ms = 250): boolean {
  return useGuard(dep, ms)[0];
}

// Which item is on screen (GameShell provides it), so the guard re-arms even
// when two items share the same choices (He or She?, the tense lanes).
const ItemKey = createContext('');

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
// A focused control handles its own Enter (a disabled one, e.g. the option just picked, doesn't).
function interactive(t: EventTarget | null): boolean {
  const el = t instanceof HTMLElement ? t.closest('input, textarea, select, button, a[href], [contenteditable]') : null;
  return !!el && !(el as HTMLButtonElement).disabled;
}

// ---------- Shell ----------

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const noop = () => {};

/**
 * The game screen: header (✕, title and progress, combo, XP, sound), the stage,
 * the controls pinned at the bottom with Continue under them after a miss, a
 * live region, and the result card once the round is booked. ✕ never asks: the
 * snapshot is already saved.
 */
export function GameShell(p: {
  game: GameId;
  mode: GameMode;
  round: Round<unknown>;
  prompt: ComponentChildren;
  controls: ComponentChildren;
  live?: string;
  onAgain?: () => void;
  result?: ComponentChildren; // extra lines on the result card
}): JSX.Element {
  const s = useAppState();
  const r = p.round;
  const sh: ShellState = r.shell ?? { hold: r.status === false, ready: true, misses: 0, right: 0, double: p.mode === 'terminus' };
  const meta = GAMES.find((g) => g.id === p.game);
  const home = p.mode === 'free' || p.mode === 'sprint' ? 'play' : 'today';
  const quiet = calm();
  const sound = s.settings.sound;

  useEffect(() => {
    const hush = () => document.hidden && stopSpeaking();
    document.addEventListener('visibilitychange', hush);
    window.addEventListener('pagehide', stopSpeaking);
    // iOS Safari only shows :active press states with a touch listener around.
    document.addEventListener('touchstart', noop, { passive: true });
    return () => {
      document.removeEventListener('visibilitychange', hush);
      window.removeEventListener('pagehide', stopSpeaking);
      document.removeEventListener('touchstart', noop);
      stopSpeaking();
    };
  }, []);

  // Keyboard: Enter or Space continues after a miss.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat || !sh.hold || !sh.ready || r.summary || interactive(e.target)) return;
      e.preventDefault();
      r.next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const toggleSound = () => {
    const on = !getState().settings.sound;
    setState((st) => {
      st.settings.sound = on;
    });
    if (on) {
      primeAudio();
      sfx('tap');
    }
  };

  const ride = s.play.ride && s.play.ride.date === today() ? s.play.ride : null;
  const stop = p.mode === 'ride' && ride ? ride.plan.indexOf(p.game) + 1 : 0;
  const tag = p.mode === 'terminus' ? (sh.double ? '👑 XP ×2' : '👑 Terminus') : stop && ride ? `Stop ${stop}/${ride.plan.length}` : p.mode === 'sprint' ? `⚡ ${sh.right} right` : '';
  const sprint = r.timeLeft !== null;
  const shown = Math.min(r.answered + (r.status === null && r.item ? 1 : 0), r.total);
  const frac = sprint && sh.sprintSec ? r.timeLeft! / sh.sprintSec : r.total ? r.answered / r.total : 0;

  const sum = r.summary;
  const praise = PRAISE[r.combo];
  const live = sum
    ? `Round done: ${sum.stars} of 3 stars, ${sum.xp} XP.`
    : (p.live ??
      (r.status === true
        ? `Right!${r.lastGain ? ` +${r.lastGain} XP.` : ''}${praise ? ` ${praise}` : ''}`
        : r.status === false
          ? 'Not quite. The right answer is marked.'
          : sh.misses
            ? `Not that one.${'\u00a0'.repeat(sh.misses % 2)}`
            : ''));

  let body: ComponentChildren;
  if (sum) {
    const onNext = p.mode !== 'ride' ? undefined : sum.nextStop ? () => go(`play/${sum.nextStop}/ride`) : sum.goalJustMet ? () => go('play/smash/terminus') : undefined;
    const onAgain = p.mode === 'free' || p.mode === 'sprint' ? (p.onAgain ?? r.restart) : undefined;
    body = (
      <ResultCard summary={sum} onNext={onNext} onAgain={onAgain} onDone={() => go(home)}>
        {p.result}
      </ResultCard>
    );
  } else if (!r.total) {
    body = (
      <>
        <div class="game-stage">
          <div class="game-empty">
            <Shorshi mood="oops" size={64} />
            <p>Nothing to play here yet.</p>
            {p.prompt}
          </div>
        </div>
        <div class="game-controls">
          <button class="btn primary block game-cta" onClick={() => go(home)}>
            Back
          </button>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <div class="game-stage">{p.prompt}</div>
        <div class="game-controls">
          {p.controls}
          {sh.hold && (
            <button class="btn primary block game-cta game-continue" disabled={!sh.ready} onClick={() => r.next()}>
              Continue →
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <div class="game" data-calm={quiet ? '' : undefined} data-game={p.game} data-mode={p.mode} data-answered={r.answered} data-total={r.total}>
      <header class="game-top">
        <button
          class="icon-btn game-x"
          aria-label="Close"
          onClick={() => {
            stopSpeaking();
            go(home);
          }}
        >
          ✕
        </button>
        <div class="game-title">
          <div class="t">{meta ? `${meta.emoji} ${meta.title}` : 'Play'}</div>
          <div class="sub">
            <span class={`game-count ${sprint && r.timeLeft! <= 10 ? 'low' : ''}`}>{sprint ? `⏱ ${clock(r.timeLeft!)}` : `${shown}/${r.total}`}</span>
            {tag && <span> · {tag}</span>}
          </div>
        </div>
        {!sum && <ComboChip combo={r.combo} />}
        <span class="xp-pill" aria-label={`${sum ? sum.xp : r.xp} XP this round`}>
          {sum ? sum.xp : r.xp} XP
          {r.lastGain > 0 && !quiet && (
            <span class="xp-float" key={r.answered} aria-hidden="true">
              +{r.lastGain}
            </span>
          )}
        </span>
        <button class="icon-btn game-sound" aria-label="Sound effects" aria-pressed={sound} onClick={toggleSound}>
          {sound ? '🔈' : '🔇'}
        </button>
      </header>
      <div class={`game-bar ${sprint ? 'timer' : ''} ${sprint && r.timeLeft! <= 10 ? 'low' : ''}`} aria-hidden="true">
        <div style={{ transform: `scaleX(${Math.max(0, Math.min(1, frac))})` }} />
      </div>
      <ItemKey.Provider value={`${r.index}:${r.answered}`}>{body}</ItemKey.Provider>
      <div class="sr-only" role="status" aria-live="polite">
        {live}
      </div>
    </div>
  );
}

// ---------- Choices and tiles ----------

export interface Choice {
  k: string;
  label: ComponentChildren;
  ok: boolean;
  he?: boolean;
  sub?: string;
}

// The reveal shows once a pick is in and the grid is locked.
function markOf(reveal: boolean, ok: boolean, isPicked: boolean): '' | 'ok' | 'bad' {
  if (!reveal) return '';
  return ok ? 'ok' : isPicked ? 'bad' : '';
}

function Mark({ m }: { m: '' | 'ok' | 'bad' }) {
  if (!m) return null;
  return (
    <>
      <span class="opt-mark" aria-hidden="true">
        {m === 'ok' ? '✓' : '✕'}
      </span>
      <span class="sr-only">{m === 'ok' ? ' (right)' : ' (wrong)'}</span>
    </>
  );
}

/** Answer buttons (data-ok on the right ones). Keys 1–9 pick on a Mac. */
export function ChoiceGrid(p: { choices: Choice[]; cols?: 1 | 2 | 3 | 4; picked: string | null; locked: boolean; onPick: (c: Choice) => void }): JSX.Element {
  const { choices, picked, locked } = p;
  const item = useContext(ItemKey);
  const [fresh, guarded] = useGuard(`${item}|${choices.map((c) => c.k).join('\u0001')}|${picked === null}|${locked}`, 250);
  const reveal = picked !== null && locked;
  const pick = (c: Choice) => {
    if (!locked && !guarded()) p.onPick(c);
  };

  // Keyboard (Mac): 1–9 pick a choice.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || typing(e.target) || !/^[1-9]$/.test(e.key)) return;
      const c = choices[Number(e.key) - 1];
      if (!c) return;
      e.preventDefault();
      pick(c);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div class="opts" data-cols={p.cols ?? 2} role="group">
      {choices.map((c, i) => {
        const isPicked = c.k === picked;
        const m = markOf(reveal, c.ok, isPicked);
        const cls = ['opt', m, reveal && isPicked && 'picked', reveal && !m && 'dim', !reveal && isPicked && 'sel'].filter(Boolean).join(' ');
        return (
          <button key={c.k} type="button" class={cls} data-ok={c.ok ? 'true' : undefined} disabled={locked || fresh} onClick={() => pick(c)}>
            {isMac && i < 9 && (
              <kbd class="opt-key" aria-hidden="true">
                {i + 1}
              </kbd>
            )}
            <span class={c.he ? 'he' : undefined} lang={c.he ? 'he' : undefined} dir={c.he ? 'rtl' : undefined}>
              {c.label}
            </span>
            {c.sub && <span class="opt-sub">{c.sub}</span>}
            <Mark m={m} />
          </button>
        );
      })}
    </div>
  );
}

/** A row of chips to pick one from; the pick can change until the round locks it. */
export function TileRow(p: { label: string; tiles: { k: string; text: string; ok: boolean }[]; picked: string | null; locked: boolean; onPick: (k: string) => void }): JSX.Element {
  const { tiles, picked, locked } = p;
  const item = useContext(ItemKey);
  const [fresh, guarded] = useGuard(`${item}|${tiles.map((t) => t.k).join('\u0001')}|${picked === null}|${locked}`, 250);
  const reveal = picked !== null && locked;
  return (
    <div class="tile-row" role="group" aria-label={p.label}>
      <div class="tile-row-label" aria-hidden="true">
        {p.label}
      </div>
      <div class="tiles" dir="rtl">
        {tiles.map((t) => {
          const isPicked = t.k === picked;
          const m = markOf(reveal, t.ok, isPicked);
          const cls = ['tile', m, reveal && !m && 'dim', isPicked && 'sel'].filter(Boolean).join(' ');
          return (
            <button
              key={t.k}
              type="button"
              class={cls}
              lang="he"
              data-ok={t.ok ? 'true' : undefined}
              aria-pressed={isPicked}
              disabled={locked || fresh}
              onClick={() => !locked && !guarded() && p.onPick(t.k)}
            >
              {t.text || '—'}
              <Mark m={m} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Furniture ----------

export function TenseBand({ tense }: { tense: TenseKey }): JSX.Element {
  const l = TENSE_LABEL[tense];
  return (
    <div class={`tense-band ${tense}`}>
      <span class="he" lang="he" dir="rtl">
        {l.he}
      </span>
      <span class="tb-en">{l.en}</span>
      <span class="tb-cue" lang="he" dir="rtl" title={l.cueEn}>
        {l.cue}
      </span>
    </div>
  );
}

export function ComboChip({ combo }: { combo: number }): JSX.Element {
  const m = comboMultiplier(combo);
  const step = m === 3 ? 3 : m === 2 ? 2 : m === 1.5 ? 1 : 0;
  const praise = PRAISE[combo];
  // A new key restarts the pop when the multiplier steps up or a praise word lands.
  return (
    <span key={`${step}:${praise ?? ''}`} class={`combo-chip c${step}`} aria-label={step ? `Combo ${combo}, XP ×${m}` : undefined}>
      {step > 0 && <>×{m}</>}
      {step > 0 &&
        (praise ? (
          <span class="praise" lang="he" dir="rtl">
            {praise}
          </span>
        ) : (
          ' 🔥'
        ))}
    </span>
  );
}

export function Stars({ n, animate }: { n: 0 | 1 | 2 | 3; animate?: boolean }): JSX.Element {
  return (
    <div class={`stars ${animate ? 'anim' : ''}`} role="img" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <span class={`star ${i < n ? 'on' : ''}`} style={animate ? { animationDelay: `${120 + i * 150}ms` } : undefined} aria-hidden="true">
          ★
        </span>
      ))}
    </div>
  );
}

const BURST_COLORS = ['var(--accent)', 'var(--good)', 'var(--primary)', 'var(--gold)', 'var(--bad)', 'var(--warn)', 'var(--tense-present)'];

export function Burst(): JSX.Element | null {
  if (calm()) return null;
  return (
    <div class="burst" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <i style={`transform:rotate(${Math.round((i * 360) / 14 + (i % 2) * 11)}deg);--r:${72 + (i % 3) * 22}px;--c:${BURST_COLORS[i % BURST_COLORS.length]}`} />
      ))}
    </div>
  );
}

/** Shorshi, the sprout who rides along. */
export function Shorshi({ mood, size = 48 }: { mood: 'idle' | 'cheer' | 'oops'; size?: number }): JSX.Element {
  const cheer = mood === 'cheer';
  return (
    <svg class={`shorshi ${mood}${calm() ? '' : ' live'}`} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path class="sh-stem" d="M24 27v-8" />
      <path class="sh-leaf l" d="M24 19C23 11 16 6 8 8c0 8 7 12 16 11z" />
      <path class="sh-leaf r" d="M24 19c1-8 8-13 16-11 0 8-7 12-16 11z" />
      <ellipse class="sh-body" cx="24" cy="35" rx="14" ry="11" />
      <g class="sh-ink">
        {cheer ? (
          <path d="M17 34q2.5-3 5 0M26 34q2.5-3 5 0" />
        ) : (
          <>
            <circle cx="19.5" cy="33" r="2" />
            <circle cx="28.5" cy="33" r="2" />
          </>
        )}
        {cheer ? <path class="fill" d="M19 37.5h10q-1 5-5 5t-5-5z" /> : mood === 'oops' ? <path d="M20.5 40q1.75-1.6 3.5 0t3.5 0" /> : <path d="M20.5 38q3.5 3 7 0" />}
      </g>
      <circle class="sh-cheek" cx="15.5" cy="37.5" r="2.2" />
      <circle class="sh-cheek" cx="32.5" cy="37.5" r="2.2" />
      {mood === 'oops' && <path class="sh-drop" d="M37 21c1.6 2.6 2.2 3.6 2.2 4.6a2.2 2.2 0 0 1-4.4 0c0-1 .6-2 2.2-4.6z" />}
    </svg>
  );
}

/** Today's line: ●━━●━━○━━👑 */
export function LineMap(p: { plan: GameId[]; done: GameId[]; terminusOpen: boolean; terminusDone: boolean }): JSX.Element {
  const now = p.plan.findIndex((g) => !p.done.includes(g));
  const doneN = p.plan.filter((g) => p.done.includes(g)).length;
  const parts: JSX.Element[] = [];
  p.plan.forEach((g, i) => {
    const meta = GAMES.find((x) => x.id === g);
    const isDone = p.done.includes(g);
    if (i > 0) parts.push(<li key={`r${i}`} class={`rail ${p.done.includes(p.plan[i - 1]) ? 'on' : ''}`} aria-hidden="true" />);
    parts.push(
      <li key={`s${i}`} class={`stop ${isDone ? 'done' : i === now ? 'now' : ''}`}>
        <span class="dot" aria-hidden="true">
          {isDone ? '✓' : (meta?.emoji ?? '•')}
        </span>
        <span class="lbl">{meta?.title ?? g}</span>
        <span class="sr-only">{isDone ? ' (done)' : i === now ? ' (next)' : ''}</span>
      </li>,
    );
  });
  const tState = p.terminusDone ? 'done' : p.terminusOpen ? 'open' : '';
  parts.push(<li key="rt" class={`rail ${p.plan.length && now === -1 ? 'on' : ''}`} aria-hidden="true" />);
  parts.push(
    <li key="t" class={`stop terminus ${tState}`}>
      <span class="dot" aria-hidden="true">
        👑
      </span>
      <span class="lbl">Terminus</span>
      <span class="sr-only">{p.terminusDone ? ' (done)' : p.terminusOpen ? ' (open: XP ×2)' : ' (finish the line to open)'}</span>
    </li>,
  );
  return (
    <ol class="line-map" aria-label={`Today's line: ${doneN} of ${p.plan.length} stops done`}>
      {parts}
    </ol>
  );
}

// ---------- Result ----------

const MEDAL = ['', '🥉', '🥈', '🥇'];
const rankAt = (level: number) => [...RANKS].reverse().find((x) => level >= x.from) ?? RANKS[0];
const HEB = /[֐-׿]/;
const LAT = /[A-Za-z]/;

// A label that starts in Hebrew reads right to left, and so does its arrow.
function missLine(m: string): { dir: 'rtl' | 'ltr'; text: string } {
  const h = m.search(HEB);
  const l = m.search(LAT);
  const rtl = h >= 0 && (l < 0 || h < l);
  return rtl ? { dir: 'rtl', text: m.replace(/→/g, '←') } : { dir: 'ltr', text: m };
}

export function ResultCard(p: { summary: FinishSummary; onNext?: () => void; onAgain?: () => void; onDone: () => void; children?: ComponentChildren }): JSX.Element {
  const r = p.summary;
  const [fresh, guarded] = useGuard(r, 400); // the last tap must not land on Next
  const meta = GAMES.find((g) => g.id === r.game);
  const nextMeta = r.nextStop ? GAMES.find((g) => g.id === r.nextStop) : undefined;
  const sprint = r.mode === 'sprint';
  const lvUp = r.level.after > r.level.before;
  const newRank = lvUp && rankAt(r.level.after) !== rankAt(r.level.before) ? rankAt(r.level.after) : null;
  const pl = playerLevel(getState().play.xp);
  const nextRank = rankAt(pl.level + 1);
  const praise = r.stars === 3 ? 'מושלם!' : r.stars === 2 ? 'כל הכבוד!' : 'סיימת!';
  const tap = (f?: () => void) => () => {
    if (f && !guarded()) f();
  };
  const primary = p.onNext ? (
    <button class="btn primary block game-cta" disabled={fresh} onClick={tap(p.onNext)}>
      {nextMeta ? `Next stop ▶ ${nextMeta.emoji} ${nextMeta.title}` : '👑 Terminus · XP ×2'}
    </button>
  ) : p.onAgain ? (
    <button class="btn primary block game-cta" disabled={fresh} onClick={tap(p.onAgain)}>
      ↻ Again
    </button>
  ) : null;

  return (
    <div class="result">
      <section class="result-card" aria-label="Round result">
        <Shorshi mood={r.stars >= 2 ? 'cheer' : 'idle'} size={64} />
        <h2 class="he" lang="he" dir="rtl">
          {praise}
        </h2>
        <div class="result-sub">
          {meta ? `${meta.emoji} ${meta.title}` : ''}
          {' · '}
          {sprint ? `${r.firstTry} right first try · ${r.total} answered` : `${r.firstTry}/${r.total} right first try`}
        </div>
        <div class="result-stars">
          {(r.stars === 3 || r.goalJustMet || lvUp) && <Burst />}
          <Stars n={r.stars} animate />
        </div>
        <div class="result-xp">+{r.xp} XP</div>
        {r.bonuses.length > 0 && (
          <ul class="result-bonuses">
            {r.bonuses.map((b) => (
              <li>
                {b.label} +{b.xp}
              </li>
            ))}
          </ul>
        )}
        <div class="result-stats">
          <div>
            <b>{r.practised}</b>
            <span>Practised</span>
          </div>
          <div>
            <b>{r.strengthened}</b>
            <span>Strengthened</span>
          </div>
          <div>
            <b>{r.bestCombo}</b>
            <span>Best combo</span>
          </div>
        </div>
        {(r.newBest || r.goalJustMet) && (
          <div class="result-flags">
            {r.newBest && <span class="badge good">🏅 New best</span>}
            {r.goalJustMet && <span class="badge warn">🚌 Line finished · 👑 Terminus open</span>}
          </div>
        )}
        {lvUp && (
          <div class="result-levelup">
            ⬆️ Level {r.level.after}
            {newRank && (
              <>
                {' · new rank '}
                {newRank.emoji}{' '}
                <span class="he" lang="he" dir="rtl">
                  {newRank.he}
                </span>{' '}
                {newRank.en}
              </>
            )}
          </div>
        )}
        <div class="result-level">
          <div class="row-lbl">
            <span>
              Lv {pl.level} · {pl.rank.emoji} {pl.rank.en}
            </span>
            <span>
              {pl.span - pl.into} XP to {nextRank !== pl.rank ? `${nextRank.emoji} ` : ''}Lv {pl.level + 1}
            </span>
          </div>
          <div class="lvl-bar">
            <div style={{ transform: `scaleX(${pl.span ? Math.min(1, pl.into / pl.span) : 0})` }} />
          </div>
        </div>
        {(r.medals.length > 0 || r.badges.length > 0) && (
          <ul class="result-new">
            {r.medals.map((m) => (
              <li>
                {MEDAL[m.medal]}{' '}
                <span class="he" lang="he" dir="rtl">
                  {verbById.get(m.verbId)?.inf ?? m.verbId}
                </span>
              </li>
            ))}
            {r.badges.map((id) => {
              const b = BADGES.find((x) => x.id === id);
              return b ? (
                <li>
                  {b.emoji} {b.en}
                </li>
              ) : null;
            })}
          </ul>
        )}
        {r.misses.length > 0 && (
          <div class="result-misses">
            <h3>To look at again</h3>
            <ul>
              {r.misses.slice(0, 5).map((m) => {
                const x = missLine(m);
                return (
                  <li dir={x.dir} lang={x.dir === 'rtl' ? 'he' : undefined}>
                    {x.text}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {p.children}
      </section>
      <div class="game-controls result-actions">
        {primary}
        <button class={`btn block game-cta ${primary ? '' : 'primary'}`} disabled={fresh} onClick={tap(p.onDone)}>
          Done
        </button>
      </div>
    </div>
  );
}

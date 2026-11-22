// Verb of the Day (פועל היום): one verb a day, six typed forms, Wordle style.
// A first-try form is 🟩, a second-try form 🟨, two misses 🟥 (and the form is
// shown). The day's grid lives in play.daily, so it survives other games and
// reloads; when it is full the game shows the grid and a Share button instead
// of a new round. Typed answers review a due c: card (g 3 / 2 / 1).
import './six.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import { AnswerInput } from '../components/answer.tsx';
import type { Verb } from '../content/types.ts';
import { levelRank, verbById, verbs } from '../lib/content.ts';
import { checkHebrew } from '../lib/hebrew.ts';
import { go } from '../lib/router.ts';
import { drillable, verbCardOrder } from '../lib/session.ts';
import { weakTopics } from '../lib/skills.ts';
import { type AppState, getState, type PlayState, setState, type SixSlot, today, useAppState } from '../lib/store.ts';
import { BINYAN_CHOICES, type TenseKey } from '../lib/verbdrill.ts';
import { calm, daySeed, type Evidence, formOf, type GameProps, levelOk, personsFor, pronounsFor, sameForm, say, seeded, TENSE_LABEL } from './kit.ts';
import { GameShell, Shorshi, useRound } from './kit-ui.tsx';

export type SixDaily = NonNullable<PlayState['daily']>;
export type SixMark = SixDaily['marks'][number];

export interface SixItem {
  key: string;
  i: number; // the row on today's grid
  date: string;
  verbId: string;
  tense: TenseKey;
  person: string;
  pronoun: string;
  pronounEn: string;
  answer: string;
}

// The six rows; the imperative falls back to the future when a verb has none.
const PLAN: { tense: TenseKey; person: string; pronoun: string; alt?: { tense: TenseKey; person: string } }[] = [
  { tense: 'past', person: '1s', pronoun: 'אני' },
  { tense: 'present', person: 'fs', pronoun: 'היא' },
  { tense: 'future', person: '1p', pronoun: 'אנחנו' },
  { tense: 'imp', person: 'ms', pronoun: 'אתה', alt: { tense: 'future', person: '2ms' } },
  { tense: 'past', person: '3p', pronoun: 'הם' },
  { tense: 'future', person: '2fs', pronoun: 'את' },
];
const STAND_IN: TenseKey[] = ['future', 'past', 'present'];
const SQ: Record<SixMark, string> = { g: '🟩', y: '🟨', r: '🟥', '': '⬜' };
const ICON: Record<SixMark, string> = { g: '✓', y: '~', r: '✕', '': '' };
const MARK_EN: Record<SixMark, string> = { g: 'right first try', y: 'right on the second try', r: 'missed', '': 'not answered yet' };

const usable = (v: Verb, t: TenseKey, person: string) => drillable(v, t) && !!formOf(v, t, person);

function slot(t: TenseKey, person: string, pronoun: string): SixSlot {
  const prs = pronounsFor(t, person);
  return { tense: t, person, pronoun, pronounEn: prs.find(([p]) => p === pronoun)?.[1] ?? prs[0]?.[1] ?? '' };
}

/**
 * The six rows for one verb. A row whose tense isn't drillable moves to the
 * same pronoun in the future, then the past, then the present (the
 * imperative's stand-in is future אתה), preferring a spelling no earlier row has.
 */
export function sixSlotsFor(v: Verb): SixSlot[] {
  const out: SixSlot[] = [];
  const forms: string[] = [];
  for (const p of PLAN) {
    let pick: { tense: TenseKey; person: string } | undefined = usable(v, p.tense, p.person) ? p : undefined;
    if (!pick) {
      const cands = [...(p.alt ? [p.alt] : []), ...STAND_IN.filter((t) => t !== p.tense).flatMap((t) => personsFor(t, p.pronoun).map((person) => ({ tense: t, person })))].filter((c) =>
        usable(v, c.tense, c.person),
      );
      pick = cands.find((c) => !forms.some((f) => sameForm(f, formOf(v, c.tense, c.person)!))) ?? cands[0];
    }
    if (!pick) continue;
    out.push(slot(pick.tense, pick.person, p.pronoun));
    forms.push(formOf(v, pick.tense, pick.person)!);
  }
  return out;
}

/**
 * Today's verb and its six rows, the same all day for the same state: a verb
 * the learner has a c: card for (in the weakest binyan when there is one),
 * near their level, with a drillable past and future; else one of the first
 * 30 verbs in teaching order. The last day's verb is skipped.
 */
export function buildSixSlots(s: AppState, date: string = today()): { verbId: string; slots: SixSlot[] } {
  const carded = new Set(Object.keys(s.cards).flatMap((k) => (k.startsWith('c:') ? [k.split(':')[1]] : [])));
  const pastFuture = (v: Verb) => drillable(v, 'past') && drillable(v, 'future');
  let pool = verbs.filter((v) => carded.has(v.id) && levelOk(v.level, s) && pastFuture(v));
  const weakB = weakTopics('binyan:', s)[0]?.topic.slice(7);
  const weak = pool.filter((v) => v.binyan === weakB);
  if (weak.length) pool = weak;
  if (!pool.length) {
    const seen = new Set<string>();
    for (const { verb } of verbCardOrder()) {
      if (seen.size >= 30) break;
      if (!seen.has(verb.id) && pastFuture(verb)) {
        seen.add(verb.id);
        pool.push(verb);
      }
    }
  }
  const last = s.play.daily && s.play.daily.date < date ? s.play.daily.verbId : null;
  if (pool.length > 1) pool = pool.filter((v) => v.id !== last);
  if (!pool.length) return { verbId: '', slots: [] };
  const v = pool[Math.floor(seeded(daySeed(date))() * pool.length)];
  return { verbId: v.id, slots: sixSlotsFor(v) };
}

const sound = (d: SixDaily | null | undefined, date: string): d is SixDaily =>
  !!d && d.date === date && verbById.has(d.verbId) && d.slots.length === 6 && d.marks.length === 6 && d.tries.length === 6 && Array.isArray(d.rated);

/** Today's grid: the saved one, or a new one saved now (the first time the game opens today). */
export function openDaily(date: string = today()): SixDaily | null {
  const cur = getState().play.daily;
  if (sound(cur, date)) return cur;
  const { verbId, slots } = buildSixSlots(getState(), date);
  if (!verbId || slots.length !== 6) return null;
  setState((s) => {
    s.play.daily = { date, verbId, slots, marks: slots.map(() => ''), tries: slots.map(() => 0), rated: [] };
  });
  return getState().play.daily;
}

export const sixComplete = (d: SixDaily): boolean => d.marks.length === 6 && d.marks.every(Boolean);

/** The rows still open on today's grid. */
export function sixItems(d: SixDaily): SixItem[] {
  const v = verbById.get(d.verbId);
  if (!v) return [];
  return d.slots.flatMap((sl, i) => {
    const answer = formOf(v, sl.tense, sl.person);
    return !d.marks[i] && answer ? [{ key: `${d.date}:${d.verbId}:${i}`, i, date: d.date, verbId: d.verbId, ...sl, answer }] : [];
  });
}

/** Typed answers are graded strictly: a one-letter slip is a miss here. */
export function sixCheck(input: string, answer: string): ReturnType<typeof checkHebrew> {
  return checkHebrew(input, [answer], { strict: true });
}

export function sixShareText(d: SixDaily, inf: string): string {
  const right = d.marks.filter((m) => m === 'g' || m === 'y').length;
  return `Shoresh · פועל היום ${d.date}\n${inf} ${d.marks.map((m) => SQ[m]).join('')} ${right}/6`;
}

// One write per answer, guarded against a grid from another day.
function saveDaily(it: SixItem, patch: { tries?: number; mark?: SixMark; rated?: string[] }): void {
  setState((s) => {
    const d = s.play.daily;
    if (!d || d.date !== it.date || d.verbId !== it.verbId) return;
    if (patch.tries !== undefined) d.tries[it.i] = patch.tries;
    if (patch.mark) d.marks[it.i] = patch.mark;
    if (patch.rated) d.rated = [...new Set([...d.rated, ...patch.rated])];
  });
}

const binyanLabel = (v: Verb) => BINYAN_CHOICES.find(([b]) => b === v.binyan)?.[1] ?? v.binyan;

export function SixGame({ mode }: GameProps) {
  const s = useAppState();
  const [date] = useState(today);
  const open = levelRank(s.level) >= 1; // Daily Six asks for past, future and commands: A2 and up
  const daily = open ? openDaily(date) : null;
  const round = useRound<SixItem>({
    game: 'six',
    mode,
    tier: 'typed',
    build: () => {
      const d = levelRank(getState().level) >= 1 ? openDaily(date) : null;
      return d ? sixItems(d) : [];
    },
  });
  const [value, setValue] = useState('');
  const [note, setNote] = useState<{ key: string; text: string; tone: 'close' | 'bad' | 'hint' } | null>(null);
  const [last, setLast] = useState<{ key: string; given: string } | null>(null);
  const entry = useRef<HTMLDivElement>(null);
  const it = round.item;
  const verb = daily ? verbById.get(daily.verbId) : undefined;
  const status = round.status;
  const hold = !!round.shell?.hold;
  const ready = !!round.shell?.ready;

  // A typed card reviewed earlier today (in a round since lost) isn't reviewed twice.
  if (daily) for (const id of daily.rated) round.rated.add(id);

  // A saved round that no longer matches today's grid starts over from the grid.
  useEffect(() => {
    if (!daily || status !== null) return;
    const stale = round.items.some((x) => x.date !== daily.date || x.verbId !== daily.verbId) || (!!it && !!daily.marks[it.i]);
    if (stale) round.restart();
  });

  const input = () => entry.current?.querySelector('input');
  const keepFocus = () => input()?.focus({ preventScroll: true });
  const nudge = () => {
    const el = entry.current;
    if (!el || calm() || typeof el.animate !== 'function') return;
    el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], { duration: 180, easing: 'ease-in-out' });
  };

  const check = () => {
    if (!it || !daily || !verb || status !== null) return;
    const r = sixCheck(value, it.answer);
    if (r.verdict === 'empty') return nudge();
    if (r.verdict === 'latin') {
      setNote({ key: it.key, text: r.note ?? 'Switch to the Hebrew keyboard.', tone: 'hint' });
      return nudge();
    }
    const tries = (daily.tries[it.i] ?? 0) + 1;
    const ok = r.verdict === 'correct';
    if (!ok && tries < 2) {
      // First miss: a hint, nothing revealed, one more try.
      round.miss();
      saveDaily(it, { tries });
      const close = !!r.note;
      setNote({ key: it.key, text: close ? (/vowel/.test(r.note!) ? 'Very close: check the vowel letters (י, ו).' : 'Very close: check the ending.') : 'Not quite. One more try.', tone: close ? 'close' : 'bad' });
      return nudge();
    }
    const mark: SixMark = ok ? (tries === 1 ? 'g' : 'y') : 'r';
    const evidence: Evidence[] = [
      {
        tier: 'typed',
        ok,
        grade: mark === 'g' ? 3 : mark === 'y' ? 2 : 1,
        skill: 'verbs',
        topics: [`binyan:${verb.binyan}`, `tense:${it.tense}`],
        cardId: it.tense === 'imp' ? null : `c:${it.verbId}:${it.tense}`,
        mistake: { kind: 'verb', ref: `${it.verbId}:${it.tense}:${it.person}`, prompt: `${it.pronoun} (${it.pronounEn}) · ${verb.inf} · ${TENSE_LABEL[it.tense].he}`, answer: it.answer, given: value.trim() },
      },
    ];
    round.answer({ ok, evidence, xpScale: mark === 'y' ? 0.5 : 1, miss: `${it.pronoun} · ${TENSE_LABEL[it.tense].he} → ${it.answer}`, verbId: it.verbId }, ok ? 'auto' : 'hold');
    saveDaily(it, { tries, mark, rated: [...round.rated] });
    setLast({ key: it.key, given: value.trim() });
    setNote(ok && r.note ? { key: it.key, text: r.note, tone: 'hint' } : null);
    setValue('');
    say(`${it.pronoun} ${it.answer}`);
  };

  // Enter and the button both check, or move on after a miss; the keyboard stays up.
  const act = () => {
    if (hold) {
      if (ready) round.next();
    } else check();
    keepFocus();
  };

  if (daily && verb && round.total === 0 && sixComplete(daily)) return <SixDone daily={daily} verb={verb} mode={mode} />;

  let prompt = null;
  if (daily && verb && it) {
    const shownNote = note && note.key === it.key ? note : null;
    const tries = daily.tries[it.i] ?? 0;
    prompt = (
      <div class="six-stage">
        <SixBoard
          daily={daily}
          verb={verb}
          active={it.i}
          typed={status === null ? value : ''}
          given={status === false && last?.key === it.key ? last.given : undefined}
        />
        <div class={`six-note ${shownNote?.tone ?? ''}`} aria-hidden="true">
          {status === false
            ? 'Two misses: the form is shown on the grid.'
            : shownNote
              ? shownNote.text
              : status === null && tries === 1
                ? 'Second try: last chance for this row'
                : status === null
                  ? 'Type the form for the glowing row'
                  : ''}
        </div>
      </div>
    );
  } else if (!open) prompt = <p class="muted">Verb of the Day opens at A2: it asks for the past, the future and commands.</p>;
  else if (!round.total) prompt = <p class="muted">No verb for today yet.</p>;

  const tone = note && it && note.key === it.key && status === null ? (note.tone === 'close' ? 'close' : note.tone === 'bad' ? 'bad' : '') : status === true ? 'ok' : status === false ? 'bad' : '';
  const controls = it && (
    <div class="six-entry" ref={entry}>
      <AnswerInput
        value={value}
        onInput={(v) => {
          setValue(v);
          if (note?.tone === 'hint') setNote(null);
        }}
        onEnter={act}
        status={tone}
        placeholder={`${it.pronoun} …`}
        autoFocus
      />
      <button
        type="button"
        class="btn primary six-go"
        disabled={hold ? !ready : status !== null || !value.trim()}
        // Keep the focus (and the iOS keyboard) in the input.
        onMouseDown={(e) => e.preventDefault()}
        onClick={act}
      >
        {hold ? 'Next →' : 'Check'}
      </button>
    </div>
  );

  const result = daily && verb && sixComplete(daily) && <SixShare daily={daily} verb={verb} />;
  const live =
    it && status === null
      ? note && note.key === it.key
        ? note.text
        : `${it.pronoun}, ${TENSE_LABEL[it.tense].en}: type the form of ${verb?.inf ?? ''}.`
      : it && status === false
        ? `Not quite. It's ${it.answer}.`
        : undefined;

  return <GameShell game="six" mode={mode} round={round} prompt={prompt} controls={controls} result={result || undefined} live={live} />;
}

function SixBoard({ daily, verb, active, typed, given, done }: { daily: SixDaily; verb: Verb; active: number; typed: string; given?: string; done?: boolean }) {
  return (
    <div class={`six-board ${done ? 'done' : ''}`} data-verb={verb.id}>
      <div class="six-head">
        <div class="six-inf he" lang="he" dir="rtl">
          {verb.inf}
        </div>
        <div class="six-meta">
          <span>{verb.en}</span>
          <span class="six-binyan">{binyanLabel(verb)}</span>
        </div>
      </div>
      <ol class="six-grid" dir="rtl">
        {daily.slots.map((sl, i) => {
          const m = daily.marks[i];
          const now = i === active;
          const form = formOf(verb, sl.tense, sl.person) ?? '';
          return (
            <li
              key={i}
              class={`six-row ${m} ${now ? 'now' : ''}`}
              style={`--i:${i}`}
              data-tense={now ? sl.tense : undefined}
              data-person={now ? sl.person : undefined}
              aria-current={now ? 'step' : undefined}
            >
              <span class="six-who">
                <span class="he" lang="he">
                  {sl.pronoun}
                </span>
                <span class="six-who-en" dir="ltr">
                  {sl.pronounEn}
                </span>
              </span>
              <span class={`six-tense ${sl.tense}`} lang="he" title={TENSE_LABEL[sl.tense].en}>
                {TENSE_LABEL[sl.tense].he}
              </span>
              <span class="six-cell he" lang="he">
                {m ? (
                  <>
                    {m === 'r' && given && <s class="six-given">{given}</s>}
                    <span class="six-form">{form}</span>
                  </>
                ) : now ? (
                  <>
                    <span class="six-typed">{typed}</span>
                    <i class="six-caret" aria-hidden="true" />
                  </>
                ) : null}
              </span>
              <span class={`sq ${m}`} role="img" aria-label={MARK_EN[m]}>
                {ICON[m]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SixShare({ daily, verb }: { daily: SixDaily; verb: Verb }) {
  const [msg, setMsg] = useState<{ text: string; fallback?: boolean } | null>(null);
  const text = sixShareText(daily, verb.inf);
  const greens = daily.marks.filter((m) => m === 'g').length;
  const right = daily.marks.filter((m) => m === 'g' || m === 'y').length;
  const share = async () => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ text });
        return;
      }
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return; // the share sheet was closed
    }
    try {
      await navigator.clipboard.writeText(text);
      setMsg({ text: 'Copied ✓ Paste it in a chat.' });
    } catch {
      setMsg({ text: 'Copying is blocked here. Press and hold the text to copy it.', fallback: true });
    }
  };
  return (
    <div class="six-share" data-share={text}>
      <div class="six-share-top">
        <Shorshi mood={greens >= 5 ? 'cheer' : right >= 3 ? 'idle' : 'oops'} size={40} />
        <div>
          <div class="six-share-title">
            <span class="he" lang="he" dir="rtl">
              {verb.inf}
            </span>{' '}
            · {right}/6
          </div>
          <div class="six-share-sub">A new verb tomorrow</div>
        </div>
      </div>
      <div class="six-squares" role="img" aria-label={`${greens} first try, ${right - greens} second try, ${6 - right} missed`}>
        {daily.marks.map((m, i) => (
          <span key={i} class={`sq ${m}`} style={`--i:${i}`} aria-hidden="true">
            {ICON[m]}
          </span>
        ))}
      </div>
      <button type="button" class="btn primary block game-cta six-share-btn" onClick={share}>
        📤 Share today's grid
      </button>
      {msg && (
        <div class="six-share-msg" role="status">
          {msg.text}
        </div>
      )}
      {msg?.fallback && <pre class="six-share-text">{text}</pre>}
      <button type="button" class="btn ghost block" onClick={() => go(`verb/${verb.id}`)}>
        All forms of{' '}
        <span class="he" lang="he" dir="rtl">
          {verb.inf}
        </span>{' '}
        →
      </button>
    </div>
  );
}

// Today's grid is full: show it and offer to share, no new round.
function SixDone({ daily, verb, mode }: { daily: SixDaily; verb: Verb; mode: GameProps['mode'] }) {
  const home = mode === 'free' || mode === 'sprint' ? 'play' : 'today';
  return (
    <div class="game six-done" data-calm={calm() ? '' : undefined} data-game="six" data-mode={mode} data-answered={6} data-total={6}>
      <header class="game-top">
        <button class="icon-btn game-x" aria-label="Close" onClick={() => go(home)}>
          ✕
        </button>
        <div class="game-title">
          <div class="t">🟩 Verb of the Day</div>
          <div class="sub">Done for today</div>
        </div>
      </header>
      <div class="game-stage">
        <SixBoard daily={daily} verb={verb} active={-1} typed="" done />
        <SixShare daily={daily} verb={verb} />
      </div>
      <div class="game-controls">
        <button type="button" class="btn block game-cta" onClick={() => go(home)}>
          Done
        </button>
      </div>
    </div>
  );
}

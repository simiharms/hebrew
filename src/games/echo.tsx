// Echo (הד): hear a real sentence, then pick the verb form that was said. The
// sentence shows with the verb blanked; the English stays hidden until the
// answer. Without a Hebrew voice the game still plays as reading, with the
// English as the clue, and then it records no listening.
import './echo.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Verb } from '../content/types.ts';
import { verbById, verbs } from '../lib/content.ts';
import { drillable } from '../lib/session.ts';
import { type AppState, getState } from '../lib/store.ts';
import { hebrewVoices, speak, stopSpeaking, ttsSupported, unlockSpeech } from '../lib/tts.ts';
import { analyses, blankForm, tableOf, type TenseKey } from '../lib/verbdrill.ts';
import { allowedTenses, confuserForms, type Evidence, type GameProps, levelOk, sameForm, shuffle, TENSE_LABEL } from './kit.ts';
import { type Choice, ChoiceGrid, GameShell, Shorshi, TenseBand, useRound } from './kit-ui.tsx';

export interface EchoItem {
  key: string;
  verbId: string;
  tense: TenseKey | null; // null: the sentence uses the infinitive
  he: string;
  en: string;
  gap: string; // he with the form as ___
  form: string;
  options: string[]; // the form and two other forms of the verb, none sameForm to another
}

const ALL_TENSES: TenseKey[] = ['present', 'past', 'future', 'imp'];
const SLOW = 0.7;

/** Two forms of the verb's drillable tables to offer next to an infinitive. */
function otherForms(v: Verb, form: string, n: number, rnd: () => number): string[] {
  const out: string[] = [];
  for (const f of shuffle(ALL_TENSES.filter((t) => drillable(v, t)).flatMap((t) => Object.values(tableOf(v, t) ?? {}).map((x) => x[0])), rnd)) {
    if (out.length >= n) break;
    if (![form, ...out].some((x) => sameForm(x, f))) out.push(f);
  }
  return out;
}

/** The item for example `i` of a verb, or null if the form can't be blanked out. */
export function echoItemFor(v: Verb, i: number, rnd: () => number = Math.random): EchoItem | null {
  const e = v.exs?.[i];
  if (!e) return null;
  const gap = blankForm(e.he, e.form);
  if (!gap) return null;
  const a = analyses(v, e.form)[0];
  const wrong = a ? confuserForms(v, a.tense, a.person, 2, rnd, [e.form]) : otherForms(v, e.form, 2, rnd);
  if (wrong.length < 2) return null;
  return { key: `${v.id}#${i}`, verbId: v.id, tense: a?.tense ?? null, he: e.he, en: e.en, gap, form: e.form, options: shuffle([e.form, ...wrong], rnd) };
}

/**
 * What a pick records: tap evidence on the verb (a miss only pulls its c: card
 * forward; a command or an infinitive has no card) and, when the sentence was
 * really heard in Hebrew, a light listening record.
 */
export function echoEvidence(it: EchoItem, ok: boolean, listening: boolean, binyan?: string): Evidence[] {
  return [
    ...(listening ? [{ tier: 'tap' as const, ok, skill: 'listening' as const, weight: 0.3 }] : []),
    {
      tier: 'tap',
      ok,
      skill: 'verbs',
      topics: [...(binyan ? [`binyan:${binyan}`] : []), ...(it.tense ? [`tense:${it.tense}`] : [])],
      cardId: it.tense && it.tense !== 'imp' ? `c:${it.verbId}:${it.tense}` : null,
    },
  ];
}

/**
 * Eight sentences near the learner's level whose verb form is in a tense they
 * play (the form's first reading). About five come from verbs they have
 * started; one sentence per verb while there are enough.
 */
export function buildEchoItems(s: AppState, n = 8, rnd: () => number = Math.random): EchoItem[] {
  const allowed = allowedTenses(s);
  const started = new Set(Object.keys(s.cards).flatMap((k) => (k.startsWith('c:') ? [k.split(':')[1]] : [])));
  const mine: { v: Verb; i: number }[] = [];
  const rest: { v: Verb; i: number }[] = [];
  for (const v of verbs) {
    if (!levelOk(v.level, s)) continue;
    (v.exs ?? []).forEach((e, i) => {
      const a = analyses(v, e.form)[0];
      if (a && allowed.includes(a.tense)) (started.has(v.id) ? mine : rest).push({ v, i });
    });
  }
  const out: EchoItem[] = [];
  const used = new Map<string, number>();
  const take = (list: { v: Verb; i: number }[], upTo: number, perVerb: number) => {
    for (const c of list) {
      if (out.length >= upTo) return;
      if ((used.get(c.v.id) ?? 0) >= perVerb || out.some((x) => x.key === `${c.v.id}#${c.i}`)) continue;
      const it = echoItemFor(c.v, c.i, rnd);
      if (!it) continue;
      out.push(it);
      used.set(c.v.id, (used.get(c.v.id) ?? 0) + 1);
    }
  };
  const a = shuffle(mine, rnd);
  const b = shuffle(rest, rnd);
  take(a, Math.round(n * 0.6), 1);
  take(b, n, 1);
  take(a, n, 1);
  take([...a, ...b], n, 2);
  return shuffle(out, rnd);
}

// Re-renders when the device's voice list arrives (Chrome fills it in late).
function useHebrewVoice(): boolean {
  const [has, setHas] = useState(() => hebrewVoices().length > 0);
  useEffect(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    const check = () => setHas(hebrewVoices().length > 0);
    synth?.addEventListener?.('voiceschanged', check);
    const t = setTimeout(check, 700);
    return () => {
      synth?.removeEventListener?.('voiceschanged', check);
      clearTimeout(t);
    };
  }, []);
  return has;
}

export function EchoGame({ mode }: GameProps) {
  const round = useRound<EchoItem>({ game: 'echo', mode, tier: 'tap', build: () => buildEchoItems(getState()) });
  const supported = ttsSupported();
  const voice = useHebrewVoice();
  const [started, setStarted] = useState(false);
  const [reading, setReading] = useState(false); // chose to play without sound
  const [pick, setPick] = useState<{ key: string; k: string } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const token = useRef(0);
  const alive = useRef(true);
  const it = started ? round.item : null;
  const status = round.status;
  const audible = supported && !reading;
  const listening = audible && voice; // only then does a right answer count as listening
  const picked = it && pick?.key === it.key ? pick.k : null;

  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const play = (rate?: number) => {
    if (!it || !audible) return;
    const my = ++token.current;
    setSpeaking(true);
    speak(it.he, rate ? { rate } : {}).finally(() => {
      if (alive.current && my === token.current) setSpeaking(false);
    });
  };

  // Each sentence plays by itself a moment after it appears.
  useEffect(() => {
    if (!it || status !== null || !audible) return;
    const t = setTimeout(() => {
      if (typeof document === 'undefined' || !document.hidden) play();
    }, 250);
    return () => clearTimeout(t);
  }, [it?.key, started, audible]);

  const start = (silent = false) => {
    if (silent) setReading(true);
    else unlockSpeech(); // iOS lets speech start only from a tap
    setStarted(true);
  };

  const onPick = (c: Choice) => {
    if (!it || status !== null) return;
    setPick({ key: it.key, k: c.k });
    token.current++;
    stopSpeaking();
    setSpeaking(false);
    const v = verbById.get(it.verbId);
    const evidence = echoEvidence(it, c.ok, listening, v?.binyan);
    const label = it.tense ? TENSE_LABEL[it.tense].he : 'שם הפועל';
    round.answer({ ok: c.ok, evidence, miss: `${v?.inf ?? ''} · ${label} → ${it.form}`, verbId: it.verbId }, 'hold');
  };

  let prompt;
  let controls;
  if (!supported && !reading) {
    prompt = (
      <div class="echo-intro">
        <div class="echo-speaker off" aria-hidden="true">
          🔇
        </div>
        <h2>No speech output here</h2>
        <p class="muted">Echo reads sentences aloud, and this browser has no text-to-speech. You can still play it by reading, with the English as a clue.</p>
      </div>
    );
    controls = (
      <button type="button" class="btn primary block game-cta" onClick={() => start(true)}>
        📖 Play by reading
      </button>
    );
  } else if (!started) {
    const begun = round.answered > 0;
    prompt = (
      <div class="echo-intro">
        <div class="echo-speaker" aria-hidden="true">
          🎧
        </div>
        <h2>Listen, then pick the verb</h2>
        <p class="muted">Each sentence plays with its verb missing from the text. Tap the form you heard. 🔊 plays it again, 🐢 slowly.</p>
        {!voice && <NoVoice />}
      </div>
    );
    controls = (
      <>
        <button type="button" class="btn primary block game-cta echo-start" onClick={() => start()}>
          {begun ? `▶ Resume · ${round.answered + 1}/${round.total}` : '▶ Start'}
        </button>
        {!voice && (
          <button type="button" class="btn block echo-read" onClick={() => start(true)}>
            📖 Play by reading instead
          </button>
        )}
      </>
    );
  } else if (it) {
    const [before, after] = it.gap.split('___');
    const filled = status !== null;
    prompt = (
      <div class="echo-stage">
        <div class={`echo-speaker ${speaking ? 'on' : ''} ${status === true ? 'ok' : status === false ? 'bad' : ''}`} aria-hidden="true">
          {audible ? <span class="echo-ico">{speaking ? '🔊' : '🎧'}</span> : <Shorshi mood={status === true ? 'cheer' : status === false ? 'oops' : 'idle'} size={52} />}
          {speaking && (
            <>
              <i class="ring" />
              <i class="ring r2" />
            </>
          )}
        </div>
        <p class="echo-sentence he" lang="he" dir="rtl" key={it.key}>
          {before}
          <span class={`echo-gap ${filled ? 'filled' : ''} ${status === true ? 'ok' : ''}`}>{filled ? it.form : ' '}</span>
          {after}
        </p>
        {filled || !listening ? (
          <p class={`echo-en ${filled ? '' : 'clue'}`}>
            {!filled && <span class="echo-clue">Clue</span>}
            {it.en}
          </p>
        ) : (
          <p class="echo-en hidden" aria-hidden="true">
            English after you answer
          </p>
        )}
        {/* The tense shows only afterwards: before, it would give the other-tense form away without listening. */}
        <div class="echo-after">{filled && it.tense ? <TenseBand tense={it.tense} /> : filled ? <span class="echo-inf">infinitive · שם הפועל</span> : null}</div>
        {!voice && audible && <NoVoice short />}
      </div>
    );
    const choices: Choice[] = it.options.map((f) => ({ k: f, label: f, ok: sameForm(f, it.form), he: true }));
    const long = it.options.some((f) => f.length > 7);
    controls = (
      <div class="echo-controls">
        {audible && (
          <div class="echo-replay">
            <button type="button" class="btn echo-again" onClick={() => play()} aria-label="Play the sentence again">
              🔊 Again
            </button>
            <button type="button" class="btn echo-slow" onClick={() => play(SLOW)} aria-label="Play the sentence slowly">
              🐢 Slow
            </button>
          </div>
        )}
        <ChoiceGrid choices={choices} cols={long ? 1 : 3} picked={picked} locked={status !== null} onPick={onPick} />
      </div>
    );
  } else if (!round.total) prompt = <p class="muted">No sentences at your level yet.</p>;

  return <GameShell game="echo" mode={mode} round={round} prompt={prompt} controls={controls} />;
}

function NoVoice({ short }: { short?: boolean }) {
  return short ? (
    <p class="echo-warn small">🔇 No Hebrew voice: reading mode, the English is the clue.</p>
  ) : (
    <p class="echo-warn">
      <b>No Hebrew voice on this device.</b> You'll see the English as a clue instead, and the round won't count as listening. On iPhone: Settings › Accessibility › Spoken Content › Voices ›
      Hebrew.
    </p>
  );
}

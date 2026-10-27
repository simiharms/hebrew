import { useEffect, useMemo, useState } from 'preact/hooks';
import { Dictation } from '../components/answer.tsx';
import { HeText } from '../components/hebrew.tsx';
import { Progress, Seg, SpeakBtn, TopBar } from '../components/ui.tsx';
import type { Level } from '../content/types.ts';
import { LEVELS } from '../content/types.ts';
import { distractors, pickSentences, type Sentence } from '../lib/listening.ts';
import { record } from '../lib/skills.ts';
import { getState } from '../lib/store.ts';
import { speak } from '../lib/tts.ts';
import { SessionDone } from './session-words.tsx';

const ROUND = 10;

/** Quick listening practice at any level: type what you hear, or pick what it means. */
export function ListenTrainer() {
  const [level, setLevel] = useState<Level>(getState().level);
  const [mode, setMode] = useState<'type' | 'choose'>(getState().level === 'A1' ? 'choose' : 'type');
  const items = useMemo(() => pickSentences(level, ROUND), [level]);
  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [right, setRight] = useState(0);
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <>
        <TopBar title="Listening practice" backTo="listen" />
        <main class="page">
          <div class="card">
            <p class="small">
              {ROUND} short sentences at your level, read by your device's Hebrew voice. Play them as often as you like.
            </p>
            <div class="small muted">Level</div>
            <div class="chip-row">
              {LEVELS.map((l) => (
                <button class={`chip ${level === l ? 'on' : ''}`} onClick={() => setLevel(l)}>
                  {l}
                </button>
              ))}
            </div>
            <div class="small muted mt">Exercise</div>
            <Seg
              value={mode}
              options={[
                { v: 'type', label: '⌨️ Type what you hear' },
                { v: 'choose', label: '👂 What does it mean?' },
              ]}
              onChange={setMode}
            />
            <div class="btn-row">
              <button class="btn primary block" onClick={() => setStarted(true)} disabled={!items.length}>
                Start
              </button>
            </div>
            {!items.length && <div class="small muted">No sentences at this level yet.</div>}
          </div>
        </main>
      </>
    );
  }

  if (idx >= items.length) return <SessionDone task="listen-train" right={right} total={items.length} />;

  const s = items[idx];
  const next = () => {
    setIdx(idx + 1);
    setAnswered(false);
  };

  return (
    <>
      <TopBar title={mode === 'type' ? 'Type what you hear' : 'What does it mean?'} backTo="listen" right={<span class="small muted">{idx + 1}/{items.length}</span>} />
      <main class="page">
        <Progress value={idx / items.length} />
        {mode === 'type' ? (
          <>
            <Dictation
              key={idx}
              text={s.he}
              gender={s.gender}
              onDone={(score) => {
                if (answered) return; // "Try again" doesn't count twice
                setAnswered(true);
                if (score >= 0.99) setRight((n) => n + 1);
              }}
            />
            {answered && (
              <div class="card tight">
                <HeText text={s.he} />
                <div class="en">{s.en}</div>
              </div>
            )}
          </>
        ) : (
          <ChooseMeaning key={idx} s={s} onDone={(ok) => (setAnswered(true), ok && setRight((n) => n + 1))} />
        )}
        {answered && (
          <button class="btn primary block" onClick={next}>
            Next →
          </button>
        )}
      </main>
    </>
  );
}

function ChooseMeaning({ s, onDone }: { s: Sentence; onDone: (ok: boolean) => void }) {
  const options = useMemo(() => [s.en, ...distractors(s)].sort(() => Math.random() - 0.5), [s]);
  const [pick, setPick] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => speak(s.he, { gender: s.gender }), 250);
    return () => clearTimeout(t);
  }, [s]);
  return (
    <div class="card">
      <div class="prompt-box">
        <SpeakBtn text={s.he} gender={s.gender} label="Play again" />
      </div>
      <div class="choice-grid one">
        {options.map((o) => (
          <button
            class={`btn choice ${pick === o ? (o === s.en ? 'right' : 'wrong') : pick && o === s.en ? 'right' : ''}`}
            disabled={!!pick}
            onClick={() => {
              setPick(o);
              record('listening', o === s.en ? 1 : 0, [], 0.5);
              onDone(o === s.en);
            }}
          >
            {o}
          </button>
        ))}
      </div>
      {pick && (
        <div class="mt">
          <HeText text={s.he} />
        </div>
      )}
    </div>
  );
}

// Listening practice with sentences from the lesson texts up to the current lesson.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Dictation } from '../components/answer.tsx';
import { NoText } from '../components/text.tsx';
import { Seg, SpeakBtn, TopBar } from '../components/ui.tsx';
import { lessons } from '../lib/content.ts';
import { useAppState } from '../lib/store.ts';
import { speak } from '../lib/tts.ts';

interface Sentence {
  no: string;
  de: string;
  gender?: 'm' | 'f';
  lesson: number;
}

const shuffle = <T,>(xs: T[]): T[] => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

function sentences(upTo: number): Sentence[] {
  const out: Sentence[] = [];
  for (const L of lessons) {
    if (L.n > upTo) continue;
    for (const t of [L.text, ...L.extra]) {
      for (const l of t.lines) {
        // Prose lines are paragraphs: take their sentences one by one.
        const parts = t.kind === 'dialog' ? [[l.no, l.de]] : splitPair(l.no, l.de);
        for (const [no, de] of parts) {
          // whole sentences only: no fragments that start in lower case
          if (no.length >= 12 && no.length <= 110 && /^["«„“]?[A-ZÆØÅ]/.test(no)) out.push({ no, de, gender: l.s ? t.speakers?.[l.s]?.gender : undefined, lesson: L.n });
        }
      }
    }
  }
  return out;
}

/**
 * Splits a paragraph into sentences: at . ! ? (and a closing quote) followed by
 * a capital letter or an opening quote – not after numbers like »17. mai«.
 */
function splitSentences(s: string): string[] {
  const out: string[] = [];
  let start = 0;
  const re = /[.!?]+["»“”]?\s+(?=["«„“]?[A-ZÆØÅÄÖÜ])/g;
  for (const m of s.matchAll(re)) {
    const end = (m.index ?? 0) + m[0].length;
    if (/\d\.$/.test(s.slice(start, (m.index ?? 0) + 1))) continue;
    out.push(s.slice(start, end).trim());
    start = end;
  }
  out.push(s.slice(start).trim());
  return out.filter(Boolean);
}

/** Splits a paragraph and its translation into sentences when both have the same number of them. */
function splitPair(no: string, de: string): string[][] {
  const a = splitSentences(no);
  const b = splitSentences(de);
  return a.length === b.length ? a.map((x, i) => [x, b[i]]) : [[no, de]];
}

export function ListenTrainer() {
  const s = useAppState();
  const [mode, setMode] = useState<'dict' | 'mc'>('mc');
  const [round, setRound] = useState(0);
  const pool = useMemo(() => sentences(s.lesson), [s.lesson]);
  const items = useMemo(() => shuffle(pool).slice(0, 8), [pool, round, mode]);
  const [i, setI] = useState(0);
  const [right, setRight] = useState(0);
  const [scored, setScored] = useState<Set<number>>(new Set());
  const item = items[i];
  const score = (ok: boolean) => {
    if (scored.has(i)) return; // only the first try counts
    setScored(new Set(scored).add(i));
    if (ok) setRight((x) => x + 1);
  };

  return (
    <>
      <TopBar title="Hörtraining" backTo="ueben" right={<span class="small muted">{Math.min(i + 1, items.length)}/{items.length}</span>} />
      <main class="page">
        <Seg
          value={mode}
          options={[
            { v: 'mc', label: 'Verstehen' },
            { v: 'dict', label: 'Diktat' },
          ]}
          onChange={(v) => (setMode(v), setI(0), setRight(0), setScored(new Set()))}
        />
        <p class="small muted">Sätze aus den Texten der Lektionen 1–{s.lesson}.</p>
        {!item ? (
          <div class="card center">
            {items.length ? (
              <>
                <h2>
                  {right} von {items.length}
                </h2>
                <button class="btn primary" onClick={() => (setRound(round + 1), setI(0), setRight(0), setScored(new Set()))}>
                  Neue Runde
                </button>
              </>
            ) : (
              <p>Noch keine Texte vorhanden.</p>
            )}
          </div>
        ) : mode === 'dict' ? (
          <>
            <Dictation key={`${round}-${i}`} text={item.no} gender={item.gender} onDone={(v) => score(v >= 0.9)} />
            <button class="btn primary block" onClick={() => setI(i + 1)}>
              Nächster Satz
            </button>
          </>
        ) : (
          <Choice key={`${round}-${i}`} item={item} pool={pool} onDone={(ok) => (score(ok), setI(i + 1))} />
        )}
      </main>
    </>
  );
}

function Choice({ item, pool, onDone }: { item: Sentence; pool: Sentence[]; onDone: (ok: boolean) => void }) {
  const options = useMemo(() => shuffle([item.de, ...shuffle(pool.filter((p) => p.de !== item.de)).slice(0, 2).map((p) => p.de)]), [item]);
  const [pick, setPick] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);
  useEffect(() => {
    speak(item.no, { gender: item.gender });
  }, [item]);
  return (
    <div class="card">
      <div class="row">
        <SpeakBtn text={item.no} gender={item.gender} label="Nochmal hören" />
        <div class="spacer" />
        <button class="btn small ghost" onClick={() => speak(item.no, { gender: item.gender, rate: 0.65 })}>
          🐢 langsam
        </button>
      </div>
      <div class="small muted mt">Was bedeutet der Satz?</div>
      <div class="choice-grid one mt">
        {options.map((o) => (
          <button class={`btn choice ${pick === null ? '' : o === item.de ? 'right' : pick === o ? 'wrong' : ''}`} disabled={pick !== null} onClick={() => setPick(o)}>
            {o}
          </button>
        ))}
      </div>
      {pick !== null && (
        <>
          <div class="mt">
            {showText ? <NoText text={item.no} /> : <button class="btn small ghost" onClick={() => setShowText(true)}>Text zeigen</button>}
          </div>
          <button class="btn primary block mt" onClick={() => onDone(pick === item.de)}>
            Weiter
          </button>
        </>
      )}
    </div>
  );
}

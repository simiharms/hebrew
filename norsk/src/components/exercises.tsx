// Exercises: gap-fill drills, true/false, find the word, translate.
import { useState } from 'preact/hooks';
import type { Drill, FindWord, Translate, TrueFalse } from '../content/types.ts';
import { type CheckResult, checkAnswer, containsPhrase, normalize } from '../lib/norsk.ts';
import { addMistake, clearMistake, markDone } from '../lib/store.ts';
import { speak } from '../lib/tts.ts';
import { AnswerInput, DIFF_LEGEND, DiffView, Feedback, wordDiff } from './answer.tsx';
import { NoText } from './text.tsx';
import { DeToggle, SpeakBtn } from './ui.tsx';

/** The prompt with its gap; the cue in parentheses at the end is shown apart. */
export function splitCue(prompt: string): { sentence: string; cue?: string } {
  const m = prompt.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  return m && m[1].includes('___') ? { sentence: m[1], cue: m[2] } : { sentence: prompt };
}

export function fillGap(prompt: string, answer: string): string {
  return splitCue(prompt).sentence.replace('___', answer);
}

export function GapSentence({ prompt, filled }: { prompt: string; filled?: string }) {
  const { sentence, cue } = splitCue(prompt);
  const parts = sentence.split('___');
  return (
    <div>
      <div class="no no-lg">
        {parts.map((p, i) => (
          <>
            {p}
            {i < parts.length - 1 && <span class={`gap ${filled ? 'filled' : ''}`}>{filled ?? ' '}</span>}
          </>
        ))}
      </div>
      {cue && <div class="cue">({cue})</div>}
    </div>
  );
}

export function DrillCard({ drill, n, refId, onDone }: { drill: Drill; n?: number; refId: string; onDone: (correct: boolean) => void }) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [showDe, setShowDe] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [counted, setCounted] = useState(false);

  const check = () => {
    if (!value.trim() || result) return;
    const r = checkAnswer(value, drill.answer, { strict: true });
    setResult(r);
    const ok = r.verdict !== 'wrong';
    if (ok) {
      clearMistake('drill', refId);
      speak(fillGap(drill.prompt, r.expected));
    } else addMistake({ kind: 'drill', ref: refId, prompt: drill.prompt, answer: drill.answer[0], given: value });
    if (!counted) {
      setCounted(true);
      onDone(ok);
    }
  };

  return (
    <div class="card">
      <div class="row">
        {n !== undefined && <span class="badge">{n}</span>}
        <div class="spacer" />
        {drill.hint && !result && (
          <button class="btn small ghost" onClick={() => setShowHint(!showHint)}>
            Tipp
          </button>
        )}
        <DeToggle on={showDe} onToggle={() => setShowDe(!showDe)} />
      </div>
      <GapSentence prompt={drill.prompt} filled={result ? result.expected : undefined} />
      {showDe && <div class="de">{drill.de}</div>}
      {showHint && drill.hint && <div class="small muted">💡 {drill.hint}</div>}
      <div class="mt">
        <AnswerInput
          value={value}
          onInput={setValue}
          onEnter={check}
          disabled={!!result}
          status={!result ? '' : result.verdict === 'correct' ? 'ok' : result.verdict === 'close' ? 'close' : 'bad'}
          placeholder="Lücke ausfüllen …"
        />
      </div>
      {result && (
        <Feedback
          result={result}
          extra={
            <>
              {drill.explain && <div class="small mt explain">{drill.explain}</div>}
              <div class="de">{drill.de}</div>
            </>
          }
        />
      )}
      {!result && (
        <div class="btn-row">
          <button class="btn primary" onClick={check} disabled={!value.trim()}>
            Prüfen
          </button>
        </div>
      )}
    </div>
  );
}

function useScores(n: number, onAll: (avg: number) => void) {
  const [scores, setScores] = useState<(number | undefined)[]>(() => Array(n).fill(undefined));
  /** upgrade: a later, better score for an item already answered (»Meine Version stimmt auch«). */
  const set = (i: number, v: number, upgrade = false) => {
    if (scores[i] !== undefined && !(upgrade && v > (scores[i] ?? 0))) return;
    const next = [...scores];
    next[i] = v;
    setScores(next);
    if (next.every((x) => x !== undefined)) onAll((next as number[]).reduce((a, b) => a + b, 0) / n);
  };
  return { answered: scores.filter((x) => x !== undefined).length, right: scores.filter((x) => (x ?? 0) >= 0.99).length, set };
}

export function DrillSet({ id, drills, title, onAll }: { id: string; drills: Drill[]; title: string; onAll?: (avg: number) => void }) {
  const { answered, right, set } = useScores(drills.length, (avg) => (markDone(id, avg), onAll?.(avg)));
  return (
    <>
      <div class="section-title">
        {title} · {answered}/{drills.length}
        {answered > 0 && ` · ${right} richtig`}
      </div>
      {drills.map((d, i) => (
        <DrillCard drill={d} n={i + 1} refId={`${id}#${i}`} onDone={(ok) => set(i, ok ? 1 : 0)} />
      ))}
    </>
  );
}

export function TrueFalseSet({ id, items }: { id: string; items: TrueFalse[] }) {
  const { answered, set } = useScores(items.length, (avg) => markDone(id, avg));
  return (
    <>
      <div class="section-title">
        Richtig oder falsch? · {answered}/{items.length}
      </div>
      {items.map((t, i) => (
        <TrueFalseCard t={t} onDone={(ok) => set(i, ok ? 1 : 0)} />
      ))}
    </>
  );
}

function TrueFalseCard({ t, onDone }: { t: TrueFalse; onDone: (ok: boolean) => void }) {
  const [pick, setPick] = useState<boolean | null>(null);
  const [showDe, setShowDe] = useState(false);
  const choose = (v: boolean) => {
    if (pick !== null) return;
    setPick(v);
    onDone(v === t.a);
  };
  const cls = (v: boolean) => (pick === null ? '' : v === t.a ? 'right' : pick === v ? 'wrong' : '');
  return (
    <div class="card tight">
      <div class="row">
        <div class="grow">
          <NoText text={t.s} />
        </div>
        <DeToggle on={showDe} onToggle={() => setShowDe(!showDe)} />
      </div>
      {showDe && <div class="de">{t.de}</div>}
      <div class="choice-grid mt">
        <button class={`btn choice ${cls(true)}`} disabled={pick !== null} onClick={() => choose(true)}>
          ✓ riktig
        </button>
        <button class={`btn choice ${cls(false)}`} disabled={pick !== null} onClick={() => choose(false)}>
          ✗ galt
        </button>
      </div>
      {pick !== null && (
        <div class={`feedback ${pick === t.a ? 'ok' : 'bad'}`}>
          <strong>{t.a ? 'Richtig.' : 'Falsch.'}</strong> {t.why}
        </div>
      )}
    </div>
  );
}

export function FindSet({ id, items, text }: { id: string; items: FindWord[]; text: string }) {
  const { answered, set } = useScores(items.length, (avg) => markDone(id, avg));
  return (
    <>
      <div class="section-title">
        Finde im Text · {answered}/{items.length}
      </div>
      <div class="card">
        <p class="small muted">Wie heißt es im Text? Schreib das Wort oder die Wendung so, wie sie im Text steht.</p>
        {items.map((f, i) => (
          <FindRow f={f} text={text} onDone={(ok) => set(i, ok ? 1 : 0)} />
        ))}
      </div>
    </>
  );
}

function FindRow({ f, text, onDone }: { f: FindWord; text: string; onDone: (ok: boolean) => void }) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const check = () => {
    if (!value.trim() || result) return;
    let r = checkAnswer(value, f.answer);
    // Another form that really is in the text also counts.
    if (r.verdict === 'wrong' && normalize(value).split(' ').length <= 4 && containsPhrase(text, value)) r = { verdict: 'close', expected: f.answer[0], note: 'Steht so im Text – gemeint war aber:' };
    setResult(r);
    onDone(r.verdict !== 'wrong');
  };
  return (
    <div class="mb">
      <div>
        <strong>{f.de}</strong>
      </div>
      <div class="row top">
        <div class="grow">
          <AnswerInput value={value} onInput={setValue} onEnter={check} disabled={!!result} status={!result ? '' : result.verdict === 'correct' ? 'ok' : result.verdict === 'close' ? 'close' : 'bad'} />
        </div>
        {!result && (
          <button class="btn small primary" onClick={check} disabled={!value.trim()}>
            Prüfen
          </button>
        )}
      </div>
      {result && result.verdict !== 'correct' && (
        <div class="small">
          {result.note ?? 'Im Text:'} <span class="no no-md">{result.expected}</span>
        </div>
      )}
    </div>
  );
}

export function TranslateSet({ id, items }: { id: string; items: Translate[] }) {
  const { answered, set } = useScores(items.length, (avg) => markDone(id, avg));
  return (
    <>
      <div class="section-title">
        Übersetze ins Norwegische · {answered}/{items.length}
      </div>
      {items.map((t, i) => (
        <TranslateCard t={t} n={i + 1} refId={`${id}#${i}`} onDone={(v, upgrade) => set(i, v, upgrade)} />
      ))}
    </>
  );
}

export function TranslateCard({ t, n, refId, onDone }: { t: Translate; n: number; refId: string; onDone: (score: number, upgrade?: boolean) => void }) {
  const [value, setValue] = useState('');
  const [res, setRes] = useState<{ score: number; best: string; diff: ReturnType<typeof wordDiff> } | null>(null);
  const [override, setOverride] = useState(false);
  const check = () => {
    if (!value.trim() || res) return;
    let best = t.no[0];
    let diff = wordDiff(best, value);
    for (const v of t.no.slice(1)) {
      const d = wordDiff(v, value);
      if (d.score > diff.score) {
        diff = d;
        best = v;
      }
    }
    const exact = t.no.some((v) => normalize(v) === normalize(value));
    const score = exact ? 1 : diff.score;
    setRes({ score, best, diff });
    if (score >= 0.99) {
      clearMistake('translate', refId);
      speak(best);
    } else if (score < 0.75) addMistake({ kind: 'translate', ref: refId, prompt: t.de, answer: best, given: value });
    onDone(score >= 0.99 ? 1 : score >= 0.75 ? 0.5 : 0);
  };
  const verdict = !res ? '' : override || res.score >= 0.99 ? 'ok' : res.score >= 0.75 ? 'close' : 'bad';
  return (
    <div class="card">
      <div class="row">
        <span class="badge">{n}</span>
      </div>
      <div class="big-de">{t.de}</div>
      {t.hint && <div class="small muted">💡 {t.hint}</div>}
      <div class="mt">
        <AnswerInput value={value} onInput={setValue} onEnter={check} disabled={!!res} status={verdict as '' | 'ok' | 'close' | 'bad'} />
      </div>
      {!res ? (
        <div class="btn-row">
          <button class="btn primary" onClick={check} disabled={!value.trim()}>
            Prüfen
          </button>
        </div>
      ) : (
        <div class={`feedback ${verdict}`}>
          <strong>{verdict === 'ok' ? '✓ Richtig' : verdict === 'close' ? '≈ Fast' : '✗ Vergleiche'}</strong>
          {verdict !== 'ok' && (
            <>
              <DiffView parts={res.diff.parts} />
              <div class="small muted">{DIFF_LEGEND}</div>
            </>
          )}
          <div class="small muted mt">{t.no.length > 1 ? 'Mögliche Lösungen' : 'Lösung'}</div>
          {t.no.map((v) => (
            <div class="row">
              <NoText text={v} />
              <SpeakBtn text={v} small />
            </div>
          ))}
          {verdict !== 'ok' && (
            <button
              class="btn small ghost mt"
              onClick={() => {
                setOverride(true);
                clearMistake('translate', refId);
                onDone(1, true);
              }}
            >
              Meine Version stimmt auch
            </button>
          )}
        </div>
      )}
    </div>
  );
}

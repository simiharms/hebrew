// Extra exercises on a text or scene: true/false, find the word, and a
// summary with gaps.
import { useState } from 'preact/hooks';
import type { Drill, FindWord, TrueFalse } from '../content/types.ts';
import { checkHebrew, lenient, prefixVariants } from '../lib/hebrew.ts';
import { record } from '../lib/skills.ts';
import { markDone } from '../lib/store.ts';
import { DrillCard } from '../screens/grammar.tsx';
import { AnswerInput } from './answer.tsx';
import { HeText } from './hebrew.tsx';

function useScores(n: number, onAll: (avg: number) => void) {
  const [scores, setScores] = useState<(number | undefined)[]>(() => Array(n).fill(undefined));
  const set = (i: number, v: number) => {
    if (scores[i] !== undefined) return;
    const next = [...scores];
    next[i] = v;
    setScores(next);
    if (next.every((x) => x !== undefined)) onAll((next as number[]).reduce((a, b) => a + b, 0) / n);
  };
  return { answered: scores.filter((x) => x !== undefined).length, set };
}

export function TrueFalseSet({ id, items, skill }: { id: string; items: TrueFalse[]; skill: 'reading' | 'listening' }) {
  const { answered, set } = useScores(items.length, (avg) => markDone(`${id}:tf`, avg));
  return (
    <>
      <div class="section-title">
        True or false? · {answered}/{items.length}
      </div>
      {items.map((t, i) => (
        <TrueFalseCard t={t} onDone={(ok) => (record(skill, ok ? 1 : 0, [], 0.5), set(i, ok ? 1 : 0))} />
      ))}
    </>
  );
}

function TrueFalseCard({ t, onDone }: { t: TrueFalse; onDone: (ok: boolean) => void }) {
  const [pick, setPick] = useState<boolean | null>(null);
  const [showEn, setShowEn] = useState(false);
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
          <HeText text={t.s} />
        </div>
        <button class="btn small ghost" onClick={() => setShowEn(!showEn)}>
          EN
        </button>
      </div>
      {showEn && <div class="en">{t.sEn}</div>}
      <div class="choice-grid mt">
        <button class={`btn choice ${cls(true)}`} disabled={pick !== null} onClick={() => choose(true)}>
          ✓ <span class="he">נכון</span> · true
        </button>
        <button class={`btn choice ${cls(false)}`} disabled={pick !== null} onClick={() => choose(false)}>
          ✗ <span class="he">לא נכון</span> · false
        </button>
      </div>
      {pick !== null && (
        <div class={`feedback ${pick === t.a ? 'ok' : 'bad'}`}>
          <strong>{t.a ? 'True.' : 'False.'}</strong> {t.why}
        </div>
      )}
    </div>
  );
}

/** The input counts if it is one of the answers, also with an extra prefix (ו + בבית). */
export function matchesFind(input: string, answers: string[]): boolean {
  const v = lenient(input);
  if (!v) return false;
  const forms = new Set(answers.map(lenient));
  return prefixVariants(v).some((x) => forms.has(x)) || answers.some((a) => checkHebrew(input, [a]).verdict === 'correct');
}

export function FindSet({ id, items }: { id: string; items: FindWord[] }) {
  const { answered, set } = useScores(items.length, (avg) => markDone(`${id}:find`, avg));
  return (
    <>
      <div class="section-title">
        Find it in the text · {answered}/{items.length}
      </div>
      <div class="card">
        <p class="small muted">Find the Hebrew word or phrase in the text and type it as it's written there.</p>
        {items.map((f, i) => (
          <FindRow f={f} onDone={(ok) => (record('reading', ok ? 1 : 0, [], 0.5), set(i, ok ? 1 : 0))} />
        ))}
      </div>
    </>
  );
}

function FindRow({ f, onDone }: { f: FindWord; onDone: (ok: boolean) => void }) {
  const [value, setValue] = useState('');
  const [state, setStateV] = useState<'ok' | 'bad' | null>(null);
  const [note, setNote] = useState('');
  const check = () => {
    if (!value.trim() || state) return;
    const r = checkHebrew(value, f.answer);
    if (r.verdict === 'latin') {
      // English keyboard still on: let them switch and try again.
      setNote(r.note ?? 'Switch to the Hebrew keyboard.');
      return;
    }
    setNote('');
    const ok = matchesFind(value, f.answer);
    setStateV(ok ? 'ok' : 'bad');
    onDone(ok);
  };
  return (
    <div class="mb">
      <div class="small">
        <strong>{f.en}</strong>
      </div>
      <div class="row">
        <div class="grow">
          <AnswerInput value={value} onInput={setValue} onEnter={check} disabled={!!state} status={state ?? ''} />
        </div>
        {!state && (
          <button class="btn small primary" onClick={check} disabled={!value.trim()}>
            Check
          </button>
        )}
      </div>
      {note && <div class="small muted">{note}</div>}
      {state === 'bad' && (
        <div class="small">
          In the text: <span class="he he-md">{f.answer[0]}</span>
        </div>
      )}
    </div>
  );
}

export function SummarySet({ id, drills }: { id: string; drills: Drill[] }) {
  const { answered, set } = useScores(drills.length, (avg) => markDone(`${id}:summary`, avg));
  return (
    <>
      <div class="section-title">
        Complete the summary · {answered}/{drills.length}
      </div>
      {drills.map((d, i) => (
        <DrillCard drill={d} n={i + 1} refId={`${id}#s${i}`} skill="reading" onDone={(ok) => set(i, ok ? 1 : 0)} />
      ))}
    </>
  );
}

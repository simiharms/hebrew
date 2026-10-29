// The lesson test: grammar, words and a translation, ten items, pass at 70 %.
import { useMemo, useState } from 'preact/hooks';
import { AnswerInput, DiffView, Feedback, wordDiff } from '../components/answer.tsx';
import { fillGap, GapSentence } from '../components/exercises.tsx';
import { Progress, TopBar, useEnterKey } from '../components/ui.tsx';
import type { Drill, Translate, Word } from '../content/types.ts';
import { acceptedNo, display, lessonByN, wordsOfLesson } from '../lib/content.ts';
import { type CheckResult, checkAnswer, normalize } from '../lib/norsk.ts';
import { PLAN } from '../lib/plan.ts';
import { go } from '../lib/router.ts';
import { addMistake, markDone, setState, useAppState } from '../lib/store.ts';
import { speak } from '../lib/tts.ts';

type CheckItem = { kind: 'drill'; drill: Drill; ref: string } | { kind: 'word'; word: Word } | { kind: 'translate'; t: Translate };

const shuffle = <T,>(xs: T[]): T[] => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

function buildItems(n: number): CheckItem[] {
  const L = lessonByN.get(n);
  if (!L) return [];
  // At least one drill from every grammar topic, then fill up to six.
  const perTopic = L.grammar.map((g) => shuffle(g.drills.map((d, i) => ({ kind: 'drill' as const, drill: d, ref: `L${n}:${g.id}#${i}` }))));
  const drills: CheckItem[] = [];
  for (let round = 0; drills.length < 6 && round < 6; round++) for (const list of perTopic) if (list[round] && drills.length < 6) drills.push(list[round]);
  const ws = shuffle(wordsOfLesson(n).filter((w) => ['noun', 'verb', 'adj', 'adv'].includes(w.pos)))
    .slice(0, 3)
    .map((word) => ({ kind: 'word' as const, word }));
  const tr = shuffle(L.translate)
    .slice(0, 10 - drills.length - ws.length)
    .map((t) => ({ kind: 'translate' as const, t }));
  return shuffle([...drills, ...ws, ...tr]);
}

export function LessonCheck({ n }: { n: number }) {
  const s = useAppState();
  const items = useMemo(() => buildItems(n), [n]);
  const [i, setI] = useState(0);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<{ ok: boolean; r?: CheckResult; diff?: ReturnType<typeof wordDiff>; expected: string } | null>(null);
  const [right, setRight] = useState(0);
  const [finished, setFinished] = useState(false);
  useEnterKey(() => next(), !!result && !finished);

  if (!items.length) return <TopBar title="Lektionstest" backTo={`lektion/${n}`} />;

  if (finished) {
    const score = right / items.length;
    const passed = score >= 0.7;
    return (
      <>
        <TopBar title="Lektionstest" backTo={`lektion/${n}`} />
        <main class="page">
          <div class="card center">
            <div class="hero">{passed ? '🏅' : '💪'}</div>
            <h2>
              {right} von {items.length}
            </h2>
            <p>{passed ? (n < PLAN.length ? `Bestanden! Weiter mit Lektion ${n + 1}.` : 'Bestanden – du hast das ganze Buch geschafft. Gratulerer!') : 'Noch nicht 70 %. Schau dir die Grammatik noch einmal an und versuch es wieder – die Aufgaben wechseln jedes Mal.'}</p>
            <div class="btn-row">
              <button class="btn" onClick={() => go(`lektion/${n}`)}>
                Zur Lektion
              </button>
              {passed && n < PLAN.length && (
                <button class="btn primary" onClick={() => go(`lektion/${n + 1}`)}>
                  Lektion {n + 1} ›
                </button>
              )}
            </div>
          </div>
        </main>
      </>
    );
  }

  const item = items[i];
  const check = () => {
    if (!value.trim() || result) return;
    if (item.kind === 'drill') {
      const r = checkAnswer(value, item.drill.answer, { strict: true });
      const ok = r.verdict !== 'wrong';
      if (ok) speak(fillGap(item.drill.prompt, r.expected));
      else addMistake({ kind: 'drill', ref: item.ref, prompt: item.drill.prompt, answer: item.drill.answer[0], given: value });
      setResult({ ok, r, expected: r.expected });
      if (ok) setRight((x) => x + 1);
    } else if (item.kind === 'word') {
      const r = checkAnswer(value, acceptedNo(item.word));
      const ok = r.verdict !== 'wrong';
      if (!ok) addMistake({ kind: 'word', ref: `w:${item.word.id}`, prompt: item.word.de, answer: display(item.word), given: value });
      setResult({ ok, r: { ...r, expected: display(item.word) }, expected: display(item.word) });
      if (ok) setRight((x) => x + 1);
    } else {
      let best = item.t.no[0];
      let diff = wordDiff(best, value);
      for (const v of item.t.no.slice(1)) {
        const d = wordDiff(v, value);
        if (d.score > diff.score) [diff, best] = [d, v];
      }
      const ok = item.t.no.some((v) => normalize(v) === normalize(value)) || diff.score >= 0.85;
      setResult({ ok, diff, expected: best });
      if (ok) setRight((x) => x + 1);
    }
  };
  function next() {
    if (i + 1 >= items.length) {
      const score = (right + 0) / items.length;
      markDone(`L${n}:check`, score);
      if (score >= 0.7 && s.lesson === n && n < PLAN.length) {
        setState((st) => {
          st.lesson = n + 1;
        });
      }
      setFinished(true);
      return;
    }
    setI(i + 1);
    setValue('');
    setResult(null);
  }

  return (
    <>
      <TopBar title={`Test · Lektion ${n}`} backTo={`lektion/${n}`} right={<span class="small muted">{i + 1}/{items.length}</span>} />
      <main class="page">
        <Progress value={i / items.length} />
        <div class="card">
          {item.kind === 'drill' && (
            <>
              <div class="small muted">Ergänze die Lücke</div>
              <GapSentence prompt={item.drill.prompt} filled={result ? result.expected : undefined} />
            </>
          )}
          {item.kind === 'word' && (
            <>
              <div class="small muted">Wie heißt das auf Norwegisch?</div>
              <div class="big-de">{item.word.de}</div>
            </>
          )}
          {item.kind === 'translate' && (
            <>
              <div class="small muted">Übersetze ins Norwegische</div>
              <div class="big-de">{item.t.de}</div>
            </>
          )}
          <div class="mt">
            <AnswerInput value={value} onInput={setValue} onEnter={result ? next : check} autoFocus disabled={!!result} status={!result ? '' : result.ok ? 'ok' : 'bad'} />
          </div>
          {result && result.r && <Feedback result={result.r} />}
          {result && result.diff && (
            <div class={`feedback ${result.ok ? 'ok' : 'bad'}`}>
              <strong>{result.ok ? '✓ Richtig' : '✗ Vergleiche'}</strong>
              <DiffView parts={result.diff.parts} />
              <div class="no no-md mt">{result.expected}</div>
            </div>
          )}
          <div class="btn-row">
            {!result ? (
              <button class="btn primary" onClick={check} disabled={!value.trim()}>
                Prüfen
              </button>
            ) : (
              <button class="btn primary" onClick={next}>
                {i + 1 >= items.length ? 'Ergebnis' : 'Weiter'}
              </button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

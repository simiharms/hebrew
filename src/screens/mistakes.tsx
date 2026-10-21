import { useMemo, useState } from 'preact/hooks';
import { AnswerInput, Feedback } from '../components/answer.tsx';
import { TopBar } from '../components/ui.tsx';
import { type CheckResult, checkHebrew } from '../lib/hebrew.ts';
import { go } from '../lib/router.ts';
import { clearMistake, getState, type Mistake, useAppState } from '../lib/store.ts';
import { speak } from '../lib/tts.ts';
import { renderPrompt } from './grammar.tsx';

const KIND_LABEL: Record<Mistake['kind'], string> = {
  vocab: 'Words',
  verb: 'Verb forms',
  drill: 'Grammar',
  number: 'Numbers',
  dictation: 'Dictation',
};

export function MistakesPage() {
  const s = useAppState();
  const [practice, setPractice] = useState(false);
  if (practice) return <MistakePractice onExit={() => setPractice(false)} />;
  const list = [...s.mistakes].reverse();
  return (
    <>
      <TopBar title="Mistake bank" backTo="practice" />
      <main class="page">
        <div class="card primary small">
          Every grammar, verb and number answer you got wrong lands here. Fix it once correctly and it leaves the bank.
        </div>
        {list.length === 0 ? (
          <div class="card center muted">No mistakes saved. Nice!</div>
        ) : (
          <>
            <button class="btn primary block" onClick={() => setPractice(true)}>
              Practice {Math.min(15, list.length)} mistakes
            </button>
            {(Object.keys(KIND_LABEL) as Mistake['kind'][]).map((k) => {
              const items = list.filter((m) => m.kind === k);
              if (!items.length) return null;
              return (
                <>
                  <div class="section-title">
                    {KIND_LABEL[k]} · {items.length}
                  </div>
                  <div class="card tight">
                    {items.slice(0, 30).map((m) => (
                      <div class="mb">
                        <div class="he">{m.prompt}</div>
                        <div class="small">
                          <span class="diff-bad he">{m.given}</span> → <span class="diff-ok he">{m.answer}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })}
          </>
        )}
      </main>
    </>
  );
}

function MistakePractice({ onExit }: { onExit: () => void }) {
  // Listening number mistakes can't be retyped from text; practise the rest.
  const items = useMemo(
    () =>
      [...getState().mistakes]
        .filter((m) => !m.ref.startsWith('listen:'))
        .sort(() => Math.random() - 0.5)
        .slice(0, 15),
    [],
  );
  const [i, setI] = useState(0);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  if (!items.length || i >= items.length) {
    return (
      <>
        <TopBar title="Mistake bank" backTo="practice" />
        <main class="page">
          <div class="card center">
            <h3>Round done</h3>
            <button class="btn primary" onClick={onExit}>
              Back
            </button>
            <button class="btn ghost" onClick={() => go('today')}>
              Today
            </button>
          </div>
        </main>
      </>
    );
  }
  const m = items[i];
  const check = () => {
    const r = checkHebrew(value, [m.answer]);
    setResult(r);
    if (r.verdict === 'correct' || r.verdict === 'close') {
      clearMistake(m.kind, m.ref);
      speak(m.answer);
    }
  };
  const done = result && result.verdict !== 'latin';
  return (
    <>
      <TopBar title={`Mistakes ${i + 1}/${items.length}`} backTo="practice" />
      <main class="page">
        <div class="card">
          <span class="badge">{KIND_LABEL[m.kind]}</span>
          <div class="prompt-box">{m.prompt.includes('___') ? renderPrompt(m.prompt) : <div class="he he-lg">{m.prompt}</div>}</div>
          <AnswerInput value={value} onInput={setValue} onEnter={done ? () => (setI(i + 1), setValue(''), setResult(null)) : check} autoFocus />
          {result && <Feedback result={result} />}
          <div class="btn-row">
            {!done ? (
              <button class="btn primary" onClick={check} disabled={!value.trim()}>
                Check
              </button>
            ) : (
              <button class="btn primary" onClick={() => (setI(i + 1), setValue(''), setResult(null))}>
                Next →
              </button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

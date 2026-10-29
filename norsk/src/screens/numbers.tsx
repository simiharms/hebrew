// Numbers, clock times and dates: listen and type digits, or write them in words.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { AnswerInput } from '../components/answer.tsx';
import { Seg, SpeakBtn, TopBar, useEnterKey } from '../components/ui.tsx';
import { normalize } from '../lib/norsk.ts';
import { clockWords, dateWords, MONTHS, numberVariants, numberWords, ordinalWords, pad2, sameNumberWords, yearWords } from '../lib/numbers.ts';
import { addMistake } from '../lib/store.ts';
import { speak } from '../lib/tts.ts';

type Mode = 'hear' | 'write' | 'clock' | 'date';
type Range = '20' | '100' | '9999' | 'year';

interface Task {
  show: string; // what the learner sees (digits) – empty when listening
  say: string; // what is spoken
  answers: string[]; // accepted answers
  digits?: boolean; // the answer is typed as digits
}

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

function makeTask(mode: Mode, range: Range): Task {
  if (mode === 'clock') {
    const h = rnd(1, 23);
    const m = rnd(0, 11) * 5;
    const words = clockWords(h, m);
    return { show: `${h}:${pad2(m)}`, say: words[0], answers: words };
  }
  if (mode === 'date') {
    const month = rnd(1, 12);
    const day = rnd(1, month === 2 ? 28 : 30);
    const w = dateWords(day, month);
    return { show: `${day}. ${MONTHS[month - 1]}`, say: w, answers: [w, w.replace(/^den /, '')] };
  }
  const n = range === '20' ? rnd(0, 20) : range === '100' ? rnd(21, 99) : range === '9999' ? rnd(100, 9999) : rnd(1814, 2030);
  const words = range === 'year' ? yearWords(n) : numberVariants(n);
  if (mode === 'hear') return { show: '', say: words[0], answers: [String(n)], digits: true };
  return { show: String(n), say: words[0], answers: words };
}

function isRight(task: Task, given: string): boolean {
  if (task.digits) return given.replace(/[\s.]/g, '') === task.answers[0];
  return task.answers.some((a) => normalize(a) === normalize(given) || sameNumberWords(a, given));
}

export function NumbersPage() {
  const [mode, setMode] = useState<Mode>('hear');
  const [range, setRange] = useState<Range>('20');
  const [round, setRound] = useState(0);
  const task = useMemo(() => makeTask(mode, range), [mode, range, round]);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<boolean | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  const check = () => {
    if (!value.trim() || result !== null) return;
    const ok = isRight(task, value);
    setResult(ok);
    setScore((x) => ({ right: x.right + (ok ? 1 : 0), total: x.total + 1 }));
    if (!ok) addMistake({ kind: 'number', ref: `${mode}:${task.say}`, prompt: task.show || task.say, answer: task.digits ? task.answers[0] : task.answers[0], given: value });
    else if (!task.digits) speak(task.say);
  };
  const next = () => {
    setRound(round + 1);
    setValue('');
    setResult(null);
  };
  useEnterKey(next, result !== null);
  // In listening mode each new number is spoken as soon as it appears.
  useEffect(() => {
    if (mode === 'hear' && round > 0) speak(task.say);
  }, [task]);

  return (
    <>
      <TopBar title="Zahlen und Uhrzeit" backTo="ueben" right={score.total > 0 ? <span class="small muted">{score.right}/{score.total}</span> : undefined} />
      <main class="page">
        <div class="tabs-scroll">
          <Seg
            value={mode}
            options={[
              { v: 'hear', label: 'Hören' },
              { v: 'write', label: 'Schreiben' },
              { v: 'clock', label: 'Uhrzeit' },
              { v: 'date', label: 'Datum' },
            ]}
            onChange={(v) => (setMode(v), setValue(''), setResult(null), setRound(round + 1))}
          />
        </div>
        {(mode === 'hear' || mode === 'write') && (
          <div class="mt">
            <Seg
              value={range}
              options={[
                { v: '20', label: '0–20' },
                { v: '100', label: '21–99' },
                { v: '9999', label: '100–9999' },
                { v: 'year', label: 'Jahre' },
              ]}
              onChange={(v) => (setRange(v), setValue(''), setResult(null), setRound(round + 1))}
            />
          </div>
        )}
        {mode === 'clock' && (
          <div class="card primary small">
            Achtung: <strong>halv tre</strong> = halb drei = 2:30, wie im Deutschen. <strong>kvart over tre</strong> = 3:15, <strong>kvart på fire</strong> = 3:45,{' '}
            <strong>ti på halv fire</strong> = 3:20, <strong>fem over halv fire</strong> = 3:35. Im Alltag zählt man nur bis zwölf.
          </div>
        )}
        <div class="card flash">
          <div class="prompt-box">
            {mode === 'hear' ? (
              <>
                <SpeakBtn text={task.say} label="Zahl anhören" />
                <div class="hint">Schreib die Zahl in Ziffern.</div>
              </>
            ) : (
              <>
                <div class="number-show">{task.show}</div>
                <div class="hint">{mode === 'clock' ? 'Wie sagt man die Uhrzeit?' : mode === 'date' ? 'Wie sagt man das Datum? (den …)' : 'Schreib die Zahl in Worten.'}</div>
              </>
            )}
          </div>
          <AnswerInput value={value} onInput={setValue} onEnter={result === null ? check : next} german={mode === 'hear'} autoFocus disabled={result !== null} placeholder={mode === 'hear' ? 'z. B. 17' : 'Auf Norwegisch …'} status={result === null ? '' : result ? 'ok' : 'bad'} />
          {result !== null && (
            <div class={`feedback ${result ? 'ok' : 'bad'}`}>
              <strong>{result ? '✓ Richtig' : '✗ Nicht ganz'}</strong>
              <div class="row mt">
                <span class="no no-lg">{task.digits ? `${task.answers[0]} – ${task.say}` : task.answers[0]}</span>
                <SpeakBtn text={task.say} small />
              </div>
              {!task.digits && task.answers.length > 1 && <div class="small muted">Auch richtig: {task.answers.slice(1).join(' · ')}</div>}
            </div>
          )}
          <div class="btn-row">
            {result === null ? (
              <button class="btn primary" onClick={check} disabled={!value.trim()}>
                Prüfen
              </button>
            ) : (
              <button class="btn primary" onClick={next}>
                Nächste
              </button>
            )}
          </div>
        </div>
        <details class="card">
          <summary>Übersicht: die Zahlen</summary>
          <table class="grid">
            <tbody>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 30, 40, 50, 60, 70, 80, 90, 100, 1000].map((n) => (
                <tr>
                  <td>{n}</td>
                  <td>
                    <button class="linklike no" onClick={() => speak(numberWords(n))}>
                      {numberWords(n)}
                    </button>
                  </td>
                  <td class="muted">{n > 0 && n <= 31 ? ordinalWords(n) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="small muted">Früher zählte man auch »enogtjue« (einundzwanzig) wie im Deutschen; heute ist »tjueen« üblich. 7 = sju oder syv.</p>
        </details>
      </main>
    </>
  );
}

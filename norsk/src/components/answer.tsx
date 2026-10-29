import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Question, WritingTask } from '../content/types.ts';
import { type CheckResult, containsKeyword, fold, normalize, scoreKeywords, wordCount } from '../lib/norsk.ts';
import { getState, markDone, setState } from '../lib/store.ts';
import { NoText } from './text.tsx';
import { DeToggle, SpeakBtn } from './ui.tsx';

interface InputProps {
  value: string;
  onInput: (v: string) => void;
  onEnter?: () => void;
  status?: 'ok' | 'close' | 'bad' | '';
  placeholder?: string;
  autoFocus?: boolean;
  german?: boolean; // German answer: no æ ø å keys
  disabled?: boolean;
  multiline?: boolean;
}

/** Text input for answers, with æ ø å keys for keyboards that don't have them. */
export function AnswerInput({ value, onInput, onEnter, status = '', placeholder, autoFocus, german, disabled, multiline }: InputProps) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  const insert = (ch: string) => {
    const el = ref.current;
    if (!el) return onInput(value + ch);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + ch + value.slice(end);
    onInput(next);
    requestAnimationFrame(() => {
      el.focus({ preventScroll: true });
      el.setSelectionRange(start + 1, start + 1);
    });
  };
  const common = {
    ref,
    class: `answer ${status} ${multiline ? 'multi' : ''}`,
    lang: german ? 'de' : 'nb',
    value,
    placeholder: placeholder ?? (german ? 'Auf Deutsch …' : 'Auf Norwegisch …'),
    autocomplete: 'off',
    autocorrect: 'off',
    autocapitalize: 'off' as const,
    spellcheck: false,
    disabled,
    onInput: (e: Event) => onInput((e.target as HTMLInputElement).value),
  };
  return (
    <div class="answer-wrap">
      {multiline ? (
        <textarea {...common} />
      ) : (
        <input
          {...common}
          enterkeyhint="done"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onEnter?.();
            }
          }}
        />
      )}
      {!german && !disabled && (
        <div class="keys" aria-label="Sonderzeichen">
          {['æ', 'ø', 'å'].map((c) => (
            <button type="button" class="key" onPointerDown={(e) => e.preventDefault()} onClick={() => insert(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Feedback({ result, onOverride, extra }: { result: CheckResult; onOverride?: () => void; extra?: ComponentChildren }) {
  const cls = result.verdict === 'correct' ? 'ok' : result.verdict === 'close' ? 'close' : 'bad';
  return (
    <div class={`feedback ${cls}`}>
      <div>
        <strong>{result.verdict === 'correct' ? '✓ Richtig' : result.verdict === 'close' ? '≈ Fast' : '✗ Nicht ganz'}</strong>
        {result.note && <span> – {result.note}</span>}
      </div>
      {result.verdict !== 'correct' && (
        <div class="row mt">
          <span class="no no-lg">{result.expected}</span>
          <SpeakBtn text={result.expected} small />
        </div>
      )}
      {extra}
      {onOverride && result.verdict === 'wrong' && (
        <button class="btn small ghost mt" onClick={onOverride}>
          Ich hatte recht – Antwort gelten lassen
        </button>
      )}
    </div>
  );
}

// ---------- Open question about a text ----------

export function OpenQuestion({ q, n, onDone }: { q: Question; n: number; onDone: (score: number) => void }) {
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);
  const [self, setSelf] = useState<number | null>(null);
  const [showDe, setShowDe] = useState(false);
  const kw = scoreKeywords(text, q.keywords);
  const suggestion = kw.score >= 0.66 ? 1 : kw.score >= 0.34 ? 0.5 : 0;
  const rate = (v: number) => {
    if (self === null) onDone(v);
    setSelf(v);
  };
  return (
    <div class="card">
      <div class="row">
        <span class="badge">{n}</span>
        <div class="spacer" />
        <SpeakBtn text={q.q} small />
        <DeToggle on={showDe} onToggle={() => setShowDe(!showDe)} />
      </div>
      <NoText text={q.q} />
      {showDe && <div class="de">{q.qDe}</div>}
      {!checked ? (
        <>
          <AnswerInput value={text} onInput={setText} onEnter={() => text.trim() && setChecked(true)} placeholder="Antworte auf Norwegisch …" />
          <div class="btn-row">
            <button class="btn primary" onClick={() => setChecked(true)} disabled={!text.trim()}>
              Prüfen
            </button>
            <button class="btn ghost" onClick={() => setChecked(true)}>
              Lösung zeigen
            </button>
          </div>
        </>
      ) : (
        <>
          {text && (
            <div class="card tight soft">
              <div class="small muted">Deine Antwort</div>
              <div class="no no-md">{text}</div>
            </div>
          )}
          <div class="small muted">Wichtige Wörter</div>
          <div>
            {q.keywords.map((g, i) => (
              <span class={`badge kw ${kw.matched[i] ? 'good' : 'bad'}`}>
                {kw.matched[i] ? '✓' : '✗'} {g[0]}
              </span>
            ))}
          </div>
          <div class="small muted mt">Musterantwort</div>
          <div class="row">
            <NoText text={q.answer} />
            <SpeakBtn text={q.answer} small />
          </div>
          <div class="de">{q.answerDe}</div>
          <div class="small muted mt">Wie war's? {text ? `(Vorschlag: ${suggestion === 1 ? 'richtig' : suggestion === 0.5 ? 'teilweise' : 'daneben'})` : ''}</div>
          <div class="btn-row">
            <button class={`btn small ${self === 1 ? 'good' : ''}`} onClick={() => rate(1)}>
              ✓ Richtig
            </button>
            <button class={`btn small ${self === 0.5 ? 'primary' : ''}`} onClick={() => rate(0.5)}>
              ≈ Teilweise
            </button>
            <button class={`btn small ${self === 0 ? 'primary' : ''}`} onClick={() => rate(0)}>
              ✗ Daneben
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Writing task ----------

export function WritingBox({ task, id }: { task: WritingTask; id: string }) {
  const saved = getState().writings[id];
  const [text, setText] = useState(saved?.text ?? '');
  const [showModel, setShowModel] = useState(false);
  const [self, setSelf] = useState<number | undefined>(saved?.self);
  const words = wordCount(text);
  const enough = words >= task.minWords;

  useEffect(() => {
    const t = setTimeout(() => {
      if (text !== (getState().writings[id]?.text ?? '')) {
        setState((s) => {
          s.writings[id] = { ...(s.writings[id] ?? {}), text, at: Date.now() };
        });
      }
    }, 600);
    return () => clearTimeout(t);
  }, [text]);

  const rate = (v: number) => {
    setSelf(v);
    setState((s) => {
      s.writings[id] = { text, at: Date.now(), self: v };
    });
    markDone(id, v / 3);
  };

  return (
    <div class="card">
      <h3>📝 Schreibaufgabe</h3>
      <p>{task.prompt}</p>
      {task.useWords && task.useWords.length > 0 && (
        <div class="mt">
          <div class="small muted">Versuche diese Wörter zu verwenden</div>
          {task.useWords.map((w) => (
            <span class={`badge kw ${containsKeyword(text, w) ? 'good' : ''}`}>{w}</span>
          ))}
        </div>
      )}
      {task.checklist && task.checklist.length > 0 && (
        <div class="mt">
          <div class="small muted">Checkliste</div>
          {task.checklist.map((c) => {
            const ok = c.keywords.some((k) => containsKeyword(text, k));
            return (
              <div class="row small">
                <span class={`check ${ok ? 'on' : ''}`}>{ok ? '✓' : ''}</span>
                {c.de}
              </div>
            );
          })}
        </div>
      )}
      <div class="mt">
        <AnswerInput value={text} onInput={setText} multiline placeholder="Skriv her …" />
      </div>
      <div class="row small">
        <span class={enough ? 'badge good' : 'badge'}>
          {words} / {task.minWords} Wörter
        </span>
        <div class="spacer" />
        <span class="muted">Wird automatisch gespeichert</span>
      </div>
      <div class="btn-row">
        <button class="btn" onClick={() => setShowModel(!showModel)}>
          {showModel ? 'Mustertext ausblenden' : 'Mustertext zeigen'}
        </button>
      </div>
      {showModel && (
        <div class="card tight primary">
          <div class="pre">
            <NoText text={task.model} />
          </div>
          <SpeakBtn text={task.model} small label="Vorlesen" />
          <div class="de mt pre">{task.modelDe}</div>
        </div>
      )}
      {(showModel || enough) && (
        <>
          <div class="small muted mt">Vergleiche mit dem Mustertext. Wie gut ist es dir gelungen?</div>
          <div class="btn-row">
            {(
              [
                [1, 'Schwierig'],
                [2, 'Ganz gut'],
                [3, 'Sehr gut'],
              ] as const
            ).map(([v, l]) => (
              <button class={`btn small ${self === v ? 'primary' : ''}`} onClick={() => rate(v)}>
                {l}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Dictation and translation diff ----------

export interface DiffPart {
  w: string;
  kind: 'ok' | 'miss' | 'extra' | 'near';
}

/** Word-level diff between expected and given text (LCS on normalized words); æ/ø/å slips count as "near". */
export function wordDiff(expected: string, given: string): { parts: DiffPart[]; score: number } {
  const exRaw = expected.split(/\s+/).filter((w) => normalize(w));
  const ex = exRaw.map((w) => fold(w));
  const gvRaw = given.split(/\s+/).filter((w) => normalize(w));
  const gv = gvRaw.map((w) => fold(w));
  const n = ex.length;
  const m = gv.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i][j] = ex[i] === gv[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  let exact = 0;
  while (i < n || j < m) {
    if (i < n && j < m && ex[i] === gv[j]) {
      const same = normalize(exRaw[i]) === normalize(gvRaw[j]);
      if (same) exact++;
      parts.push({ w: exRaw[i], kind: same ? 'ok' : 'near' });
      i++;
      j++;
    } else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) {
      parts.push({ w: gvRaw[j], kind: 'extra' });
      j++;
    } else {
      parts.push({ w: exRaw[i], kind: 'miss' });
      i++;
    }
  }
  const matched = dp[0][0];
  return { parts, score: (exact + (matched - exact) * 0.75) / Math.max(n, m, 1) };
}

export function DiffView({ parts }: { parts: DiffPart[] }) {
  return (
    <div class="no no-md mt">
      {parts.map((p) => (
        <>
          <span class={`diff-${p.kind}`}>{p.w}</span>{' '}
        </>
      ))}
    </div>
  );
}

export const DIFF_LEGEND = 'grün = richtig · gelb = nur æ, ø oder å falsch · unterstrichen = fehlt · durchgestrichen = zu viel oder falsch';

export function Dictation({ text, gender, onDone }: { text: string; gender?: 'm' | 'f'; onDone?: (score: number) => void }) {
  const [given, setGiven] = useState('');
  const [result, setResult] = useState<ReturnType<typeof wordDiff> | null>(null);
  const check = () => {
    if (!given.trim()) return;
    const r = wordDiff(text, given);
    setResult(r);
    onDone?.(r.score);
  };
  return (
    <div class="card">
      <div class="row wrap">
        <SpeakBtn text={text} gender={gender} label="Abspielen" />
        <span class="small muted">Schreib genau, was du hörst. Du kannst es so oft abspielen, wie du willst.</span>
      </div>
      <div class="mt">
        <AnswerInput value={given} onInput={setGiven} onEnter={check} disabled={!!result} />
      </div>
      {!result ? (
        <div class="btn-row">
          <button class="btn primary" onClick={check} disabled={!given.trim()}>
            Prüfen
          </button>
        </div>
      ) : (
        <div class={`feedback ${result.score >= 0.99 ? 'ok' : result.score >= 0.6 ? 'close' : 'bad'}`}>
          <strong>{Math.round(result.score * 100)} % der Wörter</strong>
          <DiffView parts={result.parts} />
          <div class="small muted mt">{DIFF_LEGEND}</div>
          <div class="no no-md mt">{text}</div>
          <button class="btn small ghost" onClick={() => (setResult(null), setGiven(''))}>
            Nochmal
          </button>
        </div>
      )}
    </div>
  );
}

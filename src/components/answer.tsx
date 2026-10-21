import { useEffect, useRef, useState } from 'preact/hooks';
import type { Question, WritingTask } from '../content/types.ts';
import { type CheckResult, containsKeyword, hasHebrew, lenient, scoreKeywords, wordCount } from '../lib/hebrew.ts';
import { loadSemantic, similarity, similarityToScore } from '../lib/semantic.ts';
import { getState, markDone, markTask, setState } from '../lib/store.ts';
import { HeText } from './hebrew.tsx';
import { SpeakBtn } from './ui.tsx';

interface InputProps {
  value: string;
  onInput: (v: string) => void;
  onEnter?: () => void;
  status?: 'ok' | 'close' | 'bad' | '';
  placeholder?: string;
  autoFocus?: boolean;
  ltr?: boolean;
  disabled?: boolean;
}

export function AnswerInput({ value, onInput, onEnter, status = '', placeholder, autoFocus, ltr, disabled }: InputProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  return (
    <input
      ref={ref}
      class={`answer ${ltr ? 'ltr' : 'he'} ${status}`}
      dir={ltr ? 'ltr' : 'rtl'}
      lang={ltr ? 'en' : 'he'}
      value={value}
      placeholder={placeholder ?? (ltr ? 'Type in English' : 'הקלידו כאן…')}
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck={false}
      enterkeyhint="done"
      disabled={disabled}
      onInput={(e) => onInput((e.target as HTMLInputElement).value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onEnter?.();
        }
      }}
    />
  );
}

export function Feedback({
  result,
  onOverride,
  extra,
}: {
  result: CheckResult;
  onOverride?: () => void;
  extra?: preact.ComponentChildren;
}) {
  const cls = result.verdict === 'correct' ? 'ok' : result.verdict === 'close' ? 'close' : 'bad';
  return (
    <div class={`feedback ${cls}`}>
      <div>
        <strong>{result.verdict === 'correct' ? '✓ Correct' : result.verdict === 'close' ? '≈ Almost' : result.verdict === 'latin' ? '⌨︎ Keyboard' : '✗ Not quite'}</strong>
        {result.note && <span> — {result.note}</span>}
      </div>
      {result.verdict !== 'correct' && result.verdict !== 'latin' && (
        <div class="row mt">
          {hasHebrew(result.expected) ? (
            <>
              <span class="he he-lg">{result.expected}</span>
              <SpeakBtn text={result.expected} small />
            </>
          ) : (
            <strong style={{ color: 'var(--text)' }}>{result.expected}</strong>
          )}
        </div>
      )}
      {result.verdict === 'correct' && result.note && (
        <div class="row mt">
          <span class="he he-lg">{result.expected}</span>
        </div>
      )}
      {extra}
      {onOverride && (result.verdict === 'wrong' || result.verdict === 'close') && (
        <button class="btn small ghost mt" onClick={onOverride}>
          I was right — accept my answer
        </button>
      )}
    </div>
  );
}

// ---------- Open comprehension question ----------

export function OpenQuestion({
  q,
  n,
  stored,
  onDone,
}: {
  q: Question;
  n: number;
  stored?: number;
  onDone: (score: number) => void;
}) {
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);
  const [sem, setSem] = useState<number | null>(null);
  const [semState, setSemState] = useState<'off' | 'loading' | 'done' | 'error'>('off');
  const [self, setSelf] = useState<number | null>(stored ?? null);
  const [showEn, setShowEn] = useState(false);

  const kw = scoreKeywords(text, q.keywords);
  const useSem = getState().settings.semantic;

  const check = async () => {
    setChecked(true);
    if (useSem && text.trim()) {
      setSemState('loading');
      try {
        await loadSemantic();
        const s = await similarity(text, q.answer);
        setSem(similarityToScore(s));
        setSemState('done');
      } catch {
        setSemState('error');
      }
    }
  };

  const combined = sem === null ? kw.score : Math.max(kw.score, 0.5 * kw.score + 0.5 * sem);
  const suggestion = combined >= 0.66 ? 1 : combined >= 0.34 ? 0.5 : 0;

  const rate = (v: number) => {
    setSelf(v);
    onDone(v);
  };

  return (
    <div class="card">
      <div class="row">
        <span class="badge">{n}</span>
        <div class="spacer" />
        <button class="btn small ghost" onClick={() => setShowEn(!showEn)}>
          EN
        </button>
      </div>
      <HeText text={q.q} size="md" />
      {showEn && <div class="en">{q.qEn}</div>}
      {!checked ? (
        <>
          <AnswerInput value={text} onInput={setText} onEnter={check} placeholder="תשובה בעברית…" />
          <div class="btn-row">
            <button class="btn primary" onClick={check} disabled={!text.trim()}>
              Check
            </button>
            <button class="btn ghost" onClick={() => setChecked(true)}>
              Show answer
            </button>
          </div>
        </>
      ) : (
        <>
          {text && (
            <div class="card tight" style={{ background: 'var(--surface-2)' }}>
              <div class="small muted">Your answer</div>
              <div class="he he-md">{text}</div>
            </div>
          )}
          <div class="small muted">Key ideas</div>
          <div>
            {q.keywords.map((g, i) => (
              <span class={`badge kw ${kw.matched[i] ? 'good' : 'bad'}`}>
                {kw.matched[i] ? '✓' : '✗'} <span class="he">{g[0]}</span>
              </span>
            ))}
          </div>
          {useSem && (
            <div class="small muted mt">
              {semState === 'loading' && 'AI meaning check… (first time downloads the model)'}
              {semState === 'done' && sem !== null && `AI meaning match: ${Math.round(sem * 100)}%`}
              {semState === 'error' && 'AI check unavailable (offline?) — using key ideas only.'}
            </div>
          )}
          <div class="small muted mt">Model answer</div>
          <div class="row">
            <HeText text={q.answer} />
            <SpeakBtn text={q.answer} small />
          </div>
          <div class="en">{q.answerEn}</div>
          <div class="small muted mt">How did you do? {text ? `(suggested: ${suggestion === 1 ? 'got it' : suggestion === 0.5 ? 'partly' : 'missed'})` : ''}</div>
          <div class="btn-row">
            <button class={`btn small ${self === 1 ? 'good' : ''}`} onClick={() => rate(1)}>
              ✓ Got it
            </button>
            <button class={`btn small ${self === 0.5 ? 'primary' : ''}`} onClick={() => rate(0.5)}>
              ≈ Partly
            </button>
            <button class={`btn small ${self === 0 ? 'primary' : ''}`} onClick={() => rate(0)}>
              ✗ Missed
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
  const [showEn, setShowEn] = useState(false);
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
    markTask(id);
  };

  return (
    <div class="card">
      <div class="row">
        <strong>✍️ Writing</strong>
        <div class="spacer" />
        <button class="btn small ghost" onClick={() => setShowEn(!showEn)}>
          EN
        </button>
      </div>
      <HeText text={task.prompt} />
      {showEn && <div class="en">{task.promptEn}</div>}
      {task.useWords && task.useWords.length > 0 && (
        <div class="mt">
          <div class="small muted">Try to use</div>
          {task.useWords.map((w) => (
            <span class={`badge kw ${containsKeyword(text, w) ? 'good' : ''}`}>
              <span class="he">{w}</span>
            </span>
          ))}
        </div>
      )}
      {task.checklist && task.checklist.length > 0 && (
        <div class="mt">
          <div class="small muted">Checklist</div>
          {task.checklist.map((c) => {
            const ok = c.keywords.some((k) => containsKeyword(text, k));
            return (
              <div class="row small">
                <span class={`check ${ok ? 'on' : ''}`}>{ok ? '✓' : ''}</span>
                {c.en}
              </div>
            );
          })}
        </div>
      )}
      <textarea
        class="answer he mt"
        dir="rtl"
        lang="he"
        value={text}
        placeholder="כתבו כאן…"
        autocorrect="off"
        autocapitalize="off"
        spellcheck={false}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
      />
      <div class="row small">
        <span class={enough ? 'badge good' : 'badge'}>
          {words} / {task.minWords} words
        </span>
        <div class="spacer" />
        <span class="muted">Tip: tap 🎤 on the Hebrew keyboard to dictate</span>
      </div>
      <div class="btn-row">
        <button class="btn" onClick={() => setShowModel(!showModel)}>
          {showModel ? 'Hide' : 'Show'} model answer
        </button>
      </div>
      {showModel && (
        <div class="card tight primary">
          <div class="pre">
            <HeText text={task.model} />
          </div>
          <SpeakBtn text={task.model} small />
          <div class="en mt">{task.modelEn}</div>
        </div>
      )}
      {(showModel || enough) && (
        <>
          <div class="small muted mt">Compare with the model. How well did you express it?</div>
          <div class="btn-row">
            {[
              [1, 'Struggled'],
              [2, 'OK'],
              [3, 'Nailed it'],
            ].map(([v, l]) => (
              <button class={`btn small ${self === v ? 'primary' : ''}`} onClick={() => rate(v as number)}>
                {l}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Dictation (type what you hear) ----------

export interface DiffPart {
  w: string;
  kind: 'ok' | 'miss' | 'extra';
}

/** Word-level diff between expected and given text (LCS on lenient tokens). */
export function wordDiff(expected: string, given: string): { parts: DiffPart[]; score: number } {
  const exRaw = expected.split(/\s+/).filter((w) => lenient(w));
  const ex = exRaw.map((w) => lenient(w));
  const gvRaw = given.split(/\s+/).filter(Boolean);
  const gv = gvRaw.map((w) => lenient(w));
  const n = ex.length;
  const m = gv.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = ex[i] && ex[i] === gv[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && ex[i] && ex[i] === gv[j]) {
      parts.push({ w: exRaw[i], kind: 'ok' });
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
  return { parts, score: dp[0][0] / (n || 1) };
}

export function Dictation({ text, gender, onDone }: { text: string; gender?: 'm' | 'f'; onDone?: (score: number) => void }) {
  const [given, setGiven] = useState('');
  const [result, setResult] = useState<ReturnType<typeof wordDiff> | null>(null);
  const check = () => {
    const r = wordDiff(text, given);
    setResult(r);
    onDone?.(r.score);
  };
  return (
    <div class="card">
      <div class="row">
        <SpeakBtn text={text} gender={gender} label="Play" />
        <span class="small muted">Type exactly what you hear — or repeat it aloud with the keyboard's 🎤 to test your pronunciation</span>
      </div>
      <div class="mt">
        <AnswerInput value={given} onInput={setGiven} onEnter={check} disabled={!!result} />
      </div>
      {!result ? (
        <div class="btn-row">
          <button class="btn primary" onClick={check} disabled={!given.trim()}>
            Check
          </button>
        </div>
      ) : (
        <div class={`feedback ${result.score >= 0.99 ? 'ok' : result.score >= 0.6 ? 'close' : 'bad'}`}>
          <strong>{Math.round(result.score * 100)}% of words</strong>
          <div class="he he-md mt" dir="rtl">
            {result.parts.map((p) => (
              <>
                <span class={p.kind === 'ok' ? 'diff-ok' : p.kind === 'miss' ? 'diff-miss' : 'diff-bad'}>{p.w}</span>{' '}
              </>
            ))}
          </div>
          <div class="small muted mt">green = right · underlined = missed · struck = extra/wrong</div>
          <button class="btn small ghost" onClick={() => (setResult(null), setGiven(''))}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

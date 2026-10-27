import { useState } from 'preact/hooks';
import { AnswerInput, Feedback } from '../components/answer.tsx';
import { Item, LevelBadge, RichText, SpeakBtn, Table, TopBar } from '../components/ui.tsx';
import type { Drill } from '../content/types.ts';
import { LEVELS } from '../content/types.ts';
import { grammar } from '../lib/content.ts';
import { type CheckResult, checkHebrew } from '../lib/hebrew.ts';
import { go } from '../lib/router.ts';
import { record } from '../lib/skills.ts';
import { addMistake, clearMistake, markDone, markTask, useAppState } from '../lib/store.ts';
import { speak } from '../lib/tts.ts';

export function GrammarList() {
  const s = useAppState();
  return (
    <>
      <TopBar title="Grammar" backTo="practice" />
      <main class="page">
        <div class="card primary small">
          The things Duolingo never explains: roots, binyanim, prepositions with endings, numbers, smichut, formal register. Short
          explanations, then you type the answers.
        </div>
        {LEVELS.map((lvl) => {
          const list = grammar.filter((g) => g.level === lvl);
          if (!list.length) return null;
          return (
            <>
              <div class="section-title">{lvl}</div>
              <div class="list">
                {list.map((g) => {
                  const d = s.done[g.id];
                  return (
                    <Item
                      title={g.title}
                      sub={
                        <>
                          <span class="he">{g.titleHe}</span> · {g.summary}
                        </>
                      }
                      done={!!d}
                      right={d ? <span class="badge good">{Math.round(d.score * 100)}%</span> : <LevelBadge level={g.level} />}
                      onClick={() => go(`grammar/${g.id}`)}
                    />
                  );
                })}
              </div>
            </>
          );
        })}
      </main>
    </>
  );
}

export function renderPrompt(prompt: string, filled?: string) {
  const parts = prompt.split('___');
  return (
    <div class="he he-lg" dir="rtl">
      {parts.map((p, i) => (
        <>
          {p}
          {i < parts.length - 1 && (
            <span style={{ borderBottom: '2px solid var(--primary)', padding: filled ? '0 4px' : '0 28px', color: 'var(--primary)' }}>
              {filled ?? ' '}
            </span>
          )}
        </>
      ))}
    </div>
  );
}

export function DrillCard({
  drill,
  n,
  refId,
  onDone,
  skill = 'grammar',
}: {
  drill: Drill;
  n?: number;
  refId: string;
  onDone: (correct: boolean) => void;
  skill?: 'grammar' | 'reading';
}) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [showEn, setShowEn] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const done = result && result.verdict !== 'latin';

  const check = () => {
    if (!value.trim()) return;
    const r = checkHebrew(value, drill.answer, { strict: true });
    setResult(r);
    if (r.verdict === 'latin') return;
    const ok = r.verdict !== 'wrong';
    record(skill, ok ? 1 : 0, skill === 'grammar' ? [refId.split('#')[0]] : []);
    if (ok) {
      clearMistake('drill', refId);
      speak(drill.prompt.replace('___', r.expected).replace(/\s*\([^)]*\)\s*$/, ''));
    } else addMistake({ kind: 'drill', ref: refId, prompt: drill.prompt, answer: drill.answer[0], given: value });
    onDone(ok);
  };

  return (
    <div class="card">
      <div class="row">
        {n !== undefined && <span class="badge">{n}</span>}
        <div class="spacer" />
        {drill.hint && !done && (
          <button class="btn small ghost" onClick={() => setShowHint(!showHint)}>
            Hint
          </button>
        )}
        <button class="btn small ghost" onClick={() => setShowEn(!showEn)}>
          EN
        </button>
      </div>
      {renderPrompt(drill.prompt, done ? result!.expected : undefined)}
      {showEn && <div class="en">{drill.en}</div>}
      {showHint && drill.hint && <div class="small muted">💡 {drill.hint}</div>}
      <div class="mt">
        <AnswerInput
          value={value}
          onInput={setValue}
          onEnter={check}
          disabled={!!done}
          status={!result ? '' : result.verdict === 'correct' ? 'ok' : result.verdict === 'close' ? 'close' : result.verdict === 'latin' ? '' : 'bad'}
          placeholder="המילה החסרה…"
        />
      </div>
      {result && (
        <Feedback
          result={result}
          extra={
            done && (
              <>
                {drill.explain && <div class="small mt" style={{ color: 'var(--text)' }}>{drill.explain}</div>}
                <div class="en">{drill.en}</div>
              </>
            )
          }
        />
      )}
      {!done && (
        <div class="btn-row">
          <button class="btn primary" onClick={check} disabled={!value.trim()}>
            Check
          </button>
        </div>
      )}
    </div>
  );
}

export function GrammarLessonPage({ id }: { id: string }) {
  const g = grammar.find((x) => x.id === id);
  const [results, setResults] = useState<Record<number, boolean>>({});
  const [started, setStarted] = useState(false);
  if (!g) return <TopBar title="Not found" backTo="grammar" />;
  const answered = Object.keys(results).length;
  const correct = Object.values(results).filter(Boolean).length;

  const onDone = (i: number, ok: boolean) => {
    if (i in results) return;
    const next = { ...results, [i]: ok };
    setResults(next);
    if (Object.keys(next).length === g.drills.length) {
      markDone(g.id, Object.values(next).filter(Boolean).length / g.drills.length);
      markTask(g.id);
    }
  };

  return (
    <>
      <TopBar title={g.title} backTo="grammar" right={<LevelBadge level={g.level} />} />
      <main class="page">
        <div class="card">
          <div class="he he-lg">{g.titleHe}</div>
          <p class="muted">{g.summary}</p>
        </div>
        {g.sections.map((sec) => (
          <div class="card">
            <h3>{sec.h}</h3>
            <RichText text={sec.body} />
            {sec.table && <Table rows={sec.table} />}
          </div>
        ))}
        <div class="section-title">
          Practice · {correct}/{answered} right · {g.drills.length} total
        </div>
        {!started ? (
          <button class="btn primary block" onClick={() => setStarted(true)}>
            Start practice
          </button>
        ) : (
          g.drills.map((d, i) => <DrillCard drill={d} n={i + 1} refId={`${g.id}#${i}`} onDone={(ok) => onDone(i, ok)} />)
        )}
        {answered === g.drills.length && (
          <div class="card center">
            <h3>
              {correct}/{g.drills.length} correct
            </h3>
            <p class="small muted">Wrong answers went to your Mistake bank for later review.</p>
            <button class="btn primary" onClick={() => go('grammar')}>
              Back to lessons
            </button>
          </div>
        )}
        <SpeakHint />
      </main>
    </>
  );
}

function SpeakHint() {
  return (
    <p class="small muted center mt">
      Tip: after each correct answer the full sentence is read aloud — repeat it out loud. <SpeakBtn text="יאללה, ממשיכים" small />
    </p>
  );
}

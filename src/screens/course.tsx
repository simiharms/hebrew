import { useMemo, useState } from 'preact/hooks';
import { AnswerInput, Feedback } from '../components/answer.tsx';
import { Item, LevelBadge, Progress, TopBar } from '../components/ui.tsx';
import type { Drill, Form } from '../content/types.ts';
import { grammar, verbById } from '../lib/content.ts';
import { currentUnit, stepDone, type UnitStep, UNITS, unitProgress, unitSteps } from '../lib/course.ts';
import { type CheckResult, checkHebrew } from '../lib/hebrew.ts';
import { go } from '../lib/router.ts';
import { drillable, makeVerbTask, TENSES } from '../lib/session.ts';
import { record } from '../lib/skills.ts';
import { markDone, markTask, setState, useAppState } from '../lib/store.ts';
import { speak } from '../lib/tts.ts';
import { renderPrompt } from './grammar.tsx';

const STEP_EMOJI: Record<UnitStep['kind'], string> = {
  grammar: '🧩',
  read: '📰',
  listen: '📺',
  write: '✉️',
  verbs: '🔁',
  numbers: '🔢',
  deck: '🃏',
  check: '✅',
};

export function CoursePage() {
  const s = useAppState();
  const cur = currentUnit(s);
  return (
    <>
      <TopBar title="Course" backTo="today" />
      <main class="page">
        <div class="card primary small">
          {UNITS.length} units in grammar order, from the alphabet (A1) to formal and literary Hebrew (C1), in the spirit of a
          university course book. Each unit is one grammar point with a text, a scene, verbs and often a card deck and a writing
          task built around it, then a short check. Start wherever the skills check placed you; every unit stays open.
        </div>
        <div class="list">
          {UNITS.map((u, n) => {
            const p = unitProgress(s, n);
            const complete = p.done === p.total;
            const heading = n === 0 || UNITS[n - 1].level !== u.level;
            return (
              <>
              {heading && <div class="section-title">{u.level}</div>}
              <Item
                emoji={complete ? '✅' : n === cur ? '▶️' : String(n + 1)}
                title={
                  <>
                    {n + 1}. {u.title}
                  </>
                }
                sub={
                  <>
                    <span class="he">{u.titleHe}</span> · {p.done}/{p.total} steps
                  </>
                }
                done={complete}
                right={<LevelBadge level={u.level} />}
                onClick={() => go(`unit/${n}`)}
              />
              </>
            );
          })}
        </div>
      </main>
    </>
  );
}

export function UnitPage({ n }: { n: number }) {
  const s = useAppState();
  const u = UNITS[n];
  if (!u) return <TopBar title="Unit not found" backTo="course" />;
  const steps = unitSteps(u, n);
  const p = unitProgress(s, n);
  return (
    <>
      <TopBar title={`Unit ${n + 1}`} backTo="course" right={<LevelBadge level={u.level} />} />
      <main class="page">
        <div class="card">
          <h2 style={{ marginBottom: 2 }}>{u.title}</h2>
          <div class="he he-lg">{u.titleHe}</div>
          <p class="small">
            <strong>Goal:</strong> {u.goal}
          </p>
          <Progress value={p.done / p.total} />
          <div class="small muted mt">
            {p.done}/{p.total} steps done
          </div>
        </div>
        <div class="list">
          {steps.map((st) => {
            const done = stepDone(s, st);
            return (
              <Item
                emoji={STEP_EMOJI[st.kind]}
                title={st.title}
                sub={st.kind === 'check' ? 'Pass with 70% to unlock the next unit as your current one' : st.kind}
                done={done}
                onClick={() => go(st.route)}
                right={<span class={`check ${done ? 'on' : ''}`}>{done ? '✓' : ''}</span>}
              />
            );
          })}
        </div>
        <div class="btn-row">
          {n > 0 && (
            <button class="btn" onClick={() => go(`unit/${n - 1}`)}>
              ← Unit {n}
            </button>
          )}
          {n < UNITS.length - 1 && (
            <button class="btn" onClick={() => go(`unit/${n + 1}`)}>
              Unit {n + 2} →
            </button>
          )}
        </div>
        {n !== s.courseUnit && (
          <button
            class="btn ghost block mt"
            onClick={() =>
              setState((st) => {
                st.courseUnit = n;
              })
            }
          >
            Make this my current unit
          </button>
        )}
      </main>
    </>
  );
}

type CheckItem = { kind: 'drill'; drill: Drill; lesson: string } | { kind: 'verb'; label: string; inf: string; en: string; answer: Form; binyan: string; tense: string };

const shuffle = <T,>(xs: T[]): T[] => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

const TENSE_HE: Record<string, string> = { present: 'הווה', past: 'עבר', future: 'עתיד' };

export function UnitCheck({ n }: { n: number }) {
  const u = UNITS[n];
  const items = useMemo<CheckItem[]>(() => {
    if (!u) return [];
    const drills = shuffle(grammar.filter((g) => u.grammar.includes(g.id)).flatMap((g) => g.drills.map((d) => ({ kind: 'drill' as const, drill: d, lesson: g.id }))));
    const verbs = shuffle(u.verbs.map((id) => verbById.get(id)).filter(Boolean)).slice(0, 3).map((v) => {
      const t = makeVerbTask(v!, shuffle(TENSES.filter((x) => drillable(v!, x)))[0]);
      return { kind: 'verb' as const, label: `${t.pronoun} · ${TENSE_HE[t.tense]}`, inf: v!.inf, en: v!.en, answer: t.answer, binyan: v!.binyan, tense: t.tense };
    });
    return shuffle([...drills.slice(0, 8 - verbs.length), ...verbs]);
  }, [n]);
  const [i, setI] = useState(0);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [right, setRight] = useState(0);
  const [finished, setFinished] = useState(false);

  if (!u) return <TopBar title="Unit not found" backTo="course" />;
  if (!items.length) {
    return (
      <>
        <TopBar title="Unit check" backTo={`unit/${n}`} />
        <main class="page">
          <div class="card">This unit's lessons aren't installed yet.</div>
        </main>
      </>
    );
  }

  if (finished) {
    const score = right / items.length;
    const passed = score >= 0.7;
    return (
      <>
        <TopBar title="Unit check" backTo={`unit/${n}`} />
        <main class="page">
          <div class="card center">
            <h2>
              {right}/{items.length}
            </h2>
            <p>{passed ? 'Passed — on to the next unit.' : 'Not yet 70%. Review the lesson and try again — the questions change each time.'}</p>
            <div class="btn-row">
              <button class="btn" onClick={() => go(`unit/${n}`)}>
                Back to unit
              </button>
              {passed && n < UNITS.length - 1 && (
                <button class="btn primary" onClick={() => go(`unit/${n + 1}`)}>
                  Unit {n + 2} →
                </button>
              )}
            </div>
          </div>
        </main>
      </>
    );
  }

  const item = items[i];
  const accepted = item.kind === 'drill' ? item.drill.answer : [item.answer[0]];
  const done = result && result.verdict !== 'latin';

  const check = () => {
    if (!value.trim()) return;
    const r = checkHebrew(value, accepted, { strict: true });
    setResult(r);
    if (r.verdict === 'latin') return;
    const ok = r.verdict === 'correct';
    if (ok) {
      setRight((x) => x + 1);
      speak(r.expected);
    }
    if (item.kind === 'drill') record('grammar', ok ? 1 : 0, [item.lesson]);
    else record('verbs', ok ? 1 : 0, [`binyan:${item.binyan}`, `tense:${item.tense}`]);
  };

  const next = () => {
    if (i + 1 >= items.length) {
      const total = right;
      const score = total / items.length;
      markDone(`unit:${UNITS[n].id}:check`, score);
      markTask(`unit:${UNITS[n].id}:check`);
      if (score >= 0.7)
        setState((st) => {
          if (st.courseUnit <= n) st.courseUnit = Math.min(n + 1, UNITS.length - 1);
        });
      setFinished(true);
      return;
    }
    setI(i + 1);
    setValue('');
    setResult(null);
  };

  return (
    <>
      <TopBar title={`Unit ${n + 1} check`} backTo={`unit/${n}`} right={<span class="small muted">{i + 1}/{items.length}</span>} />
      <main class="page">
        <Progress value={i / items.length} />
        <div class="card">
          <div class="prompt-box">
            {item.kind === 'drill' ? (
              <>
                {renderPrompt(item.drill.prompt, done ? result!.expected : undefined)}
                <div class="hint">{item.drill.en}</div>
              </>
            ) : (
              <>
                <div class="he he-lg">{item.inf}</div>
                <div class="small muted">{item.en}</div>
                <div class="he he-md mt">{item.label}</div>
              </>
            )}
          </div>
          <AnswerInput
            value={value}
            onInput={setValue}
            onEnter={done ? next : check}
            autoFocus
            status={!result ? '' : result.verdict === 'correct' ? 'ok' : result.verdict === 'latin' ? '' : 'bad'}
          />
          {result && <Feedback result={result} extra={done && item.kind === 'drill' && item.drill.explain ? <div class="small mt" style={{ color: 'var(--text)' }}>{item.drill.explain}</div> : undefined} />}
          <div class="btn-row">
            {!done ? (
              <>
                <button class="btn ghost" onClick={() => (setValue('?'), setResult({ verdict: 'wrong', expected: accepted[0] }))}>
                  I don't know
                </button>
                <button class="btn primary" onClick={check} disabled={!value.trim()}>
                  Check
                </button>
              </>
            ) : (
              <button class="btn primary block" onClick={next}>
                {i + 1 >= items.length ? 'See result' : 'Next →'}
              </button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

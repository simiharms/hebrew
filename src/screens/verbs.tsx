import { useMemo, useState } from 'preact/hooks';
import { AnswerInput, Feedback } from '../components/answer.tsx';
import { HeText } from '../components/hebrew.tsx';
import { Item, LevelBadge, Progress, SpeakBtn, TopBar } from '../components/ui.tsx';
import type { Form, Verb } from '../content/types.ts';
import { displayRoot, verbById, verbs } from '../lib/content.ts';
import { type Rating, review, strength } from '../lib/fsrs.ts';
import { type CheckResult, checkHebrew } from '../lib/hebrew.ts';
import { go } from '../lib/router.ts';
import { buildVerbSession, dueVerbCount, TENSES, type VerbTask } from '../lib/session.ts';
import { addMistake, getState, setState, todayLog, useAppState } from '../lib/store.ts';
import { speak } from '../lib/tts.ts';
import { SessionDone } from './session-words.tsx';

const BINYAN_LABEL: Record<string, string> = {
  paal: "Pa'al",
  piel: "Pi'el",
  hifil: "Hif'il",
  hitpael: "Hitpa'el",
  nifal: "Nif'al",
  pual: "Pu'al",
  hufal: "Huf'al",
};
const TENSE_HE: Record<string, string> = { present: 'הווה', past: 'עבר', future: 'עתיד', imp: 'ציווי' };

const PRESENT_ROWS: [string, string][] = [
  ['ms', 'אני/אתה/הוא'],
  ['fs', 'אני/את/היא'],
  ['mp', 'אנחנו/אתם/הם'],
  ['fp', 'אנחנו/אתן/הן'],
];
const PAST_ROWS: [string, string][] = [
  ['1s', 'אני'],
  ['2ms', 'אתה'],
  ['2fs', 'את'],
  ['3ms', 'הוא'],
  ['3fs', 'היא'],
  ['1p', 'אנחנו'],
  ['2mp', 'אתם'],
  ['2fp', 'אתן'],
  ['3p', 'הם/הן'],
];
const FUTURE_ROWS: [string, string][] = [
  ['1s', 'אני'],
  ['2ms', 'אתה'],
  ['2fs', 'את'],
  ['3ms', 'הוא'],
  ['3fs', 'היא'],
  ['1p', 'אנחנו'],
  ['2mp', 'אתם/אתן'],
  ['3p', 'הם/הן'],
];
const IMP_ROWS: [string, string][] = [
  ['ms', 'אתה'],
  ['fs', 'את'],
  ['mp', 'אתם/אתן'],
];

function FormTable({ rows, table, highlight }: { rows: [string, string][]; table: Record<string, Form>; highlight?: string }) {
  const showTr = getState().settings.showTr;
  return (
    <table class="grid">
      <tbody>
        {rows.map(([k, pr]) =>
          table[k] ? (
            <tr style={k === highlight ? { background: 'var(--accent-soft)' } : undefined}>
              <td class="he muted" style={{ width: '38%' }}>{pr}</td>
              <td class="he" style={{ fontSize: 20 }} onClick={() => speak(table[k][0])}>
                {table[k][0]}
              </td>
              {showTr && <td class="tr small">{table[k][1]}</td>}
            </tr>
          ) : null,
        )}
      </tbody>
    </table>
  );
}

export function VerbTables({ verb, only, highlight }: { verb: Verb; only?: string; highlight?: string }) {
  const sections: [string, [string, string][], Record<string, Form> | undefined][] = [
    ['present', PRESENT_ROWS, verb.present],
    ['past', PAST_ROWS, verb.past],
    ['future', FUTURE_ROWS, verb.future],
    ['imp', IMP_ROWS, verb.imp],
  ];
  return (
    <>
      {sections
        .filter(([t, , tab]) => tab && (!only || only === t))
        .map(([t, rows, tab]) => (
          <div class="mt">
            <div class="section-title" style={{ margin: '8px 0 0' }}>
              {t} · <span class="he">{TENSE_HE[t]}</span>
            </div>
            <FormTable rows={rows} table={tab!} highlight={only ? highlight : undefined} />
          </div>
        ))}
    </>
  );
}

export function VerbPage({ id }: { id: string }) {
  const verb = verbById.get(id);
  if (!verb) return <TopBar title="Verb not found" backTo={true} />;
  return (
    <>
      <TopBar title={verb.en} backTo={true} />
      <main class="page">
        <div class="card">
          <div class="row">
            <div class="he he-xl">{verb.inf}</div>
            <div class="spacer" />
            <SpeakBtn text={verb.inf} />
          </div>
          <div class="tr">{verb.tr}</div>
          <div class="mt">
            <strong>{verb.en}</strong>
          </div>
          <div class="chip-row mt">
            <span class="badge level">{verb.level}</span>
            <span class="badge">{BINYAN_LABEL[verb.binyan]}</span>
            <span class="badge">
              root <span class="he">{displayRoot(verb.root)}</span>
            </span>
            {verb.gizra && <span class="badge">{verb.gizra}</span>}
            {verb.gov && (
              <span class="badge warn">
                + <span class="he">{verb.gov}</span>
              </span>
            )}
          </div>
          {verb.note && <div class="card tight accent small">💡 {verb.note}</div>}
          <div class="mt">
            <HeText text={verb.ex.he} />
            <div class="en">{verb.ex.en}</div>
          </div>
          <div class="btn-row">
            <button class="btn primary" onClick={() => go(`session/verbs/${verb.id}`)}>
              Drill this verb
            </button>
            <button class="btn" onClick={() => go(`words/root/${verb.root}`)}>
              🌱 Root family
            </button>
          </div>
        </div>
        <div class="card">
          <VerbTables verb={verb} />
        </div>
      </main>
    </>
  );
}

export function VerbList() {
  const s = useAppState();
  const [binyan, setBinyan] = useState<string>('all');
  const list = verbs.filter((v) => binyan === 'all' || v.binyan === binyan);
  const due = dueVerbCount();
  return (
    <>
      <TopBar title="Verbs" backTo="practice" />
      <main class="page">
        <div class="card primary">
          <h3>Verb drill</h3>
          <p class="small">
            Type the right form: pronoun + verb + tense. {due ? `${due} verb-tenses are due.` : 'New verb-tenses are introduced gradually.'}
          </p>
          <button class="btn primary block" onClick={() => go('session/verbs')}>
            Start drill (12)
          </button>
        </div>
        <div class="chip-row">
          {['all', 'paal', 'piel', 'hifil', 'hitpael', 'nifal'].map((b) => (
            <button class={`chip ${binyan === b ? 'on' : ''}`} onClick={() => setBinyan(b)}>
              {b === 'all' ? 'All' : BINYAN_LABEL[b]}
            </button>
          ))}
        </div>
        <div class="list mt">
          {list.map((v) => {
            const known = TENSES.filter((t) => {
              const st = strength(s.cards[`c:${v.id}:${t}`]);
              return st === 'known' || st === 'mature';
            }).length;
            return (
              <Item
                title={
                  <>
                    <span class="he he-md">{v.inf}</span> <span class="muted">· {v.en}</span>
                  </>
                }
                sub={`${BINYAN_LABEL[v.binyan]}${v.gov ? ` · + ${v.gov}` : ''} · ${known}/3 tenses solid`}
                right={<LevelBadge level={v.level} />}
                onClick={() => go(`verb/${v.id}`)}
              />
            );
          })}
        </div>
      </main>
    </>
  );
}

const TENSE_EN: Record<string, string> = { present: 'present', past: 'past', future: 'future' };

export function VerbSession({ only }: { only?: string }) {
  const tasks = useMemo(() => buildVerbSession(only), [only]);
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [showTable, setShowTable] = useState(false);
  const verdicts = useMemo(() => new Map<string, Rating>(), []);
  const [right, setRight] = useState(0);

  if (!tasks.length) {
    return (
      <>
        <TopBar title="Verbs" backTo="practice" />
        <main class="page">
          <div class="card">No verbs available yet.</div>
        </main>
      </>
    );
  }
  if (idx >= tasks.length) return <SessionDone task="verbs" right={right} total={tasks.length} />;

  const t: VerbTask = tasks[idx];
  const isNewCard = !getState().cards[t.cardId];

  const check = () => {
    if (!value.trim()) return;
    const r = checkHebrew(value, [t.answer[0]]);
    setResult(r);
    if (r.verdict === 'latin') return;
    const g: Rating = r.verdict === 'correct' ? 3 : r.verdict === 'close' ? 2 : 1;
    if (g >= 3) setRight((n) => n + 1);
    else addMistake({ kind: 'verb', ref: `${t.verb.id}:${t.tense}:${t.person}`, prompt: `${t.pronoun} · ${t.verb.inf} · ${TENSE_HE[t.tense]}`, answer: t.answer[0], given: value });
    const prev = verdicts.get(t.cardId);
    verdicts.set(t.cardId, prev ? (Math.min(prev, g) as Rating) : g);
    if (r.verdict === 'correct') speak(`${t.pronoun} ${t.answer[0]}`);
  };

  const proceed = () => {
    // Rate the card once all of its prompts in this session are done.
    const remaining = tasks.slice(idx + 1).some((x) => x.cardId === t.cardId);
    if (!remaining && !only) {
      const g = verdicts.get(t.cardId) ?? 1;
      setState((s) => {
        s.cards[t.cardId] = review(s.cards[t.cardId], g, Date.now(), s.settings.retention);
        const log = todayLog(s);
        log.reviews++;
        if (g >= 3) log.correct++;
      });
    }
    setIdx(idx + 1);
    setValue('');
    setResult(null);
    setShowTable(false);
  };

  const done = result && result.verdict !== 'latin';

  return (
    <>
      <TopBar title="Verb drill" backTo="practice" right={<span class="small muted">{idx + 1}/{tasks.length}</span>} />
      <main class="page">
        <Progress value={idx / tasks.length} />
        <div class="card">
          <div class="row">
            <span class="badge">{BINYAN_LABEL[t.verb.binyan]}</span>
            {isNewCard && <span class="badge warn">new</span>}
            <div class="spacer" />
            <button class="btn small ghost" onClick={() => setShowTable(!showTable)}>
              {showTable ? 'Hide' : 'Peek'} table
            </button>
          </div>
          <div class="prompt-box">
            <div class="he he-lg">{t.verb.inf}</div>
            <div class="small muted">{t.verb.en}</div>
            <div class="big-en mt">
              {t.pronounEn} · {TENSE_EN[t.tense]}
            </div>
            <div class="he he-md muted">
              {t.pronoun} · {TENSE_HE[t.tense]}
            </div>
          </div>
          <AnswerInput
            value={value}
            onInput={setValue}
            onEnter={done ? proceed : check}
            autoFocus
            status={!result ? '' : result.verdict === 'correct' ? 'ok' : result.verdict === 'close' ? 'close' : result.verdict === 'latin' ? '' : 'bad'}
          />
          {result && <Feedback result={result} extra={done && <div class="tr mt">{t.answer[1]}</div>} />}
          <div class="btn-row">
            {!done ? (
              <>
                <button class="btn ghost" onClick={() => (setValue(value || '?'), setResult({ verdict: 'wrong', expected: t.answer[0] }), verdicts.set(t.cardId, 1))}>
                  Show me
                </button>
                <button class="btn primary" onClick={check} disabled={!value.trim()}>
                  Check
                </button>
              </>
            ) : (
              <button class="btn primary block" onClick={proceed}>
                Continue →
              </button>
            )}
          </div>
          {(showTable || (done && result?.verdict !== 'correct')) && (
            <VerbTables verb={t.verb} only={t.tense} highlight={t.person} />
          )}
        </div>
      </main>
    </>
  );
}

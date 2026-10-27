import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { AnswerInput, Feedback } from '../components/answer.tsx';
import { HeText } from '../components/hebrew.tsx';
import { Progress, SpeakBtn, TopBar } from '../components/ui.tsx';
import type { Form } from '../content/types.ts';
import { verbById } from '../lib/content.ts';
import { drillable } from '../lib/session.ts';
import { UNITS } from '../lib/course.ts';
import { deckById } from '../lib/decks.ts';
import { type Rating, review } from '../lib/fsrs.ts';
import { type CheckResult, checkHebrew } from '../lib/hebrew.ts';
import { go } from '../lib/router.ts';
import { record } from '../lib/skills.ts';
import { addMistake, getState, markDone, markTask, setState, todayLog } from '../lib/store.ts';
import { speak } from '../lib/tts.ts';
import {
  analyses,
  BINYAN_CHOICES,
  buildVerbSetTrainer,
  buildVerbTrainer,
  personChoices,
  PRODUCTION,
  tableOf,
  TENSE_CHOICES,
  type TenseKey,
  type VKind,
  VKINDS,
  verbsByIds,
  verbsOfDeck,
  type VTask,
} from '../lib/verbdrill.ts';
import { renderPrompt } from './grammar.tsx';
import { SessionDone } from './session-words.tsx';
import { BINYAN_LABEL, TENSE_HE, VerbTables } from './verbs.tsx';

export type VerbMode = { type: 'daily' } | { type: 'kind'; kind: VKind } | { type: 'verb'; id: string } | { type: 'unit'; n: number } | { type: 'deck'; id: string };

const TENSE_EN: Record<string, string> = { present: 'present', past: 'past', future: 'future', imp: 'command' };

function buildFor(mode: VerbMode): VTask[] {
  switch (mode.type) {
    case 'daily':
      return buildVerbTrainer();
    case 'kind':
      return buildVerbTrainer([mode.kind]);
    case 'verb':
      return buildVerbSetTrainer(verbsByIds([mode.id]), 12);
    case 'unit':
      return buildVerbSetTrainer(verbsByIds(UNITS[mode.n]?.verbs ?? []), 12);
    case 'deck':
      return buildVerbSetTrainer(verbsOfDeck(deckById(mode.id)?.cards() ?? []), 15);
  }
}

function doneIdFor(mode: VerbMode): string | undefined {
  if (mode.type === 'unit') return UNITS[mode.n] && `unit:${UNITS[mode.n].id}:verbs`;
  if (mode.type === 'kind') return `vkind:${mode.kind}`;
  if (mode.type === 'deck') return `deck:${mode.id}`;
  return undefined;
}

/** Only the scheduled sessions move the verb-tense schedule; practice sets don't. */
const schedules = (mode: VerbMode) => mode.type === 'daily' || mode.type === 'kind';

export function VerbSession({ mode }: { mode: VerbMode }) {
  const tasks = useMemo(() => buildFor(mode), [JSON.stringify(mode)]);
  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState<boolean | null>(null); // null = not yet, else correct?
  const [showTable, setShowTable] = useState(false);
  const verdicts = useMemo(() => new Map<string, Rating>(), []);
  const [right, setRight] = useState(0);
  const back = mode.type === 'deck' ? `deck/${mode.id}` : mode.type === 'verb' ? `verb/${mode.id}` : 'verbs';

  if (!tasks.length) {
    return (
      <>
        <TopBar title="Verbs" backTo={back} />
        <main class="page">
          <div class="card">No verbs to practise here yet.</div>
        </main>
      </>
    );
  }
  if (idx >= tasks.length) {
    const doneId = doneIdFor(mode);
    return <SessionDone task={doneId ?? 'verbs'} right={right} total={tasks.length} doneId={doneId} />;
  }

  const t = tasks[idx];

  // g: 3 right, 2 nearly, 1 wrong
  const finish = (g: Rating, given: string) => {
    setAnswered(g >= 2);
    const topics = [`binyan:${t.verb.binyan}`, `tense:${t.tense}`];
    record('verbs', g >= 3 ? 1 : g === 2 ? 0.6 : 0, topics, PRODUCTION.includes(t.kind) ? 1 : 0.5);
    if (t.kind === 'listen') record('listening', g >= 3 ? 1 : 0, [], 0.3);
    if (g >= 3) setRight((n) => n + 1);
    else
      addMistake({
        kind: 'verb',
        ref: `${t.verb.id}:${t.tense}:${t.person}`,
        prompt: `${t.pronoun} (${t.pronounEn}) · ${t.verb.inf} · ${TENSE_HE[t.tense]}`,
        answer: t.answer[0],
        given,
      });
    if (PRODUCTION.includes(t.kind)) {
      const prev = verdicts.get(t.cardId);
      verdicts.set(t.cardId, prev ? (Math.min(prev, g) as Rating) : g);
    }
  };

  const proceed = () => {
    const remaining = tasks.slice(idx + 1).some((x) => x.cardId === t.cardId && PRODUCTION.includes(x.kind));
    const g = verdicts.get(t.cardId);
    if (schedules(mode) && g && !remaining) {
      verdicts.delete(t.cardId); // a card is reviewed at most once per session
      setState((s) => {
        s.cards[t.cardId] = review(s.cards[t.cardId], g, Date.now(), s.settings.retention);
        const log = todayLog(s);
        log.reviews++;
        if (g >= 3) log.correct++;
      });
    }
    setIdx(idx + 1);
    setAnswered(null);
    setShowTable(false);
  };

  const kindInfo = VKINDS.find((k) => k.id === t.kind)!;
  const isNewCard = !getState().cards[t.cardId];

  return (
    <>
      <TopBar title={mode.type === 'kind' ? kindInfo.label : 'Verb practice'} backTo={back} right={<span class="small muted">{idx + 1}/{tasks.length}</span>} />
      <main class="page">
        <Progress value={idx / tasks.length} />
        <div class="card">
          <div class="row">
            <span class="badge">
              {kindInfo.emoji} {kindInfo.label}
            </span>
            {isNewCard && PRODUCTION.includes(t.kind) && <span class="badge warn">new</span>}
            <div class="spacer" />
            <button class="btn small ghost" onClick={() => setShowTable(!showTable)}>
              {showTable ? 'Hide' : 'Peek'} table
            </button>
          </div>
          {t.kind === 'identify' || t.kind === 'binyan' ? (
            <TaskBody key={idx} t={t} onAnswer={finish} />
          ) : (
            // One input stays mounted from task to task so the iPhone keyboard stays open.
            <TypedTask idx={idx} t={t} onAnswer={finish} onContinue={proceed} />
          )}
          {answered !== null && (
            <div class="btn-row">
              <button class="btn primary block" onClick={proceed}>
                Continue →
              </button>
            </div>
          )}
          {(showTable || answered === false) && <VerbTables verb={t.verb} only={t.tense} highlight={t.person} />}
        </div>
        {t.verb.note && answered !== null && <div class="card tight accent small">💡 {t.verb.note}</div>}
      </main>
    </>
  );
}

function TaskBody({ t, onAnswer }: { t: VTask; onAnswer: (g: Rating, given: string) => void }) {
  return t.kind === 'identify' ? <IdentifyTask t={t} onAnswer={onAnswer} /> : <BinyanTask t={t} onAnswer={onAnswer} />;
}

/** conjugate, context, listen and infinitive: type a Hebrew answer. Return checks, then continues. */
function TypedTask({ idx, t, onAnswer, onContinue }: { idx: number; t: VTask; onAnswer: (g: Rating, given: string) => void; onContinue: () => void }) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  useLayoutEffect(() => {
    setValue('');
    setResult(null);
  }, [idx]);
  const done = !!result && result.verdict !== 'latin';
  const spoken = `${t.pronoun} ${t.answer[0]}`;
  const accepted =
    t.kind === 'infinitive'
      ? [t.verb.inf]
      : t.kind === 'listen'
        ? [t.answer[0], `${t.pronoun} ${t.answer[0]}`]
        : t.kind === 'context' && t.sentence
          ? [t.sentence.form]
          : [t.answer[0]];

  const check = (given = value) => {
    if (!given.trim()) return;
    const r = checkHebrew(given, accepted, { strict: true });
    setResult(r);
    if (r.verdict === 'latin') return;
    onAnswer(r.verdict === 'correct' ? 3 : r.verdict === 'close' ? 2 : 1, given);
    if (r.verdict === 'correct') speak(t.kind === 'infinitive' ? t.verb.inf : t.kind === 'context' ? t.sentence!.he : spoken);
  };

  let prompt;
  if (t.kind === 'context' && t.sentence) {
    const s = t.sentence;
    prompt = (
      <div class="prompt-box">
        {renderPrompt(s.gap, done ? s.form : undefined)}
        <div class="small muted mt">{s.en}</div>
        <div class="hint">
          <span class="he">{t.verb.inf}</span> · {TENSE_EN[t.tense]}
        </div>
      </div>
    );
  } else if (t.kind === 'listen') {
    prompt = (
      <div class="prompt-box">
        <SpeakBtn text={spoken} label="Play" />
        <div class="small muted mt">Type the verb form you hear (with or without the pronoun).</div>
        {done && (
          <div class="he he-md mt">
            {t.pronoun} {t.answer[0]} <span class="muted small">· {t.verb.inf}</span>
          </div>
        )}
      </div>
    );
  } else if (t.kind === 'infinitive') {
    prompt = (
      <div class="prompt-box">
        <div class="he he-lg">{t.answer[0]}</div>
        <div class="small muted">{t.verb.en}</div>
        <div class="big-en mt">Infinitive?</div>
        <div class="hint">Type the ל… form this comes from</div>
      </div>
    );
  } else {
    prompt = (
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
    );
  }

  return (
    <>
      {prompt}
      <AnswerInput
        value={value}
        onInput={(v) => !done && setValue(v)}
        onEnter={() => (done ? onContinue() : check())}
        autoFocus
        status={!result ? '' : result.verdict === 'correct' ? 'ok' : result.verdict === 'close' ? 'close' : result.verdict === 'latin' ? '' : 'bad'}
      />
      {result && <Feedback result={result} extra={done && t.kind !== 'infinitive' && <div class="tr mt">{t.answer[1]}</div>} />}
      {!done && (
        <div class="btn-row">
          <button
            class="btn ghost"
            onClick={() => {
              setValue(value || '?');
              setResult({ verdict: 'wrong', expected: accepted[0] });
              onAnswer(1, value || '?');
            }}
          >
            Show me
          </button>
          <button class="btn primary" onClick={() => check()} disabled={!value.trim()}>
            Check
          </button>
        </div>
      )}
    </>
  );
}

function FormShown({ t }: { t: VTask }) {
  const f = t.shown ?? t.answer;
  return (
    <div class="prompt-box">
      <div class="row" style={{ justifyContent: 'center' }}>
        <div class="he he-xl">{f[0]}</div>
        <SpeakBtn text={f[0]} small />
      </div>
      <div class="small muted">{t.verb.en}</div>
    </div>
  );
}

function IdentifyTask({ t, onAnswer }: { t: VTask; onAnswer: (g: Rating, given: string) => void }) {
  const [tense, setTense] = useState<TenseKey | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const valid = analyses(t.verb, (t.shown ?? t.answer)[0]);
  const ok = !!tense && !!person && valid.some((a) => a.tense === tense && a.person === person);
  const choose = (p: string) => {
    if (person) return;
    setPerson(p);
    const right = valid.some((a) => a.tense === tense && a.person === p);
    const tenseRight = valid.some((a) => a.tense === tense);
    onAnswer(right ? 3 : tenseRight ? 2 : 1, `${tense}:${p}`);
  };
  const label = (a: { tense: TenseKey; person: string }) =>
    `${TENSE_EN[a.tense]} · ${personChoices(a.tense).find(([k]) => k === a.person)?.[1] ?? a.person}`;
  return (
    <>
      <FormShown t={t} />
      <div class="small muted">1. Which tense?</div>
      <div class="choice-grid mt">
        {TENSE_CHOICES.filter(([k]) => tableOf(t.verb, k)).map(([k, en, he]) => (
          <button
            class={`btn choice ${tense === k ? (person ? (valid.some((a) => a.tense === k) ? 'right' : 'wrong') : 'on') : ''}`}
            disabled={!!person}
            onClick={() => setTense(k)}
          >
            {en} · <span class="he">{he}</span>
          </button>
        ))}
      </div>
      {tense && (
        <>
          <div class="small muted mt">2. Who?</div>
          <div class="choice-grid mt">
            {personChoices(tense).map(([k, he, en]) => (
              <button
                class={`btn choice ${person === k ? (ok ? 'right' : 'wrong') : person && valid.some((a) => a.tense === tense && a.person === k) ? 'right' : ''}`}
                disabled={!!person}
                onClick={() => choose(k)}
              >
                <span class="he">{he}</span>
                <div class="small muted">{en}</div>
              </button>
            ))}
          </div>
        </>
      )}
      {person && (
        <div class={`feedback ${ok ? 'ok' : 'bad'}`}>
          <strong>{ok ? 'Right!' : 'Not quite.'}</strong> <span class="he">{(t.shown ?? t.answer)[0]}</span> ={' '}
          {valid.map(label).join(', or ')} of <span class="he">{t.verb.inf}</span>
          {valid.length > 1 && <div class="small mt">Several persons share this spelling; any of them counts.</div>}
        </div>
      )}
    </>
  );
}

function BinyanTask({ t, onAnswer }: { t: VTask; onAnswer: (g: Rating, given: string) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const ok = pick === t.verb.binyan;
  return (
    <>
      <FormShown t={t} />
      <div class="small muted">Which binyan is this verb in?</div>
      <div class="choice-grid one mt">
        {BINYAN_CHOICES.map(([b, en, pattern]) => (
          <button
            class={`btn choice ${pick === b ? (ok ? 'right' : 'wrong') : pick && b === t.verb.binyan ? 'right' : ''}`}
            disabled={!!pick}
            onClick={() => {
              setPick(b);
              onAnswer(b === t.verb.binyan ? 3 : 1, b);
            }}
          >
            {en} <span class="he muted small">· {pattern}</span>
          </button>
        ))}
      </div>
      {pick && (
        <div class={`feedback ${ok ? 'ok' : 'bad'}`}>
          <span class="he">{(t.shown ?? t.answer)[0]}</span> comes from <span class="he">{t.verb.inf}</span>: {BINYAN_LABEL[t.verb.binyan]}
          {t.verb.gizra ? `, ${t.verb.gizra}` : ''}.
        </div>
      )}
    </>
  );
}

// ---------- Table challenge: fill in a whole tense ----------

const ROW_PRONOUNS: Record<TenseKey, [string, string][]> = {
  present: [
    ['ms', 'אני/אתה/הוא'],
    ['fs', 'אני/את/היא'],
    ['mp', 'אנחנו/אתם/הם'],
    ['fp', 'אנחנו/אתן/הן'],
  ],
  past: [
    ['1s', 'אני'],
    ['2ms', 'אתה'],
    ['2fs', 'את'],
    ['3ms', 'הוא'],
    ['3fs', 'היא'],
    ['1p', 'אנחנו'],
    ['2mp', 'אתם'],
    ['2fp', 'אתן'],
    ['3p', 'הם/הן'],
  ],
  future: [
    ['1s', 'אני'],
    ['2ms', 'אתה'],
    ['2fs', 'את'],
    ['3ms', 'הוא'],
    ['3fs', 'היא'],
    ['1p', 'אנחנו'],
    ['2mp', 'אתם/אתן'],
    ['3p', 'הם/הן'],
  ],
  imp: [
    ['ms', 'אתה'],
    ['fs', 'את'],
    ['mp', 'אתם/אתן'],
  ],
};

export function TableChallenge({ id, tense }: { id: string; tense: TenseKey }) {
  const verb = verbById.get(id);
  const table = verb && (tableOf(verb, tense) as Record<string, Form> | undefined);
  const rows = ROW_PRONOUNS[tense]?.filter(([k]) => table?.[k]) ?? [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, CheckResult> | null>(null);
  const rated = useRef(false); // retries after seeing the corrections don't count
  if (!verb || !table) return <TopBar title="Not found" backTo="verbs" />;

  const check = () => {
    const res: Record<string, CheckResult> = {};
    let score = 0;
    for (const [k] of rows) {
      const r = checkHebrew(values[k] ?? '', [table[k][0]], { strict: true });
      res[k] = r;
      score += r.verdict === 'correct' ? 1 : r.verdict === 'close' ? 0.5 : 0;
      if (r.verdict !== 'correct' && !rated.current)
        addMistake({ kind: 'verb', ref: `${verb.id}:${tense}:${k}`, prompt: `${verb.inf} · ${TENSE_HE[tense]}`, answer: table[k][0], given: values[k] ?? '' });
    }
    setResults(res);
    if (rated.current) return;
    rated.current = true;
    const acc = score / rows.length;
    record('verbs', acc, [`binyan:${verb.binyan}`, `tense:${tense}`], 2);
    if (tense !== 'imp' && drillable(verb, tense)) {
      const g: Rating = acc >= 0.9 ? 3 : acc >= 0.6 ? 2 : 1;
      setState((s) => {
        const key = `c:${verb.id}:${tense}`;
        s.cards[key] = review(s.cards[key], g, Date.now(), s.settings.retention);
        todayLog(s).reviews++;
      });
    }
    markDone(`vtable:${verb.id}:${tense}`, acc);
    markTask('vtable');
  };

  const score = results ? Object.values(results).filter((r) => r.verdict === 'correct').length : 0;

  return (
    <>
      <TopBar title="Table challenge" backTo={`verb/${verb.id}`} />
      <main class="page">
        <div class="card">
          <div class="row">
            <div class="he he-lg">{verb.inf}</div>
            <div class="spacer" />
            <span class="badge">{BINYAN_LABEL[verb.binyan]}</span>
          </div>
          <div class="small muted">
            {verb.en} · fill in the whole {TENSE_EN[tense]} tense (<span class="he">{TENSE_HE[tense]}</span>)
          </div>
          <table class="grid mt">
            <tbody>
              {rows.map(([k, pr]) => {
                const r = results?.[k];
                return (
                  <tr>
                    <td class="he muted" style={{ width: '34%' }}>
                      {pr}
                    </td>
                    <td>
                      <AnswerInput
                        value={values[k] ?? ''}
                        onInput={(v) => setValues({ ...values, [k]: v })}
                        disabled={!!results}
                        status={!r ? '' : r.verdict === 'correct' ? 'ok' : r.verdict === 'close' ? 'close' : 'bad'}
                      />
                      {r && r.verdict !== 'correct' && (
                        <div class="small">
                          <span class="he">{table[k][0]}</span> <span class="tr">{table[k][1]}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!results ? (
            <div class="btn-row">
              <button class="btn primary block" onClick={check} disabled={!Object.values(values).some((v) => v.trim())}>
                Check the table
              </button>
            </div>
          ) : (
            <>
              <div class={`feedback ${score === rows.length ? 'ok' : score >= rows.length * 0.6 ? 'close' : 'bad'}`}>
                <strong>
                  {score} / {rows.length} forms right
                </strong>
                {score === rows.length ? ' — the whole table! 🎉' : ' — the corrections are under each box.'}
              </div>
              <div class="btn-row">
                <button class="btn" onClick={() => (setValues({}), setResults(null))}>
                  Try again
                </button>
                <button class="btn primary" onClick={() => go(`verb/${verb.id}`)}>
                  Back to the verb
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}

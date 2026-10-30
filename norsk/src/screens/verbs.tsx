import { useMemo, useState } from 'preact/hooks';
import { AnswerInput, Feedback } from '../components/answer.tsx';
import { NoText } from '../components/text.tsx';
import { Item, Progress, Seg, SpeakBtn, TopBar, useEnterKey } from '../components/ui.tsx';
import type { Word } from '../content/types.ts';
import { verbs, wordById } from '../lib/content.ts';
import { type CheckResult, checkAnswer, fold, splitAlt } from '../lib/norsk.ts';
import { go } from '../lib/router.ts';
import { rateCard } from '../lib/srs.ts';
import { addMistake, clearMistake, getState, markDone, useAppState } from '../lib/store.ts';
import { speak } from '../lib/tts.ts';

export const VG_LABEL: Record<string, string> = {
  '1': 'regelmäßig, Klasse 1 (-et)',
  '2': 'regelmäßig, Klasse 2 (-te)',
  '3': 'regelmäßig, Klasse 3 (-de)',
  '4': 'regelmäßig, Klasse 4 (-dde)',
  sterk: 'stark (unregelmäßig)',
  uregelm: 'unregelmäßig',
  modal: 'Modalverb',
};

const irregular = (v: Word) => v.vg === 'sterk' || v.vg === 'uregelm' || v.vg === 'modal';
const forms = (v: Word) => v.vf ?? ['', '', '', ''];
/** "går – gikk – har gått" */
const principal = (v: Word) => {
  const [pres, pret, perf] = forms(v).map((f) => f.split('/')[0]);
  return [pres, pret, perf && `har ${perf}`].filter(Boolean).join(' – ');
};

export function VerbList() {
  const s = useAppState();
  const [filter, setFilter] = useState<'mine' | 'irregular' | 'all'>('mine');
  const [q, setQ] = useState('');
  let list = verbs.filter((v) => (filter === 'mine' ? v.lesson <= s.lesson : filter === 'irregular' ? irregular(v) : true));
  if (q.trim()) {
    const f = fold(q);
    list = verbs.filter((v) => fold(v.no).includes(f) || forms(v).some((x) => fold(x).includes(f)) || v.de.toLowerCase().includes(q.toLowerCase()));
  }
  if (filter === 'irregular' && !q.trim()) list = [...list].sort((a, b) => a.no.localeCompare(b.no, 'nb'));
  return (
    <>
      <TopBar title="Verben" />
      <main class="page">
        <button class="btn primary block" onClick={() => go('verben/training')}>
          🔁 Verben trainieren
        </button>
        <input class="search mt" type="search" placeholder="Verb suchen – auch »gikk« oder »gehen«" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <div class="mt">
          <Seg
            value={filter}
            options={[
              { v: 'mine', label: `Bis Lektion ${s.lesson}` },
              { v: 'irregular', label: 'Unregelmäßige' },
              { v: 'all', label: 'Alle' },
            ]}
            onChange={setFilter}
          />
        </div>
        <div class="small muted mt">{list.length} Verben</div>
        <div class="list mt">
          {list.map((v) => (
            <Item title={<span class="no">å {v.no}</span>} sub={`${principal(v)} · ${v.de}`} right={<span class="badge">L{v.lesson}</span>} onClick={() => go(`verb/${v.id}`)} />
          ))}
        </div>
      </main>
    </>
  );
}

export function VerbPage({ id }: { id: string }) {
  const v = wordById.get(id);
  if (!v || !v.vf) return <TopBar title="Nicht gefunden" backTo="verben" />;
  const [pres, pret, perf, imp] = v.vf;
  const rows: [string, string][] = [
    ['Infinitiv', `å ${v.no}`],
    ['Präsens', pres],
    ['Präteritum', pret],
    ['Perfekt', perf ? `har ${perf}` : ''],
    ['Plusquamperfekt', perf ? `hadde ${perf}` : ''],
    ['Imperativ', imp ? `${imp}!` : ''],
  ];
  return (
    <>
      <TopBar title={`å ${v.no}`} backTo={true} />
      <main class="page">
        <div class="card">
          <div class="row wrap">
            <div class="no no-xl">å {v.no}</div>
            <SpeakBtn text={`å ${v.no}`} small />
          </div>
          <div class="big-de">{v.de}</div>
          <div class="mt">
            <span class="badge">{VG_LABEL[v.vg ?? '1']}</span> <span class="badge">Lektion {v.lesson}</span>
          </div>
        </div>
        <div class="card">
          <table class="grid verb-table">
            <tbody>
              {rows
                .filter(([, f]) => f)
                .map(([label, f]) => (
                  <tr>
                    <th>{label}</th>
                    <td>
                      <button class="linklike no no-md" onClick={() => speak(f.split('/')[0].replace(/!$/, ''))}>
                        {f.replace(/\//g, ' / ')}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p class="small muted">Im Norwegischen ist die Form für alle Personen gleich: jeg/du/hun/vi/de {pres.split('/')[0]}.</p>
        </div>
        {v.ex && (
          <div class="card">
            <div class="row">
              <NoText text={v.ex.no} />
              <SpeakBtn text={v.ex.no} small />
            </div>
            <div class="de">{v.ex.de}</div>
          </div>
        )}
        {v.note && <div class="card small">💡 {v.note}</div>}
        <button class="btn block" onClick={() => go(`verben/training/${v.lesson}`)}>
          🔁 Verben aus Lektion {v.lesson} trainieren
        </button>
      </main>
    </>
  );
}

type Tense = 0 | 1 | 2 | 3;
const TENSE_LABEL = ['Präsens', 'Präteritum', 'Perfekt', 'Imperativ'];

interface Task {
  verb: Word;
  tense: Tense;
}

const shuffle = <T,>(xs: T[]): T[] => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

/** Tenses the learner has met by this lesson. */
function tensesFor(lesson: number): Tense[] {
  const t: Tense[] = [0];
  if (lesson >= 4) t.push(3);
  if (lesson >= 6) t.push(1);
  if (lesson >= 7) t.push(2);
  return t;
}

function buildTasks(lesson: number | undefined, onlyIrregular: boolean): Task[] {
  const s = getState();
  const upTo = Math.max(s.lesson, lesson ?? 0);
  let pool = verbs.filter((v) => (lesson ? v.lesson === lesson : v.lesson <= s.lesson));
  if (onlyIrregular) pool = pool.filter(irregular);
  if (!pool.length) pool = verbs.filter((v) => v.lesson <= Math.max(1, upTo));
  const now = Date.now();
  const due = pool.filter((v) => s.cards[`v:${v.id}`] && s.cards[`v:${v.id}`].due <= now);
  const unseen = pool.filter((v) => !s.cards[`v:${v.id}`]);
  // Due verbs first, then unseen ones, irregular verbs twice as likely.
  const weighted = shuffle([...unseen, ...unseen.filter(irregular)]);
  const picked = [...new Set([...shuffle(due), ...weighted, ...shuffle(pool)])].slice(0, 12);
  const tenses = tensesFor(upTo);
  return picked.map((verb) => {
    const usable = tenses.filter((t) => forms(verb)[t]);
    // Past forms are what is hard: prefer them when available.
    const pref = usable.filter((t) => t === 1 || t === 2);
    const pool2 = pref.length && Math.random() < 0.75 ? pref : usable;
    return { verb, tense: pool2[Math.floor(Math.random() * pool2.length)] ?? 0 };
  });
}

function accepted(v: Word, t: Tense): string[] {
  const out = new Set(splitAlt(forms(v)[t]));
  if (t === 1 && v.vg === '1') [...out].forEach((x) => x.endsWith('et') && out.add(x.slice(0, -2) + 'a'));
  if (t === 2) [...out].forEach((x) => out.add(`har ${x}`));
  if (t === 3) [...out].forEach((x) => out.add(`${x}!`));
  return [...out];
}

export function VerbTrainer({ lesson }: { lesson?: number }) {
  const s = useAppState();
  const [onlyIrregular, setOnlyIrregular] = useState(false);
  const [round, setRound] = useState(0);
  const tasks = useMemo(() => buildTasks(lesson, onlyIrregular), [lesson, onlyIrregular, round]);
  const [i, setI] = useState(0);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [right, setRight] = useState(0);
  const exitTo = lesson ? `lektion/${lesson}` : 'verben';
  useEnterKey(() => next(), !!result);

  if (!tasks.length) {
    return (
      <>
        <TopBar title="Verben trainieren" backTo={exitTo} />
        <main class="page">
          <div class="card">Noch keine Verben in diesen Lektionen.</div>
        </main>
      </>
    );
  }

  if (i >= tasks.length) {
    return (
      <>
        <TopBar title="Verben trainieren" backTo={exitTo} />
        <main class="page">
          <div class="card center">
            <div class="hero">🔁</div>
            <h2>
              {right} von {tasks.length} richtig
            </h2>
            <div class="btn-row">
              <button class="btn" onClick={() => go(exitTo)}>
                Fertig
              </button>
              <button class="btn primary" onClick={() => (setRound(round + 1), setI(0), setRight(0), setValue(''), setResult(null))}>
                Noch eine Runde
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  const task = tasks[i];
  const v = task.verb;
  const check = () => {
    if (!value.trim() || result) return;
    const r = checkAnswer(value, accepted(v, task.tense), { strict: true });
    setResult(r);
    const ok = r.verdict !== 'wrong';
    rateCard(`v:${v.id}`, ok ? 3 : 1);
    if (ok) {
      setRight((x) => x + 1);
      clearMistake('verb', `${v.id}#${task.tense}`);
      speak(r.expected);
    } else addMistake({ kind: 'verb', ref: `${v.id}#${task.tense}`, prompt: `${TENSE_LABEL[task.tense]} von å ${v.no}`, answer: forms(v)[task.tense].split('/')[0], given: value });
    if (lesson && i === tasks.length - 1) markDone(`L${lesson}:verbs`, 1);
  };
  function next() {
    setI(i + 1);
    setValue('');
    setResult(null);
  }

  return (
    <>
      <TopBar title={lesson ? `Verben · Lektion ${lesson}` : 'Verben trainieren'} backTo={exitTo} right={<span class="small muted">{i + 1}/{tasks.length}</span>} />
      <main class="page">
        <Progress value={i / tasks.length} />
        {i === 0 && !result && (
          <div class="row mt">
            <label class="small row">
              <input type="checkbox" checked={onlyIrregular} onChange={(e) => (setOnlyIrregular((e.target as HTMLInputElement).checked), setI(0))} /> nur unregelmäßige Verben
            </label>
          </div>
        )}
        <div class="card flash">
          <div class="prompt-box">
            <div class="no no-xl">å {v.no}</div>
            <div class="muted">{v.de}</div>
            <div class="tense-label mt">{TENSE_LABEL[task.tense]}</div>
            <div class="hint">
              {task.tense === 2 ? 'Partizip (har …)' : task.tense === 3 ? 'Befehlsform' : task.tense === 1 ? 'i går …' : 'jeg …'}
            </div>
          </div>
          <AnswerInput value={value} onInput={setValue} onEnter={result ? next : check} autoFocus disabled={!!result} status={!result ? '' : result.verdict === 'correct' ? 'ok' : result.verdict === 'close' ? 'close' : 'bad'} />
          {result && (
            <Feedback
              result={result}
              extra={
                <div class="small mt explain">
                  å {v.no} – {principal(v)} · {VG_LABEL[v.vg ?? '1']}
                </div>
              }
            />
          )}
          <div class="btn-row">
            {!result ? (
              <button class="btn primary" onClick={check} disabled={!value.trim()}>
                Prüfen
              </button>
            ) : (
              <button class="btn primary" onClick={next}>
                Weiter
              </button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

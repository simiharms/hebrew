import { useState } from 'preact/hooks';
import { HeText } from '../components/hebrew.tsx';
import { Item, LevelBadge, SpeakBtn, TopBar } from '../components/ui.tsx';
import type { Form, Verb } from '../content/types.ts';
import { WORD_LEVELS } from '../content/types.ts';
import { displayRoot, verbById, verbs } from '../lib/content.ts';
import { allDecks } from '../lib/decks.ts';
import { strength } from '../lib/fsrs.ts';
import { go } from '../lib/router.ts';
import { drillable, dueVerbCount, TENSES } from '../lib/session.ts';
import { getState, setState, useAppState } from '../lib/store.ts';
import { speak } from '../lib/tts.ts';
import { VKINDS } from '../lib/verbdrill.ts';

export const BINYAN_LABEL: Record<string, string> = {
  paal: "Pa'al",
  piel: "Pi'el",
  hifil: "Hif'il",
  hitpael: "Hitpa'el",
  nifal: "Nif'al",
  pual: "Pu'al",
  hufal: "Huf'al",
};
export const TENSE_HE: Record<string, string> = { present: 'הווה', past: 'עבר', future: 'עתיד', imp: 'ציווי' };

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
              {verb.rare?.includes(t as 'past') && <span class="badge warn">rarely used</span>}
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
          {verb.exs?.map((e) => (
            <div class="mt">
              <HeText text={e.he} />
              <div class="en">{e.en}</div>
            </div>
          ))}
          <div class="btn-row">
            <button class="btn primary" onClick={() => go(`session/verbs/${verb.id}`)}>
              Drill this verb
            </button>
            <button class="btn" onClick={() => go(`words/root/${verb.root}`)}>
              🌱 Root family
            </button>
          </div>
          <div class="small muted mt">Table challenge: fill in a whole tense</div>
          <div class="chip-row">
            {(['present', 'past', 'future', 'imp'] as const)
              .filter((t) => drillable(verb, t))
              .map((t) => (
                <button class="chip" onClick={() => go(`verbs/table/${verb.id}/${t}`)}>
                  {t === 'imp' ? 'command' : t} · <span class="he">{TENSE_HE[t]}</span>
                </button>
              ))}
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
  const [level, setLevel] = useState<string>('all');
  const list = verbs.filter((v) => (binyan === 'all' || v.binyan === binyan) && (level === 'all' || v.level === level));
  const due = dueVerbCount();
  const verbDecks = allDecks().filter((d) => d.kind === 'verbs');
  return (
    <>
      <TopBar title="Verbs" backTo="practice" />
      <main class="page">
        <div class="card primary">
          <h3>Verb practice</h3>
          <p class="small">
            A mix of conjugating, using verbs in sentences, recognising forms and listening.{' '}
            {due ? `${due} verb-tenses are due.` : 'New verb-tenses are introduced gradually.'}
          </p>
          <button class="btn primary block" onClick={() => go('session/verbs')}>
            Start (12)
          </button>
        </div>
        <div class="card">
          <label class="row" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={s.settings.verbsOnly}
              onChange={(e) => setState((x) => void (x.settings.verbsOnly = (e.target as HTMLInputElement).checked))}
            />
            <span class="grow">
              <strong>🎯 Verbs-only mode</strong>
              <div class="small muted">Today's plan becomes all verbs: reviews, new verbs, sentences, recognition, listening and table challenges.</div>
            </span>
          </label>
        </div>
        <div class="section-title">Practise one skill</div>
        <div class="list">
          {VKINDS.map((k) => (
            <Item emoji={k.emoji} title={k.label} sub={k.sub} onClick={() => go(`session/vkind/${k.id}`)} />
          ))}
        </div>
        <div class="section-title">Verb card decks</div>
        <div class="list">
          {verbDecks.map((d) => (
            <Item emoji="🃏" title={d.title} sub={d.sub} onClick={() => go(`deck/${d.id}`)} />
          ))}
        </div>
        <div class="section-title">All {verbs.length} verbs · conjugation tables</div>
        <div class="chip-row">
          {['all', 'paal', 'piel', 'hifil', 'hitpael', 'nifal'].map((b) => (
            <button class={`chip ${binyan === b ? 'on' : ''}`} onClick={() => setBinyan(b)}>
              {b === 'all' ? 'All' : BINYAN_LABEL[b]}
            </button>
          ))}
        </div>
        <div class="chip-row">
          {['all', ...WORD_LEVELS].map((l) => (
            <button class={`chip ${level === l ? 'on' : ''}`} onClick={() => setLevel(l)}>
              {l === 'all' ? 'All levels' : l}
            </button>
          ))}
        </div>
        <div class="list mt">
          {list.map((v) => {
            const tenses = TENSES.filter((t) => drillable(v, t));
            const known = tenses.filter((t) => {
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
                sub={`${BINYAN_LABEL[v.binyan]}${v.gov ? ` · + ${v.gov}` : ''} · ${known}/${tenses.length} tenses solid`}
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

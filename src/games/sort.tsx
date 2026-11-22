// Time Machine (מכונת זמן): a form flies in; send it to its tense lane. Lanes
// run right to left like Hebrew time: עבר | הווה | עתיד | ציווי. A form that
// lives in two tables (נכנס: present and past) is right in either lane.
import './sort.css';
import { useState } from 'preact/hooks';
import type { Verb } from '../content/types.ts';
import { verbById } from '../lib/content.ts';
import { lenient } from '../lib/hebrew.ts';
import { type AppState, getState } from '../lib/store.ts';
import { analyses, tableOf, type TenseKey } from '../lib/verbdrill.ts';
import { allowedTenses, type Evidence, type GameProps, pickVerbTenses, pronounsFor, say, shuffle, TENSE_LABEL } from './kit.ts';
import { type Choice, ChoiceGrid, GameShell, useRound } from './kit-ui.tsx';

export interface SortItem {
  key: string;
  verbId: string;
  form: string;
  en: string;
  shownTense: TenseKey; // the table the form was taken from
  tenses: TenseKey[]; // every table it is in (analyses); a lane is right if it is here
}

/** Lanes in reading order, right to left. */
export const LANE_ORDER: TenseKey[] = ['past', 'present', 'future', 'imp'];

export function sortLanes(s: AppState): TenseKey[] {
  const allowed = allowedTenses(s);
  return LANE_ORDER.filter((t) => allowed.includes(t));
}

export function sortCorrect(it: SortItem, lane: TenseKey): boolean {
  return it.tenses.includes(lane);
}

/**
 * Shuffles so that no key appears three times in a row, unless one key holds
 * so many items that it can't be helped.
 */
export function spread<T>(xs: T[], key: (x: T) => string, rnd: () => number = Math.random): T[] {
  const pool = shuffle(xs, rnd);
  const out: T[] = [];
  while (pool.length) {
    const left = new Map<string, number>();
    for (const x of pool) left.set(key(x), (left.get(key(x)) ?? 0) + 1);
    const n = out.length;
    const ban = n >= 2 && key(out[n - 1]) === key(out[n - 2]) ? key(out[n - 1]) : null;
    // A key holding twice the rest must go now, or it ends up stacked at the end.
    const heavy = [...left].find(([k, c]) => k !== ban && c > 1 && c >= 2 * (pool.length - c));
    let i = heavy ? pool.findIndex((x) => key(x) === heavy[0]) : pool.findIndex((x) => key(x) !== ban);
    if (i < 0) i = 0;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/** The item for one form; `tenses` is every table the form is in (analyses). */
export function sortItemFor(v: Verb, t: TenseKey, person: string): SortItem | null {
  const form = tableOf(v, t)?.[person]?.[0];
  if (!form) return null;
  return { key: `${v.id}:${t}:${person}`, verbId: v.id, form, en: v.en, shownTense: t, tenses: [...new Set(analyses(v, form).map((a) => a.tense))] };
}

/**
 * 15 forms (60 in a sprint), the tenses taken round-robin so the lanes get the
 * same share, then spread so one lane never comes up three times running. A
 * verb never shows the same spelling twice in a round.
 */
export function buildSortItems(s: AppState, n = 15, rnd: () => number = Math.random): SortItem[] {
  const lanes = sortLanes(s);
  if (lanes.length < 2 || n <= 0) return [];
  const per = Math.ceil(n / lanes.length) + 2; // spares for spellings already used
  const queues = lanes.map((t) => pickVerbTenses(s, per, { tenses: [t], rnd }));
  const out: SortItem[] = [];
  const seen = new Set<string>(); // verb + lenient form
  for (let i = 0; out.length < n && queues.some((q) => q.length); i++) {
    const q = queues[i % lanes.length].length ? queues[i % lanes.length] : queues.find((x) => x.length)!;
    const p = q.shift()!;
    const table = tableOf(p.verb, p.tense) ?? {};
    const person = shuffle(Object.keys(table), rnd).find((k) => !seen.has(`${p.verb.id}|${lenient(table[k][0])}`));
    const it = person ? sortItemFor(p.verb, p.tense, person) : null;
    if (!it) continue;
    seen.add(`${p.verb.id}|${lenient(it.form)}`);
    out.push(it);
  }
  return spread(out, (x) => x.shownTense, rnd);
}

// "הווה · אני / אתה / הוא": who says the form in each tense it belongs to.
function whoSays(it: SortItem, t: TenseKey): string {
  const v = verbById.get(it.verbId);
  if (!v) return '';
  const who = analyses(v, it.form)
    .filter((a) => a.tense === t)
    .flatMap((a) => pronounsFor(t, a.person).map(([he]) => he));
  return [...new Set(who)].join(' / ');
}

function joinAnd(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

function LaneLabel({ t }: { t: TenseKey }) {
  const l = TENSE_LABEL[t];
  return (
    <span class={`sort-lane ${t}`}>
      <span class="lane-he he" lang="he" dir="rtl">
        {l.he}
      </span>
      <span class="lane-en">{l.en}</span>
      <span class="lane-cue" lang="he" dir="rtl">
        {l.cue}
      </span>
    </span>
  );
}

export function SortGame({ mode }: GameProps) {
  const sprint = mode === 'sprint';
  const round = useRound<SortItem>({
    game: 'sort',
    mode,
    tier: 'tap',
    build: () => buildSortItems(getState(), sprint ? 60 : 15),
    sprintSec: sprint ? 60 : undefined,
  });
  const [pick, setPick] = useState<{ key: string; k: string } | null>(null);
  const it = round.item;
  const picked = it && pick?.key === it.key ? pick.k : null;
  const status = picked !== null ? round.status : null;
  // Today's lanes, plus any tense this round was built with (a resumed round keeps its lanes).
  const allowed = sortLanes(getState());
  const lanes = LANE_ORDER.filter((t) => allowed.includes(t) || round.items.some((x) => x.shownTense === t));
  const rightLanes = it ? lanes.filter((t) => sortCorrect(it, t)) : [];

  const onPick = (c: Choice) => {
    if (!it || round.status !== null) return;
    setPick({ key: it.key, k: c.k });
    const evidence: Evidence[] = [
      { tier: 'tap', ok: c.ok, skill: 'verbs', topics: [`tense:${it.shownTense}`], cardId: it.shownTense === 'imp' ? null : `c:${it.verbId}:${it.shownTense}` },
    ];
    round.answer({ ok: c.ok, evidence, miss: `${it.form} → ${rightLanes.map((t) => TENSE_LABEL[t].he).join(' / ')}`, verbId: it.verbId }, rightLanes.length > 1 && mode !== 'sprint' ? 'read' : 'auto');
    say(it.form);
  };

  let prompt = null;
  if (it) {
    const pickedLane = picked as TenseKey | null;
    prompt = (
      <div class="sort-stage">
        <div class="sort-hint">{round.answered === 0 && status === null ? 'Send it to its tense ↓' : ' '}</div>
        <div
          class={`sort-card ${status === true ? 'ok go' : status === false ? 'bad' : ''}`}
          key={it.key}
          style={pickedLane ? { '--i': [...lanes].reverse().indexOf(pickedLane), '--n': lanes.length } : undefined}
        >
          <div class="he-game" lang="he" dir="rtl">
            {it.form}
          </div>
          <div class="sort-en">{it.en}</div>
        </div>
        <div class="sort-reveal">
          {status !== null && (
            <>
              {rightLanes.length > 1 && (
                <div class="sort-both">
                  ✨ both{' '}
                  {rightLanes.map((t, i) => (
                    <span key={t}>
                      {i > 0 && (i === rightLanes.length - 1 ? ' and ' : ', ')}
                      <span class="he" lang="he" dir="rtl">
                        {TENSE_LABEL[t].he}
                      </span>
                    </span>
                  ))}
                  !
                </div>
              )}
              <div class="sort-who">
                {rightLanes.map((t) => (
                  <span key={t} class={`sort-chip ${t}`} lang="he" dir="rtl">
                    {TENSE_LABEL[t].he} · {whoSays(it, t)}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  } else if (!round.total)
    prompt = <p class="muted">Time Machine needs two tenses. It opens at A2, or once you have past or future cards in Verb forms.</p>;

  // The grid fills left to right, so the lanes go in reversed: עבר ends up on the right.
  const choices: Choice[] = it ? [...lanes].reverse().map((t) => ({ k: t, label: <LaneLabel t={t} />, ok: sortCorrect(it, t) })) : [];
  const controls = it && (
    <div class={`sort-lanes n${lanes.length}`}>
      <ChoiceGrid choices={choices} cols={Math.min(4, Math.max(1, lanes.length)) as 1 | 2 | 3 | 4} picked={picked} locked={round.status !== null} onPick={onPick} />
    </div>
  );
  const live =
    it && status !== null
      ? `${status ? 'Right!' : 'Not quite.'} ${it.form} is ${joinAnd(rightLanes.map((t) => TENSE_LABEL[t].en.toLowerCase()))}.${round.lastGain ? ` +${round.lastGain} XP.` : ''}`
      : undefined;

  return <GameShell game="sort" mode={mode} round={round} prompt={prompt} controls={controls} live={live} />;
}

// Who's talking? (מי מדבר?): a verb form pops up in a speech bubble; tap the
// pronoun that says it. Every pronoun the form fits (כתבת = אתה / את) is kept
// out of the distractors, so exactly one button is ever right.
import './snap.css';
import { useState } from 'preact/hooks';
import type { Verb } from '../content/types.ts';
import { verbById } from '../lib/content.ts';
import { type AppState, getState } from '../lib/store.ts';
import { tableOf, type TenseKey } from '../lib/verbdrill.ts';
import { type Evidence, type GameProps, pickVerbTenses, PRONOUNS, pronounsFor, say, shuffle, TENSE_LABEL, validPronouns } from './kit.ts';
import { type Choice, ChoiceGrid, GameShell, Shorshi, TenseBand, useRound } from './kit-ui.tsx';

export interface SnapItem {
  key: string;
  verbId: string;
  tense: TenseKey;
  person: string;
  form: string;
  tr: string;
  en: string;
  options: { k: string; ok: boolean }[];
  also: string[]; // every pronoun that says this form in this tense
}

/** The pronouns a command can be given to. */
export const IMP_POOL = ['אתה', 'את', 'אתם', 'אתן'];
export const PLURAL = new Set(['אנחנו', 'אתם', 'אתן', 'הם', 'הן']);
const FEMININE = new Set(['את', 'היא', 'אתן', 'הן']);

export const PRONOUN_EN: Record<string, string> = {
  'אני': 'I',
  'אתה': 'you (m)',
  'את': 'you (f)',
  'הוא': 'he',
  'היא': 'she',
  'אנחנו': 'we',
  'אתם': 'you (m pl)',
  'אתן': 'you (f pl)',
  'הם': 'they (m)',
  'הן': 'they (f)',
};

const pickOne = <T,>(xs: T[], rnd: () => number): T => xs[Math.floor(rnd() * xs.length)];

/**
 * The item for one form: the right pronoun comes from the form's own person,
 * and up to 3 pronouns that can't say it (none of validPronouns), preferring
 * the same number. Null if no pronoun is left to be wrong.
 */
export function snapItemFor(v: Verb, t: TenseKey, person: string, rnd: () => number = Math.random): SnapItem | null {
  const f = tableOf(v, t)?.[person];
  const right = pickOne(pronounsFor(t, person), rnd)?.[0];
  if (!f || !right) return null;
  const form = f[0];
  const also = validPronouns(v, t, form);
  const pool = (t === 'imp' ? IMP_POOL : PRONOUNS).filter((x) => !also.includes(x));
  const plural = PLURAL.has(right);
  const wrong = [...shuffle(pool.filter((x) => PLURAL.has(x) === plural), rnd), ...shuffle(pool.filter((x) => PLURAL.has(x) !== plural), rnd)].slice(0, 3);
  if (!wrong.length) return null;
  return {
    key: `${v.id}:${t}:${person}`,
    verbId: v.id,
    tense: t,
    person,
    form,
    tr: f[1],
    en: v.en,
    options: shuffle([{ k: right, ok: true }, ...wrong.map((k) => ({ k, ok: false }))], rnd),
    also,
  };
}

/** 12 forms of the verb-tenses pickVerbTenses chooses, each in a random person. */
export function buildSnapItems(s: AppState, n = 12, rnd: () => number = Math.random): SnapItem[] {
  const out: SnapItem[] = [];
  for (const p of pickVerbTenses(s, n, { rnd })) {
    const persons = Object.keys(tableOf(p.verb, p.tense) ?? {});
    const it = persons.length ? snapItemFor(p.verb, p.tense, pickOne(persons, rnd), rnd) : null;
    if (it) out.push(it);
  }
  return out;
}

const voiceOf = (it: SnapItem, pronoun: string): 'm' | 'f' => (FEMININE.has(pronoun) || /f/.test(it.person) ? 'f' : 'm');

export function SnapGame({ mode }: GameProps) {
  const round = useRound<SnapItem>({ game: 'snap', mode, tier: 'tap', build: () => buildSnapItems(getState()) });
  const [pick, setPick] = useState<{ key: string; k: string } | null>(null);
  const it = round.item;
  const picked = it && pick?.key === it.key ? pick.k : null;
  const status = picked !== null ? round.status : null;
  const right = it?.options.find((o) => o.ok)?.k ?? '';

  const onPick = (c: Choice) => {
    if (!it || round.status !== null) return;
    setPick({ key: it.key, k: c.k });
    const v = verbById.get(it.verbId);
    const evidence: Evidence[] = [
      {
        tier: 'tap',
        ok: c.ok,
        skill: 'verbs',
        topics: [...(v ? [`binyan:${v.binyan}`] : []), `tense:${it.tense}`],
        cardId: it.tense === 'imp' ? null : `c:${it.verbId}:${it.tense}`,
      },
    ];
    round.answer({ ok: c.ok, evidence, miss: `${it.also.join(' / ')} · ${TENSE_LABEL[it.tense].he} → ${it.form}`, verbId: it.verbId });
    say(`${right} ${it.form}`, voiceOf(it, right));
  };

  let prompt = null;
  if (it) {
    const mood = status === true ? 'cheer' : status === false ? 'oops' : 'idle';
    prompt = (
      <div class="snap-stage">
        <TenseBand tense={it.tense} />
        <div class={`snap-bubble ${status === true ? 'ok' : status === false ? 'bad' : ''}`} key={it.key}>
          <div class="he-game" lang="he" dir="rtl">
            {it.form}
          </div>
          <div class="snap-en">{it.en}</div>
        </div>
        <div class="snap-who">
          <Shorshi mood={mood} size={44} />
          <div class="snap-reveal" aria-hidden={status === null ? 'true' : undefined}>
            {status === null ? (
              <span class="snap-ask">Who's talking?</span>
            ) : (
              <>
                <div class="snap-say">
                  <span class="snap-mark" aria-hidden="true">
                    {status ? '✓' : '→'}
                  </span>
                  <span class="he" lang="he" dir="rtl">
                    <b>{right}</b> {it.form}
                  </span>
                  <span class="snap-tr">{it.tr}</span>
                </div>
                {it.also.length > 1 && (
                  <div class="snap-also he" lang="he" dir="rtl">
                    {it.form} = {it.also.join(' / ')}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  } else if (!round.total) prompt = <p class="muted">No verbs to play with yet: add some in Verb forms.</p>;

  const choices: Choice[] = it ? it.options.map((o) => ({ k: o.k, label: o.k, ok: o.ok, he: true, sub: PRONOUN_EN[o.k] })) : [];
  const controls = it && (
    <div class="snap-grid">
      <ChoiceGrid choices={choices} cols={choices.length === 3 ? 3 : 2} picked={picked} locked={round.status !== null} onPick={onPick} />
    </div>
  );

  return <GameShell game="snap" mode={mode} round={round} prompt={prompt} controls={controls} />;
}

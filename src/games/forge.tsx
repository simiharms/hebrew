// Verb Forge (בונים פועל): the production round of every ride. The stem of a
// tense table sits on the anvil; pick the chip that goes before it and the one
// that goes after it, and the form assembles in place, right to left. Check
// grades it with sameForm. A built answer reviews its c: card when the card is
// due (g 3 right, 1 wrong, never 4); a second item on the same card can only
// pull it forward.
import './forge.css';
import { useEffect, useState } from 'preact/hooks';
import type { Verb } from '../content/types.ts';
import { verbById } from '../lib/content.ts';
import { go } from '../lib/router.ts';
import type { Tense } from '../lib/session.ts';
import { type AppState, getState, useAppState } from '../lib/store.ts';
import { tableOf } from '../lib/verbdrill.ts';
import { calm, type Evidence, finalize, type GameProps, pickVerbTenses, pronounsFor, sameForm, say, shuffle, splitTable, TENSE_LABEL } from './kit.ts';
import { GameShell, TenseBand, TileRow, useBumpGuard, useRound } from './kit-ui.tsx';

export interface ForgeItem {
  key: string;
  verbId: string;
  tense: Tense;
  person: string;
  pronoun: string;
  pronounEn: string; // keeps the gender: "I (f)"
  inf: string;
  en: string;
  stem: string; // the table's common letters, without final forms
  pre: string[]; // chips before the stem ('' = nothing), unfinalised, in display order
  suf: string[]; // chips after the stem, unfinalised (shown through finalize)
  answer: string; // the form as the table spells it
  okPre: string;
  okSuf: string;
}

const FORGE_TENSES: Tense[] = ['present', 'past', 'future'];
const FEMININE = new Set(['את', 'היא', 'אתן', 'הן']);

/** Whether the chips build the answer. */
export function forgeCheck(it: Pick<ForgeItem, 'stem' | 'answer'>, pre: string, suf: string): boolean {
  return sameForm(pre + it.stem + suf, it.answer);
}

/**
 * What a Check records: build-tier evidence on the table's c: card (reviewed
 * only when due, g 3 right / 1 wrong) and, on a miss, the built word for the
 * mistake bank.
 */
export function forgeEvidence(it: ForgeItem, pre: string, suf: string, binyan?: string): { ok: boolean; evidence: Evidence[] } {
  const ok = forgeCheck(it, pre, suf);
  return {
    ok,
    evidence: [
      {
        tier: 'build',
        ok,
        skill: 'verbs',
        topics: [...(binyan ? [`binyan:${binyan}`] : []), `tense:${it.tense}`],
        cardId: `c:${it.verbId}:${it.tense}`,
        mistake: {
          kind: 'verb',
          ref: `${it.verbId}:${it.tense}:${it.person}`,
          prompt: `${it.pronoun} (${it.pronounEn}) · ${it.inf} · ${TENSE_LABEL[it.tense].he}`,
          answer: it.answer,
          given: finalize(pre + it.stem + suf),
        },
      },
    ],
  };
}

/** A row of chips is only shown when it offers a choice (most past and present tables have no prefix). */
export const rowShown = (chunks: string[]): boolean => !(chunks.length === 1 && chunks[0] === '');

/** The word as it stands: final letters only once both chips are in, so a stem never looks finished early. */
export function forgeParts(it: Pick<ForgeItem, 'stem'>, pre: string | null, suf: string | null): { pre: string | null; stem: string; suf: string | null } {
  if (pre === null || suf === null) return { pre, stem: it.stem, suf: suf === null ? null : finalize(suf) };
  const full = finalize(pre + it.stem + suf);
  return { pre: full.slice(0, pre.length), stem: full.slice(pre.length, pre.length + it.stem.length), suf: full.slice(pre.length + it.stem.length) };
}

/** One form to forge, or null when the table has no usable stem (the future of ליפול). */
export function forgeItemFor(v: Verb, t: Tense, person: string, rnd: () => number = Math.random): ForgeItem | null {
  const split = splitTable(v, t);
  const f = tableOf(v, t)?.[person];
  const part = split?.parts[person];
  const prs = pronounsFor(t, person);
  if (!split || !f || !part || !prs.length) return null;
  const [pronoun, pronounEn] = prs[Math.floor(rnd() * prs.length)];
  return {
    key: `${v.id}:${t}:${person}`,
    verbId: v.id,
    tense: t,
    person,
    pronoun,
    pronounEn,
    inf: v.inf,
    en: v.en,
    stem: split.stem,
    pre: shuffle(split.pre, rnd),
    suf: shuffle(split.suf, rnd),
    answer: f[0],
    okPre: part.pre,
    okSuf: part.suf,
  };
}

/**
 * Eight forms from the due c: cards first (pickVerbTenses, dueFirst). Each card
 * gives one item; with fewer than eight due, the round uses at least four
 * tables and the first ones get a second person with a different spelling,
 * later in the round. At most two items per card.
 */
export function buildForgeItems(s: AppState, n = 8, rnd: () => number = Math.random): ForgeItem[] {
  if (n <= 0) return [];
  const picks = pickVerbTenses(s, n, { tenses: FORGE_TENSES, dueFirst: true, rnd }).filter((p) => p.tense !== 'imp' && splitTable(p.verb, p.tense as Tense));
  const due = picks.filter((p) => p.due).length;
  const cards = picks.slice(0, Math.min(picks.length, Math.max(Math.ceil(n / 2), Math.min(n, due))));
  const first: { item: ForgeItem; verb: Verb; persons: string[] }[] = [];
  for (const p of cards) {
    const t = p.tense as Tense;
    const persons = shuffle(Object.keys(tableOf(p.verb, t) ?? {}), rnd);
    const item = persons.length ? forgeItemFor(p.verb, t, persons[0], rnd) : null;
    if (item) first.push({ item, verb: p.verb, persons });
  }
  const second: ForgeItem[] = [];
  for (const { item, verb, persons } of first) {
    if (first.length + second.length >= n) break;
    const table = tableOf(verb, item.tense) ?? {};
    const other = persons.find((k) => !sameForm(table[k][0], item.answer));
    const b = other ? forgeItemFor(verb, item.tense, other, rnd) : null;
    if (b) second.push(b);
  }
  return [...first.map((x) => x.item), ...second];
}

const SPARKS = 10;

export function ForgeGame({ mode }: GameProps) {
  const s = useAppState();
  const round = useRound<ForgeItem>({ game: 'forge', mode, tier: 'build', build: () => buildForgeItems(getState()) });
  const it = round.item;
  const [pick, setPick] = useState<{ key: string; pre: string | null; suf: string | null }>({ key: '', pre: null, suf: null });
  const showPre = !!it && rowShown(it.pre);
  const showSuf = !!it && rowShown(it.suf);
  const mine = it && pick.key === it.key ? pick : null;
  const pre = !it ? null : showPre ? (mine?.pre ?? null) : '';
  const suf = !it ? null : showSuf ? (mine?.suf ?? null) : '';
  const ready = pre !== null && suf !== null;
  const status = round.status;
  const guard = useBumpGuard(`${it?.key}|${pre}|${suf}`, 200);
  const quiet = calm();

  const choose = (side: 'pre' | 'suf', chunk: string) => {
    if (!it || status !== null) return;
    setPick((p) => ({ ...(p.key === it.key ? p : { key: it.key, pre: null, suf: null }), [side]: chunk }));
  };

  const check = () => {
    if (!it || status !== null || pre === null || suf === null) return;
    const { ok, evidence } = forgeEvidence(it, pre, suf, verbById.get(it.verbId)?.binyan);
    round.answer({ ok, evidence, miss: `${it.pronoun} · ${TENSE_LABEL[it.tense].he} → ${it.answer}`, verbId: it.verbId }, ok ? 'auto' : 'hold');
    say(it.answer, FEMININE.has(it.pronoun) || /\(f/.test(it.pronounEn) ? 'f' : 'm');
  };

  // Enter (Mac keyboards) hammers once both chips are in.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat || e.metaKey || e.ctrlKey || e.altKey || status !== null || !ready || guard) return;
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      e.preventDefault();
      check();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  let prompt = null;
  if (it) {
    const parts = forgeParts(it, pre, suf);
    const right = forgeParts(it, it.okPre, it.okSuf);
    const ambiguous = it.tense === 'present' && (it.pronoun === 'אני' || it.pronoun === 'אנחנו');
    const fem = /\(f/.test(it.pronounEn);
    const state = status === true ? 'ok' : status === false ? 'bad' : ready ? 'full' : '';
    prompt = (
      <div class="forge-stage" data-tense={it.tense}>
        <TenseBand tense={it.tense} />
        <div class="forge-ask">
          <span class="forge-pro he" lang="he" dir="rtl">
            {it.pronoun}
          </span>
          {ambiguous && (
            <span class={`forge-gender ${fem ? 'f' : 'm'}`} aria-label={fem ? 'feminine' : 'masculine'}>
              {fem ? '♀' : '♂'}
            </span>
          )}
          <span class="forge-dot" aria-hidden="true">
            ·
          </span>
          <span class="forge-inf he" lang="he" dir="rtl">
            {it.inf}
          </span>
        </div>
        <div class="forge-en">
          {it.pronounEn} · {TENSE_LABEL[it.tense].en.toLowerCase()} · {it.en}
        </div>
        <div class={`forge-anvil ${state}`} key={it.key}>
          {status !== null && !quiet && (
            <span class="forge-hammer" aria-hidden="true" key={`h${round.answered}`}>
              🔨
            </span>
          )}
          <div class="forge-word" dir="rtl" lang="he" aria-label={ready ? `Your word: ${parts.pre ?? ''}${parts.stem}${parts.suf ?? ''}` : 'The word so far'}>
            {showPre && <Part key={`p${parts.pre ?? '\u0000'}`} text={parts.pre} side="pre" />}
            <span class="forge-part stem">{parts.stem}</span>
            {showSuf && <Part key={`s${parts.suf ?? '\u0000'}`} text={parts.suf} side="suf" />}
          </div>
          {status === true && !quiet && (
            <div class="forge-sparks" aria-hidden="true">
              {Array.from({ length: SPARKS }, (_, i) => (
                <i style={`--a:${Math.round((i * 360) / SPARKS + (i % 2) * 18)}deg;--d:${58 + (i % 3) * 18}px`} />
              ))}
            </div>
          )}
        </div>
        <div class="forge-verdict" aria-hidden={status === null ? 'true' : undefined}>
          {status === true && (
            <span class="forge-yes">
              ✓ <span class="he" lang="he" dir="rtl">{it.pronoun} {it.answer}</span>
            </span>
          )}
          {status === false && (
            <span class="forge-fix">
              <span class="forge-fix-lbl">It's</span>
              <span class="forge-word mini" dir="rtl" lang="he">
                {showPre && right.pre ? <span class="forge-part fill pre">{right.pre}</span> : null}
                <span class="forge-part stem">{right.stem}</span>
                {showSuf && right.suf ? <span class="forge-part fill suf">{right.suf}</span> : null}
              </span>
            </span>
          )}
        </div>
      </div>
    );
  } else if (!round.total) prompt = <p class="muted">No verb tables to forge yet: new verbs start in Verb forms.</p>;

  // On a right answer the chips you picked are the ones marked ✓ (another pair can't build the same form, but be safe).
  const tiles = (chunks: string[], ok: string, picked: string | null, side: 'pre' | 'suf') =>
    chunks.map((c) => ({ k: side + c, text: side === 'suf' ? finalize(c) : c, ok: status === true ? c === picked : c === ok }));

  const controls = it && (
    <div class="forge-controls" data-tense={it.tense}>
      {showPre && <TileRow label="Before · תחילית" tiles={tiles(it.pre, it.okPre, pre, 'pre')} picked={pre === null ? null : `pre${pre}`} locked={status !== null} onPick={(k) => choose('pre', k.slice(3))} />}
      {showSuf && <TileRow label="After · סופית" tiles={tiles(it.suf, it.okSuf, suf, 'suf')} picked={suf === null ? null : `suf${suf}`} locked={status !== null} onPick={(k) => choose('suf', k.slice(3))} />}
      {status === null && (
        <button type="button" class={`btn primary block game-cta forge-check ${ready ? 'ready' : ''}`} disabled={!ready || guard} onClick={check}>
          🔨 Check
        </button>
      )}
    </div>
  );

  const anyCards = Object.keys(s.cards).some((k) => k.startsWith('c:'));
  const result = !anyCards && (
    <div class="forge-note">
      <p>Built forms strengthen verbs you have already started. New verbs start in Verb forms.</p>
      <button type="button" class="btn block" onClick={() => go('session/verbs')}>
        🔁 Start new verbs in Verb forms →
      </button>
    </div>
  );

  const live = it && status === false ? `Not quite. It's ${it.pronoun} ${it.answer}.` : it && status === null && !ready ? `${it.pronoun}, ${TENSE_LABEL[it.tense].en}, ${it.inf}: build the form.` : undefined;

  return <GameShell game="forge" mode={mode} round={round} prompt={prompt} controls={controls} result={result || undefined} live={live} />;
}

function Part({ text, side }: { text: string | null; side: 'pre' | 'suf' }) {
  if (text === null) return <span class={`forge-part slot ${side}`} aria-hidden="true" />;
  if (!text) return null; // "—": nothing goes there
  return <span class={`forge-part fill ${side}`}>{text}</span>;
}

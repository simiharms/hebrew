// Table Smash (שוברים טבלה): fill a whole verb table row by row by tapping its
// forms in a chip bank, with a few look-alike forms from the verb's other
// tenses mixed in. Two tables per round; the terminus pays item XP ×2.
import './smash.css';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Verb } from '../content/types.ts';
import { verbById, verbs } from '../lib/content.ts';
import { lenient } from '../lib/hebrew.ts';
import { go } from '../lib/router.ts';
import { drillable, type Tense, TENSES } from '../lib/session.ts';
import { type AppState, getState } from '../lib/store.ts';
import { personChoices, tableOf, type TenseKey } from '../lib/verbdrill.ts';
import { allowedTenses, calm, type Evidence, type GameProps, hashSeed, sameForm, say, seeded, shuffle, TENSE_LABEL } from './kit.ts';
import { Burst, GameShell, Shorshi, TenseBand, useBumpGuard, useRound } from './kit-ui.tsx';

export interface SmashItem {
  key: string;
  verbId: string;
  tense: TenseKey;
  table: 0 | 1;
  person: string;
  label: string; // the row's pronouns, e.g. "אני / אתה / הוא"
  form: string;
  decoys: string[]; // the same for every row of a table
}

/** A chip in the bank: a row's form (row = its item index) or a decoy (row null). */
export interface SmashChip {
  k: string;
  form: string;
  row: number | null;
}

const ALL_TENSES: TenseKey[] = ['present', 'past', 'future', 'imp'];
const SECOND_TABLE: Tense[] = ['past', 'future', 'present'];
const WINDOW = 3; // table 0 varies among this many of the weakest tables

/**
 * The tables to smash. Table 0 is one of the weakest c: cards (lowest
 * stability; taps never change it, so a small window keeps replays varied),
 * else an early A1/A2 verb. Table 1 is another open tense of the same verb
 * (past → future → present), or else the same tense of another verb (A1, where
 * only the present is open).
 */
export function smashTables(s: AppState, n = 2, rnd: () => number = Math.random): { verb: Verb; tense: Tense }[] {
  const allowed = allowedTenses(s);
  const carded = Object.entries(s.cards)
    .flatMap(([id, c]) => {
      const [k, vid, t] = id.split(':');
      const verb = verbById.get(vid);
      return k === 'c' && verb && (TENSES as string[]).includes(t) && drillable(verb, t as Tense) ? [{ verb, tense: t as Tense, s: c.s }] : [];
    })
    .sort((a, b) => a.s - b.s);
  const fbTense: Tense = allowed.includes('past') ? 'past' : 'present';
  const fallback = verbs.filter((v) => (v.level === 'A1' || v.level === 'A2') && drillable(v, fbTense)).map((verb) => ({ verb, tense: fbTense }));
  const pool = carded.length ? carded : fallback;
  const first = pool[Math.floor(rnd() * Math.min(WINDOW, pool.length))];
  if (!first || n <= 0) return [];
  const out: { verb: Verb; tense: Tense }[] = [{ verb: first.verb, tense: first.tense }];
  if (n >= 2) {
    const t = SECOND_TABLE.find((x) => x !== first.tense && allowed.includes(x) && drillable(first.verb, x));
    if (t) out.push({ verb: first.verb, tense: t });
    else {
      const other = [...pool, ...fallback].find((x) => x.verb.id !== first.verb.id && x.tense === first.tense);
      if (other) out.push({ verb: other.verb, tense: other.tense });
    }
  }
  return out;
}

/** Up to 3 forms of the verb's other drillable tenses that fit no row of this table. */
export function smashDecoys(v: Verb, t: TenseKey, rnd: () => number = Math.random): string[] {
  const rows = Object.values(tableOf(v, t) ?? {}).map((f) => f[0]);
  const lists = shuffle(
    ALL_TENSES.filter((x) => x !== t && drillable(v, x)).map((x) => shuffle(Object.values(tableOf(v, x) ?? {}).map((f) => f[0]), rnd)),
    rnd,
  );
  const out: string[] = [];
  const taken = [...rows];
  // One from each other tense in turn, so the decoys look like different tenses.
  for (let i = 0; out.length < 3 && lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const f = l[i];
      if (out.length >= 3 || f === undefined || taken.some((x) => sameForm(x, f))) continue;
      out.push(f);
      taken.push(f);
    }
  }
  return out;
}

/** One item per row of each table, rows in the usual table order. */
export function buildSmashItems(s: AppState, n = 2, rnd: () => number = Math.random): SmashItem[] {
  const out: SmashItem[] = [];
  smashTables(s, n, rnd).forEach(({ verb, tense }, ti) => {
    const table = tableOf(verb, tense);
    if (!table) return;
    const decoys = smashDecoys(verb, tense, rnd);
    for (const [person, label] of personChoices(tense)) {
      if (!table[person]) continue;
      out.push({ key: `${verb.id}:${tense}:${person}`, verbId: verb.id, tense, table: ti as 0 | 1, person, label, form: table[person][0], decoys });
    }
  });
  return out;
}

/** The chip bank of one table: a chip per row plus its decoys, in a fixed shuffled order. */
export function smashBank(items: SmashItem[], table: 0 | 1): SmashChip[] {
  const rows = items.flatMap((it, i) => (it.table === table ? [{ it, i }] : []));
  if (!rows.length) return [];
  const chips: SmashChip[] = [...rows.map(({ it, i }) => ({ k: `r${i}`, form: it.form, row: i })), ...rows[0].it.decoys.map((form, j) => ({ k: `d${table}.${j}`, form, row: null }))];
  return shuffle(chips, seeded(hashSeed(rows[0].it.key)));
}

/**
 * Chips already used: as many chips of each spelling as there are filled rows
 * with it, the ones tapped first (כתבת ×2: whichever was tapped goes).
 */
export function usedChips(bank: SmashChip[], filled: (row: number) => boolean, tapped: ReadonlySet<string> = new Set()): Set<string> {
  const groups = new Map<string, SmashChip[]>();
  for (const c of bank) {
    if (c.row === null) continue;
    const g = groups.get(lenient(c.form)) ?? [];
    g.push(c);
    groups.set(lenient(c.form), g);
  }
  const used = new Set<string>();
  for (const chips of groups.values()) {
    let n = chips.filter((c) => filled(c.row!)).length;
    for (const pass of [(c: SmashChip) => tapped.has(c.k), (c: SmashChip) => filled(c.row!), () => true]) {
      for (const c of chips) {
        if (n > 0 && !used.has(c.k) && pass(c)) {
          used.add(c.k);
          n--;
        }
      }
    }
  }
  return used;
}

export function SmashGame({ mode }: GameProps) {
  const round = useRound<SmashItem>({ game: 'smash', mode, tier: 'tap', build: () => buildSmashItems(getState()) });
  const it = round.item;
  const table = it?.table ?? 0;
  const tapped = useRef<{ items: SmashItem[]; keys: Set<string> }>({ items: round.items, keys: new Set() });
  if (tapped.current.items !== round.items) tapped.current = { items: round.items, keys: new Set() };
  const [wrong, setWrong] = useState<string | null>(null);
  const locked = useBumpGuard(`${round.index}:${round.answered}`);
  const bank = useMemo(() => smashBank(round.items, table), [round.items, table]);
  const filled = (row: number) => row < round.answered;
  const used = usedChips(bank, filled, tapped.current.keys);
  const rows = round.items.flatMap((x, i) => (x.table === table ? [{ x, i }] : []));
  const lastRow = rows[rows.length - 1]?.i ?? -1;
  const smashed = !!it && round.status === true && round.index === lastRow;
  const tables = new Set(round.items.map((x) => x.table)).size;
  const hint = (round.shell?.misses ?? 0) >= 2;
  const v = it ? verbById.get(it.verbId) : undefined;

  // A wrong chip flashes red for a moment.
  useEffect(() => {
    if (!wrong) return;
    const t = setTimeout(() => setWrong(null), 450);
    return () => clearTimeout(t);
  }, [wrong]);

  // On a short screen (an iPhone SE Home-Screen app) the bank can run under the
  // bottom edge: scroll it into view, but never past the row being filled.
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const bank = document.querySelector('.smash-bank');
    const row = document.querySelector('.smash-table .row.now');
    if (!bank || !row) return;
    const over = bank.getBoundingClientRect().bottom + 12 - window.innerHeight;
    const room = row.getBoundingClientRect().top - 8;
    if (over > 0 && room > 0) window.scrollBy({ top: Math.min(over, room), behavior: calm() ? 'auto' : 'smooth' });
  }, [round.index, table]);

  const evidence = (x: SmashItem, ok: boolean): Evidence[] => {
    const vb = verbById.get(x.verbId);
    return [
      {
        tier: 'tap',
        ok,
        skill: 'verbs',
        topics: [...(vb ? [`binyan:${vb.binyan}`] : []), `tense:${x.tense}`],
        cardId: x.tense === 'imp' ? null : `c:${x.verbId}:${x.tense}`,
      },
    ];
  };

  const onTap = (c: SmashChip, el: HTMLElement) => {
    // A chip flashing red ignores taps: a bumped double tap is one miss, not two (which would light the answer).
    if (!it || round.status !== null || locked || used.has(c.k) || wrong === c.k) return;
    if (sameForm(c.form, it.form)) {
      tapped.current.keys.add(c.k);
      const clean = (round.shell?.misses ?? 0) === 0;
      round.answer(
        { ok: true, evidence: clean ? evidence(it, true) : undefined, miss: `${it.label} · ${TENSE_LABEL[it.tense].he} → ${it.form}`, verbId: it.verbId },
        round.index === lastRow ? 'auto' : 'now',
      );
      say(it.form);
      return;
    }
    setWrong(c.k);
    if (!calm() && typeof el.animate === 'function') {
      el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], {
        duration: 180,
        easing: 'ease-in-out',
      });
    }
    round.miss(evidence(it, false));
  };

  let prompt = null;
  if (it) {
    prompt = (
      <div class="smash-stage">
        <div class="smash-head">
          <div class="smash-inf he" lang="he" dir="rtl">
            {v?.inf ?? ''}
          </div>
          <div class="smash-en">{v?.en ?? ''}</div>
        </div>
        <div class="smash-meta">
          <TenseBand tense={it.tense} />
          {tables > 1 && (
            <span class="smash-count" aria-label={`Table ${table + 1} of ${tables}`}>
              🧱 {table + 1}/{tables}
            </span>
          )}
        </div>
        <div class={`smash-board ${smashed ? 'smashed' : ''}`}>
          <ol class="smash-table" dir="rtl" key={`${it.verbId}:${it.tense}`}>
            {rows.map(({ x, i }) => {
              const done = i < round.answered;
              const now = i === round.index && !smashed;
              return (
                <li key={x.key} class={`row ${done ? 'done' : ''} ${now ? 'now' : ''}`} aria-current={now ? 'true' : undefined}>
                  <span class="who he" lang="he">
                    {x.label}
                  </span>
                  <span class="cell he" lang="he">
                    {done ? x.form : now ? '?' : ''}
                  </span>
                </li>
              );
            })}
          </ol>
          {smashed && (
            <div class="smash-boom" aria-hidden="true">
              <Burst />
              <span class="boom-tag">
                <Shorshi mood="cheer" size={36} />
                <span class="he" lang="he" dir="rtl">
                  שברת!
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
    );
  } else if (!round.total) prompt = <p class="muted">No verb tables to smash yet.</p>;

  const controls = it && (
    <>
      <div class="smash-help">{round.answered === 0 && !hint ? 'Tap the form for the glowing row' : hint ? 'Look for the glowing chip' : ' '}</div>
      <div class="smash-bank" role="group" aria-label="Forms" dir="rtl">
        {bank.map((c) => {
          if (used.has(c.k)) return <span key={c.k} class="smash-chip gone" aria-hidden="true" />;
          const fits = sameForm(c.form, it.form);
          const bad = wrong === c.k;
          return (
            <button
              key={c.k}
              type="button"
              class={`opt smash-chip ${bad ? 'bad' : ''} ${hint && fits ? 'hint' : ''} ${c.form.length > 7 ? 'long' : ''}`}
              lang="he"
              dir="rtl"
              data-ok={fits ? 'true' : undefined}
              disabled={locked || round.status !== null}
              onClick={(e) => onTap(c, e.currentTarget)}
            >
              {c.form}
              {bad && (
                <span class="opt-mark" aria-hidden="true">
                  ✕
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );

  const t0 = round.items[0];
  const result = t0 && (
    <div class="smash-credit">
      <p>
        Taps don't move your review schedule. Type the{' '}
        <span class="he" lang="he" dir="rtl">
          {verbById.get(t0.verbId)?.inf ?? ''}
        </span>{' '}
        {TENSE_LABEL[t0.tense].en.toLowerCase()} table to count it.
      </p>
      <button type="button" class="btn block" onClick={() => go(`verbs/table/${t0.verbId}/${t0.tense}`)}>
        ⌨️ Type it for full credit →
      </button>
    </div>
  );

  const live = it && round.status === null && !(round.shell?.misses ?? 0) ? `${it.label}: pick its form.` : undefined;

  return <GameShell game="smash" mode={mode} round={round} prompt={prompt} controls={controls} result={result} live={live} />;
}

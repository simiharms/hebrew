// Match Rush (זוגות): five Hebrew words on the right, their English on the
// left in another order; tap one, then its twin. Pairs can be matched in any
// order and fade out; when a wave is cleared the next five slide in, so a new
// pair's place never gives it away. No wave holds two words with a shared
// English gloss or the same lenient Hebrew, so every tile has one twin.
// Verbs-only learners match infinitives; A1 beginners with few words match
// the letters (finals included) to their names.
import './match.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { VocabItem } from '../content/types.ts';
import { LETTERS } from '../lib/alphabet.ts';
import { levelRank, verbs } from '../lib/content.ts';
import { isDue } from '../lib/fsrs.ts';
import { lenient, normalizeEn } from '../lib/hebrew.ts';
import { verbCardOrder } from '../lib/session.ts';
import { type AppState, getState } from '../lib/store.ts';
import { type Evidence, type GameProps, hashSeed, levelOk, loadRound, sameGloss, say, shuffle, vocabPool } from './kit.ts';
import { GameShell, Shorshi, useBumpGuard, useRound } from './kit-ui.tsx';

export interface MatchItem {
  key: string; // the card id it stands for: v:<id>, vp:<id> or a:<letter>
  he: string;
  en: string; // as shown on the tile
  cardId: string | null; // null while the learner has no card for it
  wave: number;
  kind: 'word' | 'verb' | 'letter';
  tr?: string; // shown with the last pair matched
  sub?: string; // letters: an example word
}

export const WAVE = 5;
const ROUND = 15;
const SPRINT = 40;
const SPRINT_SEC = 60;
const MAX_HE = 18;
const MAX_EN = 28;
const LETTERS_BELOW = 10; // A1 learners with fewer word cards than this match letters

interface Cand {
  key: string;
  he: string;
  alt: string[];
  en: string; // full gloss, for clashes
  enAlt: string[];
  show: string; // the tile's English
  cardId: string | null;
  kind: MatchItem['kind'];
  rank: number; // 0 due or learning · 1 new · 2 known (words: 1 known, 2 new)
  topic: string;
  tr?: string;
  sub?: string;
}

/** A gloss short enough for a tile: the whole thing, or its first part. */
export function shortGloss(en: string, max = MAX_EN): string {
  const full = en.trim();
  if (full.length <= max) return full;
  for (const cut of [';', '(', ',']) {
    const head = full.split(cut)[0].trim();
    if (head && head.length <= max) return head;
  }
  return '';
}

const fitsHe = (he: string) => !he.includes('/') && he.trim().length <= MAX_HE && he.trim().split(/\s+/).length <= 2;

type Pairable = Pick<Cand, 'he' | 'alt' | 'en' | 'enAlt' | 'show'>;

/**
 * Two candidates that can't share a wave: one English tile could fit both (a
 * shared gloss, counting the shortened tile text too), or the Hebrew is the
 * same once finals, points and doubled ו/י are set aside (כ and ך included).
 */
export function clash(a: Pairable, b: Pairable): boolean {
  const gloss = (c: Pairable) => ({ en: c.en, enAlt: [...c.enAlt, c.show] }) as Pick<VocabItem, 'en' | 'enAlt'> as VocabItem;
  if (sameGloss(gloss(a), gloss(b)) || normalizeEn(a.show) === normalizeEn(b.show)) return true;
  const hb = new Set([b.he, ...b.alt].map(lenient));
  return [a.he, ...a.alt].some((x) => hb.has(lenient(x)));
}

const cardRank = (s: AppState, id: string, now: number) => {
  const c = s.cards[id];
  if (!c) return null;
  return isDue(c, now) || c.s < 4 ? 0 : 2;
};

// Words: due or learning first, then known ones seen longest ago, then new
// ones at the learner's level (vocabPool), in topic runs.
function wordCands(s: AppState, n: number, rnd: () => number): Cand[] {
  const now = Date.now();
  return vocabPool(s, n * 2 + 10, rnd).flatMap(({ item, cardId }) => {
    const show = shortGloss(item.en);
    if (!fitsHe(item.he) || !show) return [];
    const r = cardId ? cardRank(s, cardId, now) : null;
    return [
      {
        key: `v:${item.id}`,
        he: item.he.trim(),
        alt: item.alt ?? [],
        en: item.en,
        enAlt: item.enAlt ?? [],
        show,
        cardId,
        kind: 'word' as const,
        rank: r === null ? 2 : r === 0 ? 0 : 1,
        topic: item.topic,
        tr: item.tr,
      },
    ];
  });
}

// Verbs only: infinitives with their vp: cards, then verbs in teaching order.
function verbCands(s: AppState, rnd: () => number): Cand[] {
  const now = Date.now();
  const order = new Map<string, number>();
  verbCardOrder().forEach((x, i) => order.has(x.verb.id) || order.set(x.verb.id, i));
  const out = verbs.flatMap((v) => {
    const show = shortGloss(v.en);
    if (!levelOk(v.level, s) || !show || !fitsHe(v.inf)) return [];
    const id = `vp:${v.id}`;
    const r = cardRank(s, id, now);
    return [{ key: id, he: v.inf, alt: [], en: v.en, enAlt: [], show, cardId: s.cards[id] ? id : null, kind: 'verb' as const, rank: r ?? 1, topic: v.binyan, tr: v.tr }];
  });
  const pos = (c: Cand) => order.get(c.key.slice(3)) ?? Infinity;
  // New verbs vary within the first stretch of the teaching order.
  const fresh = out.filter((c) => c.rank === 1).sort((a, b) => pos(a) - pos(b));
  return [...shuffle(out.filter((c) => c.rank === 0), rnd), ...shuffle(fresh.slice(0, 40), rnd), ...fresh.slice(40), ...shuffle(out.filter((c) => c.rank === 2), rnd)];
}

// The alphabet: letters being learned, then new ones, then known ones.
function letterCands(s: AppState, rnd: () => number): Cand[] {
  const now = Date.now();
  const out = LETTERS.map((l) => {
    const id = `a:${l.ch}`;
    const r = cardRank(s, id, now);
    return { key: id, he: l.ch, alt: [], en: l.nameTr, enAlt: [], show: l.nameTr, cardId: s.cards[id] ? id : null, kind: 'letter' as const, rank: r ?? 1, topic: 'alphabet', sub: `${l.ex} · ${l.exTr} · ${l.exEn}` };
  });
  return [0, 1, 2].flatMap((r) => shuffle(out.filter((c) => c.rank === r), rnd));
}

/** Which pairs this learner matches: verbs (verbs only), letters (A1 with few words) or words. */
export function matchVariant(s: AppState): MatchItem['kind'] {
  if (s.settings.verbsOnly) return 'verb';
  const words = Object.keys(s.cards).filter((k) => k.startsWith('v:')).length;
  return levelRank(s.level) === 0 && words < LETTERS_BELOW ? 'letter' : 'word';
}

/**
 * Splits candidates (best first) into waves of about five with no clash in a
 * wave. Wave sizes are even (27 → 5 5 5 4 4 4). A candidate that clashes with
 * every wave that has room swaps in for a pair that can move to one (so the
 * whole alphabet fits, each final away from its letter); failing that it
 * waits for a later wave or is left out.
 */
export function assignWaves<C extends Pairable>(cands: C[], n: number): C[][] {
  const total = Math.min(n, cands.length);
  if (total < 2) return [];
  const count = Math.ceil(total / WAVE);
  const sizes = Array.from({ length: count }, (_, i) => Math.floor(total / count) + (i < total % count ? 1 : 0));
  const waves: C[][] = sizes.map(() => []);
  const fits = (c: C, w: number, but?: C) => waves[w].length - (but ? 1 : 0) < sizes[w] && !waves[w].some((x) => x !== but && clash(x, c));
  const place = (c: C): boolean => {
    const w = waves.findIndex((_, i) => fits(c, i));
    if (w >= 0) {
      waves[w].push(c);
      return true;
    }
    for (let x = 0; x < waves.length; x++) {
      for (const y of waves[x]) {
        if (!fits(c, x, y)) continue;
        const z = waves.findIndex((_, i) => i !== x && fits(y, i));
        if (z < 0) continue;
        waves[x][waves[x].indexOf(y)] = c;
        waves[z].push(y);
        return true;
      }
    }
    return false;
  };
  for (const c of cands) {
    if (waves.every((w, i) => w.length >= sizes[i])) break;
    place(c);
  }
  return waves.filter((w) => w.length >= 2);
}

/**
 * 15 pairs (40 in a sprint) in waves of five. Words come from vocabPool (due
 * and learning words first, in topic runs) and only short ones fit a tile.
 */
export function buildMatchItems(s: AppState, n = ROUND, rnd: () => number = Math.random): MatchItem[] {
  const variant = matchVariant(s);
  let cands = variant === 'verb' ? verbCands(s, rnd) : variant === 'letter' ? letterCands(s, rnd) : wordCands(s, n, rnd);
  // Words come in topic runs: put them best first again (the sort is stable).
  if (variant === 'word') cands = [...cands].sort((a, b) => a.rank - b.rank);
  // One tile per Hebrew spelling in a round, the better one kept. Letters go by
  // the letter itself: a final (ך) is its own card, though lenient() reads it
  // as כ (the wave rule still keeps the two apart).
  const seen = new Set<string>();
  cands = cands.filter((c) => {
    const k = variant === 'letter' ? c.he : lenient(c.he);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (variant === 'word') {
    // The best n in topic runs, so a wave tends to share a topic; the rest
    // stand by, best first, for places a clash leaves open.
    const best = cands.slice(0, n);
    const topics = [...new Set(best.map((c) => c.topic))];
    cands = [...topics.flatMap((t) => best.filter((c) => c.topic === t)), ...cands.slice(n)];
  }
  return assignWaves(cands, n).flatMap((wave, w) =>
    wave.map((c) => ({ key: c.key, he: c.he, en: c.show, cardId: c.cardId, wave: w, kind: c.kind, ...(c.tr ? { tr: c.tr } : {}), ...(c.sub ? { sub: c.sub } : {}) })),
  );
}

/** The English column of a wave: shuffled by key, never in the Hebrew column's order. */
export function englishOrder<T extends { key: string }>(wave: T[]): T[] {
  const out = [...wave].sort((a, b) => hashSeed(a.key) - hashSeed(b.key) || (a.key < b.key ? -1 : 1));
  if (out.length > 1 && out.every((x, i) => x.key === wave[i].key)) out.push(out.shift()!);
  return out;
}

const skillOf = (it: MatchItem) => (it.kind === 'verb' ? 'verbs' : 'vocab');
const spoken = (it: MatchItem) => (it.kind === 'letter' ? (LETTERS.find((l) => l.ch === it.he)?.name ?? it.he) : it.he);

type Side = 'he' | 'en';

export function MatchGame({ mode }: GameProps) {
  const sprint = mode === 'sprint';
  const round = useRound<MatchItem>({
    game: 'match',
    mode,
    tier: 'tap',
    build: () => buildMatchItems(getState(), sprint ? SPRINT : ROUND),
    sprintSec: sprint ? SPRINT_SEC : undefined,
  });
  // Which pairs are matched and which had a miss: the round only says how many,
  // so they are kept here (and read back from the saved round on resume).
  const book = useRef<{ id: number; items: MatchItem[]; done: Set<string>; missed: Set<string> } | null>(null);
  if (!book.current || book.current.items !== round.items) {
    const saved = round.resumed ? loadRound<MatchItem>('match', mode) : null;
    const same = !!saved && saved.items.length === round.items.length && saved.items.every((x, i) => x.key === round.items[i]?.key);
    book.current = {
      id: (book.current?.id ?? 0) + 1,
      items: round.items,
      done: new Set(same ? round.items.filter((_, i) => saved!.results[i]).map((x) => x.key) : []),
      missed: new Set(same ? saved!.missed.map((i) => round.items[i]?.key).filter(Boolean) : []),
    };
  }
  const { id: rid, done, missed } = book.current;
  // Tap state, tagged with its round so nothing carries over into Again.
  const [selAt, setSel] = useState<{ rid: number; side: Side; key: string; wave: number } | null>(null);
  const [wrongAt, setWrong] = useState<{ rid: number; he: string; en: string } | null>(null);
  const [lastAt, setLast] = useState<{ rid: number; key: string; ok: boolean } | null>(null);
  const [live, setLive] = useState('');
  const sel = selAt?.rid === rid ? selAt : null;
  const wrong = wrongAt?.rid === rid ? wrongAt : null;
  const last = lastAt?.rid === rid ? lastAt : null;
  const it = round.item;
  const wave = it?.wave ?? -1;
  const fresh = useBumpGuard(`${rid}:${wave}`);
  const waves = round.items.length ? round.items[round.items.length - 1].wave + 1 : 0;
  const tiles = round.items.map((x, i) => ({ x, i })).filter(({ x }) => x.wave === wave);
  const left = tiles.filter(({ x }) => !done.has(x.key)).length;
  const english = englishOrder(tiles.map(({ x }) => x));
  const cleared = !!it && round.status === true && left === 0;
  const locked = fresh || round.status !== null || !!round.summary;
  const pick = sel && sel.wave === wave && !done.has(sel.key) ? sel : null;

  // A wrong pair shakes for a moment.
  useEffect(() => {
    if (!wrongAt) return;
    const t = setTimeout(() => setWrong(null), 450);
    return () => clearTimeout(t);
  }, [wrongAt]);

  const evidence = (x: MatchItem, ok: boolean): Evidence[] => [{ tier: 'tap', ok, skill: skillOf(x), cardId: x.cardId }];

  const attempt = (heKey: string, enKey: string) => {
    setSel(null);
    const i = round.items.findIndex((x) => x.key === heKey);
    const x = round.items[i];
    if (!x) return;
    if (heKey === enKey) {
      const clean = !missed.has(heKey);
      done.add(heKey);
      setLast({ rid, key: heKey, ok: true });
      setLive(`${x.he} = ${x.en}. ${left - 1 ? `${left - 1} left.` : 'Wave cleared!'}`);
      round.answer({ index: i, ok: true, evidence: clean ? evidence(x, true) : undefined, miss: `${x.he} → ${x.en}` }, left <= 1 ? 'auto' : 'now');
      say(spoken(x));
      return;
    }
    const other = round.items.find((y) => y.key === enKey);
    missed.add(heKey);
    setWrong({ rid, he: heKey, en: enKey });
    setLast({ rid, key: heKey, ok: false });
    setLive(`Not a pair: ${x.he} isn't ${other?.en ?? ''}.`);
    round.miss(evidence(x, false), i);
  };

  const tap = (side: Side, key: string) => {
    if (locked || done.has(key)) return;
    if (pick && pick.side !== side) {
      attempt(side === 'he' ? key : pick.key, side === 'en' ? key : pick.key);
      return;
    }
    if (pick?.key === key) {
      setSel(null);
      return;
    }
    setSel({ rid, side, key, wave });
    const x = round.items.find((y) => y.key === key);
    setLive(x ? `${side === 'he' ? x.he : x.en} picked: now its pair.` : '');
  };

  // The tap that is right next (data-ok): any Hebrew tile, or the twin of the pick.
  const okFor = (side: Side, key: string) => (pick ? pick.side !== side && pick.key === key : side === 'he');

  const tile = (side: Side, x: MatchItem, n: number) => {
    const gone = done.has(x.key);
    const cls = [
      'match-tile',
      side,
      x.kind === 'letter' && side === 'he' ? 'letter' : '',
      side === 'he' && x.he.length > 9 ? 'long' : '',
      side === 'en' && x.en.length > 16 ? 'long' : '',
      gone ? 'gone' : '',
      !gone && pick?.side === side && pick.key === x.key ? 'sel' : '',
      !gone && wrong && wrong[side] === x.key ? 'bad' : '',
    ]
      .filter(Boolean)
      .join(' ');
    // A matched tile keeps its cell (nothing shifts under the thumb) and fades out.
    if (gone) {
      return (
        <span key={`${side}:${x.key}`} class={cls} style={{ gridRow: n + 1 }} aria-hidden="true" data-gone={x.key} lang={side === 'he' ? 'he' : undefined} dir={side === 'he' ? 'rtl' : undefined}>
          {side === 'he' ? x.he : x.en}
        </span>
      );
    }
    return (
      <button
        key={`${side}:${x.key}`}
        type="button"
        class={cls}
        style={{ gridRow: n + 1 }}
        lang={side === 'he' ? 'he' : undefined}
        dir={side === 'he' ? 'rtl' : undefined}
        data-pair={x.key}
        data-side={side}
        data-ok={okFor(side, x.key) ? 'true' : undefined}
        aria-pressed={pick?.side === side && pick.key === x.key}
        disabled={locked}
        onClick={() => tap(side, x.key)}
      >
        {side === 'he' ? x.he : x.en}
      </button>
    );
  };

  let prompt = null;
  if (it) {
    const shown = last ? round.items.find((x) => x.key === last.key) : undefined;
    const mood = cleared || last?.ok ? 'cheer' : last && !last.ok ? 'oops' : 'idle';
    prompt = (
      <div class="match-stage">
        <ol class="match-waves" aria-label={`Wave ${wave + 1} of ${waves}`}>
          {Array.from({ length: waves }, (_, w) => (
            <li key={w} class={w < wave ? 'done' : w === wave ? (cleared ? 'done now' : 'now') : ''} aria-hidden="true" />
          ))}
        </ol>
        <div class="match-echo" key={`${wave}:${last?.key ?? ''}:${last?.ok ?? ''}`}>
          <Shorshi mood={mood} size={44} />
          {cleared ? (
            <div class="match-cleared">
              <span class="he" lang="he" dir="rtl">
                {wave + 1 >= waves ? 'סיימת!' : 'יש!'}
              </span>{' '}
              {wave + 1 >= waves ? 'All pairs matched' : 'Wave cleared'}
            </div>
          ) : shown && last?.ok ? (
            <div class="match-pair">
              <div class={`he-game ${shown.kind === 'letter' ? 'letter' : ''}`} lang="he" dir="rtl">
                {shown.he}
              </div>
              <div class="match-pair-en">
                = <b>{shown.en}</b>
                {shown.tr && <span class="match-tr"> · {shown.tr}</span>}
              </div>
              {shown.sub && (
                <div class="match-sub he" lang="he" dir="rtl">
                  {shown.sub}
                </div>
              )}
            </div>
          ) : shown ? (
            <div class="match-nope">
              Not a pair. Find <b lang="he">{shown.he}</b>'s twin.
            </div>
          ) : (
            <div class="match-ask">
              {round.answered === 0 ? (
                <>
                  Tap a word, then its twin.
                  <span class="match-ask-sub">{waves > 1 ? `${round.total} pairs in ${waves} waves` : `${round.total} pairs`}</span>
                </>
              ) : (
                <>Next wave: {left} pairs</>
              )}
            </div>
          )}
        </div>
      </div>
    );
  } else if (!round.total) prompt = <p class="muted">No words to match yet: learn a few in Words first.</p>;

  const controls = it && (
    <div class="match-board" key={`${rid}:${wave}`} role="group" aria-label={`Wave ${wave + 1}: ${left} pairs left`} style={{ gridTemplateRows: `repeat(${tiles.length}, minmax(56px, auto))` }}>
      {english.map((x, n) => tile('en', x, n))}
      {tiles.map(({ x }, n) => tile('he', x, n))}
    </div>
  );

  return <GameShell game="match" mode={mode} round={round} prompt={prompt} controls={controls} live={live || undefined} />;
}

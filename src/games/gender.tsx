// He or She? (זכר או נקבה): a noun drops onto the scale; tap נקבה ♀ (left) or
// זכר ♂ (right), always in the same place. About 40 % are surprises (עיר is
// feminine, לילה masculine), and every 5th noun asks for its plural instead:
// the real one or the ים↔ות swap (שולחנות or שולחנים?).
import './gender.css';
import { useState } from 'preact/hooks';
import type { VocabItem } from '../content/types.ts';
import { vocab } from '../lib/content.ts';
import { lenient } from '../lib/hebrew.ts';
import { type AppState, getState } from '../lib/store.ts';
import { type Evidence, type GameProps, isSingleWord, levelOk, sameForm, say, shuffle } from './kit.ts';
import { type Choice, ChoiceGrid, GameShell, Shorshi, useRound } from './kit-ui.tsx';

export interface GenderItem {
  key: string; // `${vocabId}:${kind}`
  vocabId: string;
  he: string;
  en: string;
  kind: 'gender' | 'plural';
  gender: 'm' | 'f';
  plural?: string;
  options: string[]; // gender: ['f', 'm'] (נקבה left, זכר right); plural: the real one and the swap, shuffled
  surprise: boolean;
}

const ROUND = 15;
const SURPRISE_SHARE = 0.4;
const TOPIC = 'g_a1_gender_plural';
const GENDER_KEYS = ['f', 'm'];
const NAME = { m: 'זכר', f: 'נקבה' } as const;
const SIGN = { m: '♂', f: '♀' } as const;
const ONE = { m: 'אחד', f: 'אחת' } as const;
const EN = { m: 'masculine', f: 'feminine' } as const;

const bare = (tr: string) => tr.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Feminine without ה/ת at the end, or masculine with one. */
export function isSurprise(v: Pick<VocabItem, 'he' | 'gender'>): boolean {
  const end = /[הת]$/.test(v.he.trim());
  return v.gender === 'f' ? !end : end;
}

/** Feminine with ים, or masculine with ות. */
export function isPluralSurprise(v: Pick<VocabItem, 'gender' | 'plural'>): boolean {
  const p = v.plural?.trim() ?? '';
  return v.gender === 'f' ? /ים$/.test(p) : /ות$/.test(p);
}

/** The wrong plural: ים ↔ ות (only for plurals that end in one of them). */
export function pluralSwap(plural: string): string | null {
  const p = plural.trim();
  if (!isSingleWord(p)) return null;
  if (/ים$/.test(p)) return `${p.slice(0, -2)}ות`;
  if (/ות$/.test(p)) return `${p.slice(0, -2)}ים`;
  return null;
}

// Nouns whose spelling (lenient) has more than one gender or plural in the
// content (רוח wind f / רווח profit m): the shown word can't pin them down.
let homographs: { genders: Map<string, Set<string>>; plurals: Map<string, Set<string>> } | null = null;
function homographIndex() {
  if (homographs) return homographs;
  const genders = new Map<string, Set<string>>();
  const plurals = new Map<string, Set<string>>();
  for (const v of vocab) {
    if (v.pos !== 'noun' || !v.gender) continue;
    for (const he of [v.he, ...(v.alt ?? [])]) {
      const k = lenient(he);
      genders.set(k, (genders.get(k) ?? new Set()).add(v.gender));
      if (v.plural) plurals.set(k, (plurals.get(k) ?? new Set()).add(lenient(v.plural)));
    }
  }
  homographs = { genders, plurals };
  return homographs;
}

/**
 * Nouns the game can ask about: one word, a gender, at the learner's level.
 * Left out: nouns whose gender the content gives as either (פנים), words that
 * are plural in form with no singular (מים, משקפיים, חבר׳ה), and spellings
 * shared with a noun of the other gender.
 */
export function genderPool(s: AppState): VocabItem[] {
  const { genders } = homographIndex();
  return vocab.filter((v) => {
    if (v.pos !== 'noun' || !v.gender || !isSingleWord(v.he) || !levelOk(v.level, s)) return false;
    if (/feminine or masculine|masculine or feminine|either gender/i.test(v.note ?? '')) return false;
    if (!v.plural && (/(im|ot|ayim)$/.test(bare(v.tr)) || /plural in (form|meaning)|always plural/i.test(v.note ?? ''))) return false;
    return (genders.get(lenient(v.he))?.size ?? 0) <= 1;
  });
}

/** The plural question for a noun, or null if its plural has no clean ים/ות swap. */
export function pluralItemFor(v: VocabItem, rnd: () => number = Math.random): GenderItem | null {
  if (!v.gender || !v.plural) return null;
  const swap = pluralSwap(v.plural);
  if (!swap || sameForm(swap, v.plural) || sameForm(swap, v.he)) return null;
  // Never a spelling the content gives as a plural of this word (or of a homograph).
  const known = homographIndex().plurals.get(lenient(v.he));
  if (known?.has(lenient(swap)) || (v.alt ?? []).some((a) => sameForm(a, swap))) return null;
  return {
    key: `${v.id}:plural`,
    vocabId: v.id,
    he: v.he,
    en: v.en,
    kind: 'plural',
    gender: v.gender,
    plural: v.plural.trim(),
    options: shuffle([v.plural.trim(), swap], rnd),
    surprise: isPluralSurprise(v),
  };
}

export function genderItemFor(v: VocabItem): GenderItem | null {
  if (!v.gender) return null;
  return {
    key: `${v.id}:gender`,
    vocabId: v.id,
    he: v.he,
    en: v.en,
    kind: 'gender',
    gender: v.gender,
    plural: v.plural?.trim() || undefined,
    options: [...GENDER_KEYS],
    surprise: isSurprise(v),
  };
}

/**
 * 15 nouns: every 5th asks for the plural (surprising plurals first: f + ים,
 * m + ות); of the rest about 40 % are gender surprises. Words the learner has
 * cards for come first, so the game is about gender, not meaning.
 */
export function buildGenderItems(s: AppState, n = ROUND, rnd: () => number = Math.random): GenderItem[] {
  // One noun per spelling in a round (two entries can share one: ספר book / barber).
  const seen = new Set<string>();
  const pool = genderPool(s).filter((v) => {
    const k = lenient(v.he);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const carded = (v: VocabItem) => (s.cards[`v:${v.id}`] ? 0 : 1);
  const ranked = (xs: VocabItem[], first: (v: VocabItem) => number = () => 0) =>
    shuffle(xs, rnd).sort((a, b) => first(a) - first(b) || carded(a) - carded(b));
  const slots = Array.from({ length: n }, (_, i) => (i % 5 === 4 ? 'plural' : 'gender'));
  const plural: GenderItem[] = [];
  for (const v of ranked(pool, (x) => (isPluralSurprise(x) ? 0 : 1))) {
    if (plural.length >= slots.filter((x) => x === 'plural').length) break;
    const it = pluralItemFor(v, rnd);
    if (it) plural.push(it);
  }
  const used = new Set(plural.map((x) => x.vocabId));
  const rest = pool.filter((v) => !used.has(v.id));
  const nGender = n - plural.length;
  const sur = ranked(rest.filter(isSurprise));
  const reg = ranked(rest.filter((v) => !isSurprise(v)));
  const k = Math.min(sur.length, Math.max(Math.round(nGender * SURPRISE_SHARE), nGender - reg.length));
  const gender = shuffle([...sur.slice(0, k), ...reg.slice(0, nGender - k)], rnd)
    .map(genderItemFor)
    .filter((x): x is GenderItem => !!x);
  const out: GenderItem[] = [];
  for (const slot of slots) {
    const next = slot === 'plural' && plural.length ? plural.shift() : gender.shift() ?? plural.shift();
    if (next) out.push(next);
  }
  return out;
}

function surpriseNote(it: GenderItem): string | null {
  if (!it.surprise) return null;
  if (it.kind === 'plural') return it.gender === 'm' ? 'masculine, but its plural ends in ות' : 'feminine, but its plural ends in ים';
  return it.gender === 'f' ? "feminine, though it doesn't end in ה/ת" : 'masculine, though it ends in ה/ת';
}

// "עיר אחת · ערים"
const reveal = (it: GenderItem) => `${it.he} ${ONE[it.gender]}${it.plural ? ` · ${it.plural}` : ''}`;

export function GenderGame({ mode }: GameProps) {
  const round = useRound<GenderItem>({ game: 'gender', mode, tier: 'tap', build: () => buildGenderItems(getState()) });
  const [pick, setPick] = useState<{ key: string; k: string } | null>(null);
  const it = round.item;
  const picked = it && pick?.key === it.key ? pick.k : null;
  const status = picked !== null ? round.status : null;
  const right = it ? (it.kind === 'gender' ? it.gender : it.plural!) : '';

  const onPick = (c: Choice) => {
    if (!it || round.status !== null) return;
    setPick({ key: it.key, k: c.k });
    const evidence: Evidence[] = [{ tier: 'tap', ok: c.ok, skill: 'grammar', topics: [TOPIC], cardId: null }];
    const miss = it.kind === 'gender' ? `${it.he} → ${NAME[it.gender]}` : `${it.he} → ${it.plural}`;
    round.answer({ ok: c.ok, evidence, miss }, it.surprise ? 'read' : 'auto');
    say(it.kind === 'gender' ? `${it.he} ${ONE[it.gender]}` : `${it.he}, ${it.plural}`, it.gender);
  };

  let prompt = null;
  if (it) {
    const note = status !== null ? surpriseNote(it) : null;
    const tilt = status !== null ? it.gender : '';
    prompt = (
      <div class="gender-stage">
        <div class="gender-ask">
          {it.kind === 'gender' ? (
            <>
              <span class="he" lang="he" dir="rtl">
                זכר או נקבה?
              </span>{' '}
              · masculine or feminine?
            </>
          ) : (
            <>
              <span class="he" lang="he" dir="rtl">
                ברבים?
              </span>{' '}
              · which plural?
            </>
          )}
        </div>
        <div class={`gender-scale ${it.kind} ${tilt ? `tilt-${tilt}` : ''} ${status === true ? 'ok' : status === false ? 'bad' : ''}`} key={it.key} data-vocab={it.vocabId} data-kind={it.kind}>
          <div class="gender-word">
            <div class="he-game" lang="he" dir="rtl">
              {it.he}
            </div>
            <div class="gender-en">
              {it.en}
              {it.kind === 'plural' && (
                <span class={`gender-tag ${it.gender}`}>
                  {SIGN[it.gender]} {EN[it.gender]}
                </span>
              )}
            </div>
          </div>
          {it.kind === 'gender' && (
            <div class="gender-beam" aria-hidden="true">
              <div class="beam">
                <span class="pan f">{SIGN.f}</span>
                <span class="bar" />
                <span class="pan m">{SIGN.m}</span>
              </div>
              <span class="pivot" />
            </div>
          )}
        </div>
        <div class="gender-reveal" aria-hidden={status === null ? 'true' : undefined}>
          {status === null ? (
            <span class="gender-hint">{round.answered === 0 ? (it.kind === 'gender' ? 'Tap ♀ or ♂ below' : 'Tap the right plural') : ' '}</span>
          ) : (
            <>
              <div class="gender-say">
                <Shorshi mood={status ? 'cheer' : 'oops'} size={36} />
                <span class="he" lang="he" dir="rtl">
                  {reveal(it)}
                </span>
              </div>
              {note && <div class="gender-surprise">😮 Surprise: {note}</div>}
            </>
          )}
        </div>
      </div>
    );
  } else if (!round.total) prompt = <p class="muted">No nouns to sort at your level yet.</p>;

  const choices: Choice[] = !it
    ? []
    : it.kind === 'gender'
      ? (it.options as ('m' | 'f')[]).map((g) => ({
          k: g,
          ok: g === it.gender,
          label: (
            <span class={`gender-key ${g}`}>
              <span class="sym" aria-hidden="true">
                {SIGN[g]}
              </span>
              <span class="he" lang="he" dir="rtl">
                {NAME[g]}
              </span>
            </span>
          ),
          sub: EN[g],
        }))
      : it.options.map((o) => ({ k: o, label: o, ok: sameForm(o, right), he: true }));
  const controls = it && (
    <div class={`gender-keys ${it.kind}`}>
      <ChoiceGrid choices={choices} cols={2} picked={picked} locked={round.status !== null} onPick={onPick} />
    </div>
  );
  const live =
    it && status !== null
      ? `${status ? 'Right!' : 'Not quite.'} ${it.he} is ${EN[it.gender]}${it.plural ? `, plural ${it.plural}` : ''}.${round.lastGain ? ` +${round.lastGain} XP.` : ''}`
      : undefined;

  return <GameShell game="gender" mode={mode} round={round} prompt={prompt} controls={controls} live={live} />;
}

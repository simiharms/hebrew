// Card decks: groups of flash cards to study on their own. Word cards share
// their schedule with the daily word reviews (v:<id>); verb cards teach a
// verb's key forms (vp:<id>); letter cards teach the alphabet (a:<letter>).
import type { Verb, VocabItem } from '../content/types.ts';
import { WORD_LEVELS } from '../content/types.ts';
import { LETTERS } from './alphabet.ts';
import { allVocab, findVocab, levelRank, TOPIC_LABELS, verbById, verbs } from './content.ts';
import { getState } from './store.ts';

export type DeckGroup = 'Start here' | 'Words by topic' | 'Words by level' | 'Verbs' | 'Yours';

export interface Card {
  id: string; // scheduler key in AppState.cards
  he: string; // Hebrew side
  en: string; // English side
  tr?: string;
  sub?: string; // a line under the answer (gender, plural, sound…)
  ex?: { he: string; en: string };
  forms?: [string, string][]; // verb cards: [label, form]
  speak: string; // what the speaker button reads
  vocab?: VocabItem;
  verb?: Verb;
}

export interface Deck {
  id: string;
  group: DeckGroup;
  title: string;
  sub: string;
  kind: 'words' | 'verbs' | 'letters';
  cards: () => Card[];
}

export function vocabCard(v: VocabItem): Card {
  const sub = [v.gender && (v.gender === 'm' ? 'masculine' : 'feminine'), v.plural && `plural ${v.plural}`].filter(Boolean).join(' · ');
  return { id: `v:${v.id}`, he: v.he, en: v.en, tr: v.tr, sub: sub || undefined, ex: v.ex, speak: v.he, vocab: v };
}

export function verbCard(v: Verb): Card {
  const forms: [string, string][] = [
    ['הוא · הווה', v.present.ms[0]],
    ['הוא · עבר', v.past['3ms'][0]],
    ['הוא · עתיד', v.future['3ms'][0]],
  ];
  if (v.imp) forms.push(['ציווי (אתה)', v.imp.ms[0]]);
  return {
    id: `vp:${v.id}`,
    he: v.inf,
    en: v.en,
    tr: v.tr,
    sub: v.gov ? `+ ${v.gov}` : undefined,
    ex: v.ex,
    forms,
    speak: v.inf,
    verb: v,
  };
}

function letterCards(): Card[] {
  return LETTERS.map((l) => ({
    id: `a:${l.ch}`,
    he: l.ch,
    en: `${l.name} (${l.nameTr}): ${l.sound}`,
    sub: `${l.ex} · ${l.exTr} · ${l.exEn}`,
    speak: l.ex,
  }));
}

const BINYANIM: [string, string, string][] = [
  ['paal', "Pa'al", 'The basic binyan: לכתוב, לגור, לקנות'],
  ['piel', "Pi'el", 'Intensive and new verbs: לדבר, לטייל, לסדר'],
  ['hifil', "Hif'il", 'Making things happen: להתחיל, להזמין, להביא'],
  ['hitpael', "Hitpa'el", 'Reflexive and mutual: להתלבש, להתקשר, להשתמש'],
  ['nifal', "Nif'al", 'Passive and “getting”: להיכנס, להיפגש, להירדם'],
];

const sortByLevel = <T extends { level: string }>(xs: T[]) => [...xs].sort((a, b) => levelRank(a.level) - levelRank(b.level));

let cache: Deck[] | null = null;

export function allDecks(): Deck[] {
  if (cache) return cache;
  const vocab = allVocab().filter((v) => v.topic !== 'custom');
  const decks: Deck[] = [
    { id: 'alpha', group: 'Start here', title: 'The alphabet', sub: 'Every letter, its sound and the five final forms', kind: 'letters', cards: letterCards },
  ];
  // Topics, easiest first.
  const topics = [...new Set(vocab.map((v) => v.topic))]
    .map((t) => {
      const items = vocab.filter((v) => v.topic === t);
      return { t, items, rank: items.reduce((a, v) => a + levelRank(v.level), 0) / items.length };
    })
    .filter((x) => x.items.length >= 5)
    .sort((a, b) => a.rank - b.rank);
  for (const { t, items } of topics) {
    const lv = [...new Set(sortByLevel(items).map((v) => v.level))];
    decks.push({
      id: `t:${t}`,
      group: 'Words by topic',
      title: TOPIC_LABELS[t] ?? t,
      sub: `${items.length} words · ${lv.length > 1 ? `${lv[0]}–${lv[lv.length - 1]}` : lv[0]}`,
      kind: 'words',
      cards: () => sortByLevel(items).map(vocabCard),
    });
  }
  for (const l of WORD_LEVELS) {
    const items = vocab.filter((v) => v.level === l);
    if (items.length) decks.push({ id: `l:${l}`, group: 'Words by level', title: `${l} words`, sub: `${items.length} words, all topics`, kind: 'words', cards: () => items.map(vocabCard) });
  }
  const verbDeck = (id: string, title: string, sub: string, list: Verb[]) =>
    list.length && decks.push({ id, group: 'Verbs', title, sub: `${list.length} verbs · ${sub}`, kind: 'verbs', cards: () => sortByLevel(list).map(verbCard) });
  verbDeck('v:essential', 'Essential verbs', 'the A1–A2 verbs you need first', verbs.filter((v) => ['A1', 'A2'].includes(v.level)));
  for (const [b, title, sub] of BINYANIM) verbDeck(`v:${b}`, title, sub, verbs.filter((v) => v.binyan === b));
  verbDeck('v:weak', 'Irregular & weak verbs', 'the ones that break the pattern', verbs.filter((v) => v.gizra && !/regular|שלמים/.test(v.gizra)));
  verbDeck('v:prep', 'Verbs + preposition', 'מחכה ל, מתקשר ל, משתמש ב', verbs.filter((v) => v.gov && v.gov !== 'את'));
  verbDeck('v:advanced', 'Advanced verbs', 'B2–C1', verbs.filter((v) => ['B2', 'C1'].includes(v.level)));
  decks.push({
    id: 'my:starred',
    group: 'Yours',
    title: '⭐ Starred',
    sub: 'Cards you starred while studying',
    kind: 'words',
    cards: () => getState().starred.map(cardById).filter(Boolean) as Card[],
  });
  decks.push({
    id: 'my:hard',
    group: 'Yours',
    title: '🩹 Hard cards',
    sub: "Words and verbs you've forgotten at least once",
    kind: 'words',
    cards: () =>
      Object.entries(getState().cards)
        .filter(([id, c]) => c.lapses > 0 && (id.startsWith('v:') || id.startsWith('vp:')))
        .sort((a, b) => b[1].lapses - a[1].lapses)
        .map(([id]) => cardById(id))
        .filter(Boolean) as Card[],
  });
  cache = decks;
  return decks;
}

export function deckById(id: string): Deck | undefined {
  return allDecks().find((d) => d.id === id);
}

export function cardById(id: string): Card | undefined {
  if (id.startsWith('v:')) {
    const v = findVocab(id.slice(2));
    return v && vocabCard(v);
  }
  if (id.startsWith('vp:')) {
    const v = verbById.get(id.slice(3));
    return v && verbCard(v);
  }
  if (id.startsWith('a:')) return letterCards().find((c) => c.id === id);
  return undefined;
}

/** Cards to study now: due ones first, then up to `maxNew` new ones. */
export function deckQueue(deck: Deck, maxNew = 10, maxDue = 40, now = Date.now()): Card[] {
  const cards = getState().cards;
  const all = deck.cards();
  const due = all.filter((c) => cards[c.id] && cards[c.id].due <= now).sort((a, b) => cards[a.id].due - cards[b.id].due);
  const fresh = all.filter((c) => !cards[c.id]).slice(0, maxNew);
  return [...due.slice(0, maxDue), ...fresh];
}

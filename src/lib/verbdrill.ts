// Verb practice beyond "conjugate this": use the form in a sentence, recognise
// a form, hear it, find its infinitive or binyan. Production tasks (conjugate,
// context, listen) feed the c:<verb>:<tense> schedule; recognition tasks only
// update the skill profile.
import type { Binyan, Form, Verb } from '../content/types.ts';
import { verbById } from './content.ts';
import { lenient, splitWords } from './hebrew.ts';
import {
  buildVerbSession,
  drillable,
  FUTURE_PRONOUNS,
  makeVerbTask,
  PERSON_PRONOUNS,
  PRESENT_PRONOUNS,
  type Tense,
  TENSES,
  type VerbTask,
} from './session.ts';
import { getState } from './store.ts';
import { ttsSupported } from './tts.ts';

export type VKind = 'conjugate' | 'context' | 'identify' | 'infinitive' | 'binyan' | 'listen';
export type TenseKey = Tense | 'imp';

export const VKINDS: { id: VKind; label: string; sub: string; emoji: string }[] = [
  { id: 'conjugate', label: 'Conjugate', sub: 'Pronoun + tense → type the form', emoji: '⌨️' },
  { id: 'context', label: 'In a sentence', sub: 'Fill the verb into a real sentence', emoji: '🧩' },
  { id: 'identify', label: 'Recognise the form', sub: 'Which tense and person is נכתוב?', emoji: '🔎' },
  { id: 'listen', label: 'Listen and type', sub: 'Hear a form, write it', emoji: '🎧' },
  { id: 'infinitive', label: 'Back to the infinitive', sub: 'הלכתי → ללכת', emoji: '↩️' },
  { id: 'binyan', label: 'Which binyan?', sub: "Spot pa'al, pi'el, hif'il…", emoji: '🏗️' },
];

export const PRODUCTION: VKind[] = ['conjugate', 'context', 'listen'];

export interface VTask extends VerbTask {
  kind: VKind;
  shown?: Form; // identify / infinitive / binyan: the form on screen
  sentence?: { he: string; en: string; form: string; gap: string }; // context: gap = he with ___
}

const rand = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

export function tableOf(v: Verb, t: TenseKey): Record<string, Form> | undefined {
  return (t === 'imp' ? v.imp : v[t]) as Record<string, Form> | undefined;
}

/** Every tense/person of this verb written exactly like `form` (forms are often ambiguous: כתבת, תכתוב). */
export function analyses(v: Verb, form: string): { tense: TenseKey; person: string }[] {
  const key = lenient(form);
  const out: { tense: TenseKey; person: string }[] = [];
  for (const t of ['present', 'past', 'future', 'imp'] as TenseKey[]) {
    for (const [person, f] of Object.entries(tableOf(v, t) ?? {})) if (lenient(f[0]) === key) out.push({ tense: t, person });
  }
  return out;
}

const TIME_CUE: Record<Tense, [string, string]> = {
  past: ['אתמול', 'Yesterday'],
  present: ['עכשיו', 'Right now'],
  future: ['מחר', 'Tomorrow'],
};

// Prefixes that can stand in front of a conjugated verb. Not ל/ב/מ/כ: ל + הסביר
// is the infinitive להסביר, not a past form.
const VERB_PREFIXES = ['וכש', 'כש', 'וש', 'שה', 'ו', 'ש', 'ה'];

/**
 * The sentence with the verb form replaced by ___ (a prefix such as ו or ש
 * stays in front of the gap), or null if the form isn't a word in it.
 */
export function blankForm(sentence: string, form: string): string | null {
  const target = lenient(form);
  let out = '';
  let found = false;
  for (const p of splitWords(sentence)) {
    if (!found && p.isWord) {
      const prefix = ['', ...VERB_PREFIXES].find((x) => p.w.startsWith(x) && lenient(p.w.slice(x.length)) === target);
      if (prefix !== undefined) {
        out += `${prefix}___`;
        found = true;
        continue;
      }
    }
    out += p.w;
  }
  return found ? out : null;
}

/** A sentence with this verb in this tense: one of the verb's examples, or a simple time-cue sentence. */
export function contextSentence(t: VerbTask): { he: string; en: string; form: string; gap: string } {
  const v = t.verb;
  const forms = Object.values(tableOf(v, t.tense) ?? {}).map((f) => f[0]);
  const options: { he: string; en: string; form: string; gap: string }[] = [];
  for (const e of [...(v.exs ?? []), ...(v.ex ? [{ ...v.ex, form: '' }] : [])]) {
    for (const form of e.form ? [e.form] : forms) {
      if (!analyses(v, form).some((a) => a.tense === t.tense)) continue;
      const gap = blankForm(e.he, form);
      if (gap) {
        options.push({ he: e.he, en: e.en, form, gap });
        break;
      }
    }
  }
  if (options.length) return rand(options);
  const [cue, cueEn] = TIME_CUE[t.tense];
  const he = `${cue} ${t.pronoun} ${t.answer[0]}.`;
  return { he, en: `${cueEn}, ${t.pronounEn} … (${v.en.replace(/^to /, '')}).`, form: t.answer[0], gap: `${cue} ${t.pronoun} ___.` };
}

/** Turn a conjugation task into a task of another kind about the same verb and tense. */
export function asKind(t: VerbTask, kind: VKind): VTask {
  if (kind === 'context') {
    // The sentence decides the person: grade against the form it needs.
    const sentence = contextSentence(t);
    const a = analyses(t.verb, sentence.form).find((x) => x.tense === t.tense);
    const table = tableOf(t.verb, t.tense);
    if (!a || a.person === t.person || !table?.[a.person]) return { ...t, kind, sentence };
    const pronouns = (t.tense === 'present' ? PRESENT_PRONOUNS : t.tense === 'future' ? FUTURE_PRONOUNS : PERSON_PRONOUNS)[a.person];
    const [pronoun, pronounEn] = pronouns?.[0] ?? [t.pronoun, t.pronounEn];
    return { ...t, kind, sentence, person: a.person, answer: table[a.person], pronoun, pronounEn };
  }
  if (kind === 'identify' || kind === 'infinitive' || kind === 'binyan') return { ...t, kind, shown: t.answer };
  return { ...t, kind };
}

const MIX: [VKind, number][] = [
  ['conjugate', 3],
  ['context', 3],
  ['identify', 2],
  ['listen', 1],
  ['infinitive', 1],
  ['binyan', 1],
];

function pickKind(isNew: boolean, only?: VKind[]): VKind {
  const allowed = (only ?? MIX.map(([k]) => k)).filter((k) => k !== 'listen' || ttsSupported());
  if (!allowed.length) return 'conjugate';
  if (!only && isNew) return Math.random() < 0.6 ? 'conjugate' : 'context';
  const weighted = MIX.filter(([k]) => allowed.includes(k));
  let r = Math.random() * weighted.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of weighted) if ((r -= w) <= 0) return k;
  return weighted[0][0];
}

/**
 * The daily verb session (due verb-tenses + a few new ones, weakest binyan and
 * tense first) with a mix of exercise kinds; `only` restricts the kinds.
 */
export function buildVerbTrainer(only?: VKind[], size = 12): VTask[] {
  const cards = getState().cards;
  return buildVerbSession(undefined, size).map((t) => asKind(t, pickKind(!cards[t.cardId], only)));
}

/** Mixed practice over a fixed set of verbs (a deck, a unit, one verb). */
export function buildVerbSetTrainer(list: Verb[], size = 12, only?: VKind[]): VTask[] {
  const tasks: VTask[] = [];
  if (!list.length) return tasks;
  const order = [...list].sort(() => Math.random() - 0.5);
  for (let i = 0; i < size; i++) {
    const v = order[i % order.length];
    const tenses = TENSES.filter((t) => drillable(v, t));
    if (!tenses.length) continue;
    tasks.push(asKind(makeVerbTask(v, rand(tenses)), pickKind(false, only)));
  }
  return tasks;
}

export function verbsOfDeck(cards: { verb?: Verb }[]): Verb[] {
  return cards.map((c) => c.verb).filter(Boolean) as Verb[];
}

export function verbsByIds(ids: string[]): Verb[] {
  return ids.map((id) => verbById.get(id)).filter(Boolean) as Verb[];
}

// ---------- Recognition helpers ----------

export const TENSE_CHOICES: [TenseKey, string, string][] = [
  ['present', 'Present', 'הווה'],
  ['past', 'Past', 'עבר'],
  ['future', 'Future', 'עתיד'],
  ['imp', 'Command', 'ציווי'],
];

const PRESENT_LABEL: Record<string, string> = { ms: 'masc. singular', fs: 'fem. singular', mp: 'masc. plural', fp: 'fem. plural' };

/** Person buttons for a tense: [person key, Hebrew label, English label]. */
export function personChoices(t: TenseKey): [string, string, string][] {
  if (t === 'present') return Object.entries(PRESENT_PRONOUNS).map(([k, prs]) => [k, prs.map((p) => p[0]).join(' / '), PRESENT_LABEL[k]]);
  if (t === 'imp') return [['ms', 'אתה', 'you (m)'], ['fs', 'את', 'you (f)'], ['mp', 'אתם / אתן', 'you (pl)']];
  const map = t === 'future' ? FUTURE_PRONOUNS : PERSON_PRONOUNS;
  return Object.entries(map).map(([k, prs]) => [k, prs.map((p) => p[0]).join(' / '), prs.map((p) => p[1]).join(' / ')]);
}

export const BINYAN_CHOICES: [Binyan, string, string][] = [
  ['paal', "Pa'al", 'כתב · כותב · יכתוב'],
  ['piel', "Pi'el", 'דיבר · מדבר · ידבר'],
  ['hifil', "Hif'il", 'הזמין · מזמין · יזמין'],
  ['hitpael', "Hitpa'el", 'התלבש · מתלבש · יתלבש'],
  ['nifal', "Nif'al", 'נכנס · נכנס · ייכנס'],
];

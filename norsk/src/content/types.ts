// Content schemas. Every JSON file in src/content must match these
// (checked by scripts/validate-content.ts).
//
// Norwegian is Bokmål. Feminine nouns use ei and the -a ending (ei bok, boka);
// the en/-en forms are accepted everywhere as well. Class-1 verbs use -et
// (snakket); -a (snakka) is accepted as well.

export type Level = 'A1' | 'A2' | 'B1' | 'B2';
export const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2'];

export type Gender = 'm' | 'f' | 'n';

export type Pos = 'noun' | 'verb' | 'adj' | 'adv' | 'prep' | 'conj' | 'pron' | 'num' | 'phrase' | 'interj' | 'name';

/** Verb class: 1 -et (snakket), 2 -te (spiste), 3 -de (prøvde), 4 -dde (bodde), strong, irregular, modal. */
export type VerbGroup = '1' | '2' | '3' | '4' | 'sterk' | 'uregelm' | 'modal';

export interface Example {
  no: string;
  de: string;
}

export interface Word {
  id: string; // unique, lesson-prefixed: "w01_bil"
  no: string; // dictionary form: noun without article ("bil"), verb infinitive without å ("snakke"), adjective m/f form ("stor")
  de: string; // main German meaning ("Auto", "sprechen", "groß")
  deAlt?: string[]; // other accepted German meanings
  alt?: string[]; // other accepted Norwegian spellings
  pos: Pos;
  gender?: Gender; // nouns
  // nouns: [indefinite sg, definite sg, indefinite pl, definite pl] without article: ["bil", "bilen", "biler", "bilene"].
  //   Nouns without a plural ("melk") give two forms. "/" separates variants: "hus", "huset", "hus", "husa/husene".
  // adjectives: [m/f, neuter, plural/definite] (+ optional comparative, superlative): ["stor", "stort", "store", "større", "størst"]
  forms?: string[];
  // verbs: [presens, preteritum, perfektum participle, imperativ]; "/" separates variants ("kastet/kasta"); "" if none.
  vf?: string[];
  vg?: VerbGroup;
  lesson: number; // 1..23: the lesson that introduces it
  wk?: boolean; // part of the lesson's Wörterkiste theme
  ex?: Example; // an example sentence that uses the word
  note?: string; // German usage tip
}

export interface Line {
  s?: string; // speaker key (dialogues only)
  no: string;
  de: string;
}

export interface GlossEntry {
  no: string; // as it appears in the text (any inflected form, or a phrase)
  de: string;
}

export interface LessonText {
  id: string; // "t01" main text, "x01a" extra text
  title: string;
  titleDe: string;
  kind: 'dialog' | 'prose' | 'letter' | 'email' | 'song' | 'info';
  intro?: string; // German: the situation in one or two sentences
  speakers?: Record<string, { name: string; gender: 'm' | 'f' }>;
  lines: Line[]; // dialogue: one turn per line; otherwise one paragraph per line
  glossary: GlossEntry[];
}

// A true/false statement about the lesson text.
export interface TrueFalse {
  s: string; // Norwegian statement
  de: string;
  a: boolean;
  why: string; // German: what the text actually says
}

// An open question answered in Norwegian. keywords: concept groups, each with
// accepted Norwegian variants (inflections, synonyms); score = groups found / groups.
export interface Question {
  q: string;
  qDe: string;
  answer: string;
  answerDe: string;
  keywords: string[][];
}

// "Find in the text the Norwegian for …": the form exactly as in the text.
export interface FindWord {
  de: string;
  answer: string[];
}

// Translate a German sentence into Norwegian; every listed version counts.
export interface Translate {
  de: string;
  no: string[];
  hint?: string; // German
}

// A gap-fill: prompt has ___ for the gap (exactly one).
export interface Drill {
  prompt: string; // Norwegian sentence with ___, optionally followed by a cue in parentheses: "Hun ___ (bo) i Oslo."
  de: string; // German meaning of the full sentence
  answer: string[]; // accepted fillers, first = canonical
  hint?: string; // German
  explain?: string; // German, shown after answering
}

export interface GrammarTopic {
  id: string; // "g01_pronomen"
  title: string; // German
  titleNo?: string;
  summary: string; // one line, German
  sections: { h: string; body: string; table?: string[][] }[]; // body: German with Norwegian examples in **bold**
  drills: Drill[];
}

export interface WritingTask {
  prompt: string; // German instruction
  minWords: number;
  useWords?: string[]; // Norwegian words to try to use
  checklist?: { de: string; keywords: string[] }[];
  model: string; // model answer in Norwegian
  modelDe: string;
}

// The pronunciation guide (src/content/aussprache.json).
export interface PronunciationGuide {
  intro: string; // German
  sections: { h: string; body: string; table?: string[][]; examples?: Example[] }[];
}

export interface Phrase {
  no: string;
  de: string;
  note?: string;
}

export interface Lesson {
  n: number;
  level: Level;
  title: string; // the book's lesson title (Norwegian)
  titleDe: string;
  place: string;
  goals: string[]; // German: "Du lernst …"
  text: LessonText;
  extra: LessonText[]; // Landeskunde and other texts
  wk: { title: string; titleDe: string; phrases: Phrase[] }; // the Wörterkiste: phrases on the lesson's theme
  grammar: GrammarTopic[];
  tf: TrueFalse[];
  questions: Question[];
  find: FindWord[];
  translate: Translate[];
  summary: Drill[]; // gap-filled summary of the text
  dictation: number[]; // indexes into text.lines that make good dictations
  writing: WritingTask;
}

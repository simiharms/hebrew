// Content schemas. Every JSON file in src/content must match these
// (checked by scripts/validate-content.mjs).

export type Level = 'A2' | 'A2+' | 'B1' | 'B1+' | 'B2';
export const LEVELS: Level[] = ['A2', 'A2+', 'B1', 'B1+', 'B2'];

export type Binyan = 'paal' | 'piel' | 'hifil' | 'hitpael' | 'nifal' | 'pual' | 'hufal';

export interface Example {
  he: string;
  en: string;
}

export interface VocabItem {
  id: string;
  he: string; // unvocalized, ktiv male. Verbs: infinitive (לפגוש)
  tr: string; // transliteration, stressed vowel marked with an acute accent
  en: string; // main English gloss
  enAlt?: string[]; // other accepted English glosses
  alt?: string[]; // other accepted Hebrew spellings/forms
  pos: 'noun' | 'verb' | 'adj' | 'adv' | 'prep' | 'conj' | 'phrase' | 'num' | 'pron' | 'expr';
  gender?: 'm' | 'f'; // nouns
  plural?: string; // nouns
  root?: string; // "פ.ג.ש"
  binyan?: Binyan; // verbs
  gov?: string; // verbs: governed preposition, e.g. "את", "ל", "עם", "על"
  register?: 'formal' | 'neutral' | 'colloquial' | 'slang';
  level: 'A2' | 'B1' | 'B2';
  topic: string;
  ex: Example;
  note?: string; // usage tip in English
}

// One form: [hebrew, transliteration]
export type Form = [string, string];

export interface Verb {
  id: string;
  inf: string;
  tr: string;
  en: string;
  root: string;
  binyan: Binyan;
  gizra?: string; // weak-root class in English, e.g. "ל״ה (final-heh)"
  gov?: string;
  level: 'A2' | 'B1' | 'B2';
  present: { ms: Form; fs: Form; mp: Form; fp: Form };
  past: Record<'1s' | '2ms' | '2fs' | '3ms' | '3fs' | '1p' | '2mp' | '2fp' | '3p', Form>;
  future: Record<'1s' | '2ms' | '2fs' | '3ms' | '3fs' | '1p' | '2mp' | '3p', Form>;
  imp?: { ms: Form; fs: Form; mp: Form };
  ex: Example;
  note?: string;
}

// An open question answered by typing Hebrew.
// keywords: list of concept groups; each group lists acceptable Hebrew variants
// (different inflections / synonyms). Score = groups matched / groups.
export interface Question {
  q: string;
  qEn: string;
  answer: string; // model answer in Hebrew
  answerEn: string;
  keywords: string[][];
}

export interface WritingTask {
  prompt: string; // Hebrew
  promptEn: string;
  minWords: number;
  useWords?: string[]; // words the learner should try to use
  checklist?: { en: string; keywords: string[] }[]; // required elements
  model: string; // model answer in Hebrew
  modelEn: string;
}

export interface GlossEntry {
  he: string;
  en: string;
  tr?: string;
}

export interface Reading {
  id: string;
  level: Level;
  title: string;
  titleEn: string;
  topic: string;
  kind: 'news' | 'article' | 'email' | 'blog' | 'story' | 'ad' | 'interview' | 'notice';
  paragraphs: Example[];
  glossary: GlossEntry[];
  questions: Question[];
  writing?: WritingTask;
  date?: string; // easy-news issues: publication date (YYYY-MM-DD)
  sources?: { name: string; url: string }[]; // easy-news issues: where the facts come from
}

export interface SceneLine {
  s: string; // speaker key
  he: string;
  en: string;
}

export interface Scene {
  id: string;
  level: Level;
  title: string;
  titleEn: string;
  genre: 'sitcom' | 'drama' | 'news' | 'interview' | 'phone' | 'meeting' | 'podcast' | 'ad' | 'street';
  synopsis: string; // English, shown before watching
  speakers: Record<string, { name: string; gender: 'm' | 'f' }>;
  lines: SceneLine[];
  questions: Question[];
  dictation: number[]; // line indexes good for dictation
  expressions: { he: string; en: string; note?: string }[];
}

export interface Drill {
  prompt: string; // Hebrew sentence with ___ for the gap, or an instruction
  en: string; // English meaning of the full sentence
  answer: string[]; // accepted answers for the gap (first = canonical)
  hint?: string;
  explain?: string; // shown after answering
}

export interface GrammarLesson {
  id: string;
  level: Level;
  title: string;
  titleHe: string;
  summary: string; // one line
  sections: { h: string; body: string; table?: string[][] }[];
  drills: Drill[];
}

export interface EmailTask {
  id: string;
  level: Level;
  title: string;
  situation: string; // English
  incoming?: { from: string; subject: string; body: string; bodyEn: string };
  task: WritingTask;
  phrases: GlossEntry[]; // useful phrases for this task
}

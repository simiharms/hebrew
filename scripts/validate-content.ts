// Validates every JSON content file in src/content.
// Usage: node scripts/validate-content.ts [file-substring]
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { containsKeyword, hasHebrew } from '../src/lib/hebrew.ts';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content');
const only = process.argv[2];
const errors: string[] = [];
const warnings: string[] = [];
const ids = new Map<string, string>();

const LEVELS = ['A2', 'A2+', 'B1', 'B1+', 'B2'];
const VOCAB_LEVELS = ['A2', 'B1', 'B2'];
const POS = ['noun', 'verb', 'adj', 'adv', 'prep', 'conj', 'phrase', 'num', 'pron', 'expr'];
const BINYANIM = ['paal', 'piel', 'hifil', 'hitpael', 'nifal', 'pual', 'hufal'];
const NIQQUD = /[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/; // vowel points, not maqaf

function err(where: string, msg: string) {
  errors.push(`${where}: ${msg}`);
}
function warn(where: string, msg: string) {
  warnings.push(`${where}: ${msg}`);
}
function he(where: string, v: unknown, field: string) {
  if (typeof v !== 'string' || !v.trim()) return err(where, `${field} missing`);
  if (!hasHebrew(v)) err(where, `${field} has no Hebrew letters: "${v}"`);
  if (NIQQUD.test(v)) err(where, `${field} contains niqqud (write unvocalised Hebrew): "${v}"`);
}
function str(where: string, v: unknown, field: string) {
  if (typeof v !== 'string' || !v.trim()) err(where, `${field} missing or empty`);
}
function id(where: string, v: unknown) {
  if (typeof v !== 'string' || !/^[a-z0-9_\-]+$/.test(v)) return err(where, `bad id "${v}" (use a-z0-9_-)`);
  if (ids.has(v)) err(where, `duplicate id "${v}" (also in ${ids.get(v)})`);
  ids.set(v, where);
}
function example(where: string, ex: any) {
  if (!ex || typeof ex !== 'object') return err(where, 'ex missing');
  he(where, ex.he, 'ex.he');
  str(where, ex.en, 'ex.en');
}
function questions(where: string, qs: any, sourceText: string) {
  if (!Array.isArray(qs) || qs.length < 2) return err(where, 'needs at least 2 questions');
  qs.forEach((q: any, i: number) => {
    const w = `${where} q${i + 1}`;
    he(w, q.q, 'q');
    str(w, q.qEn, 'qEn');
    he(w, q.answer, 'answer');
    str(w, q.answerEn, 'answerEn');
    if (!Array.isArray(q.keywords) || !q.keywords.length) return err(w, 'keywords missing');
    q.keywords.forEach((g: any, gi: number) => {
      if (!Array.isArray(g) || !g.length || !g.every((x: any) => typeof x === 'string' && hasHebrew(x)))
        return err(w, `keyword group ${gi + 1} must be a non-empty array of Hebrew strings`);
      if (!g.some((v: string) => containsKeyword(q.answer, v)))
        err(w, `keyword group ${JSON.stringify(g)} does not match the model answer "${q.answer}"`);
      if (sourceText && !g.some((v: string) => containsKeyword(sourceText, v)))
        warn(w, `keyword group ${JSON.stringify(g)} never appears in the text`);
    });
  });
}
function writing(where: string, t: any) {
  if (!t) return;
  he(where, t.prompt, 'writing.prompt');
  str(where, t.promptEn, 'writing.promptEn');
  he(where, t.model, 'writing.model');
  str(where, t.modelEn, 'writing.modelEn');
  if (typeof t.minWords !== 'number') err(where, 'writing.minWords must be a number');
  (t.checklist ?? []).forEach((c: any, i: number) => {
    str(where, c.en, `checklist[${i}].en`);
    if (!Array.isArray(c.keywords) || !c.keywords.length) return err(where, `checklist[${i}].keywords missing`);
    if (!c.keywords.some((k: string) => containsKeyword(t.model, k)))
      err(where, `checklist[${i}] keywords ${JSON.stringify(c.keywords)} not found in model answer`);
  });
}
function form(where: string, f: any, name: string) {
  if (!Array.isArray(f) || f.length !== 2) return err(where, `${name} must be [hebrew, translit]`);
  he(where, f[0], name);
  str(where, f[1], `${name} translit`);
}

const PAST = ['1s', '2ms', '2fs', '3ms', '3fs', '1p', '2mp', '2fp', '3p'];
const FUT = ['1s', '2ms', '2fs', '3ms', '3fs', '1p', '2mp', '3p'];

const validators: Record<string, (item: any, where: string) => void> = {
  vocab(v, w) {
    id(w, v.id);
    he(w, v.he, 'he');
    str(w, v.tr, 'tr');
    str(w, v.en, 'en');
    if (!POS.includes(v.pos)) err(w, `bad pos "${v.pos}"`);
    if (!VOCAB_LEVELS.includes(v.level)) err(w, `bad level "${v.level}"`);
    if (v.pos === 'noun' && !['m', 'f'].includes(v.gender)) err(w, 'noun needs gender m/f');
    if (v.pos === 'verb' && !BINYANIM.includes(v.binyan)) err(w, 'verb needs binyan');
    if (v.plural !== undefined) he(w, v.plural, 'plural');
    (v.alt ?? []).forEach((a: string) => he(w, a, 'alt'));
    str(w, v.topic, 'topic');
    example(w, v.ex);
  },
  verbs(v, w) {
    id(w, v.id);
    he(w, v.inf, 'inf');
    str(w, v.tr, 'tr');
    str(w, v.en, 'en');
    he(w, v.root, 'root');
    if (!BINYANIM.includes(v.binyan)) err(w, `bad binyan "${v.binyan}"`);
    if (!VOCAB_LEVELS.includes(v.level)) err(w, `bad level "${v.level}"`);
    for (const k of ['ms', 'fs', 'mp', 'fp']) form(w, v.present?.[k], `present.${k}`);
    for (const k of PAST) form(w, v.past?.[k], `past.${k}`);
    for (const k of FUT) form(w, v.future?.[k], `future.${k}`);
    if (v.imp) for (const k of ['ms', 'fs', 'mp']) form(w, v.imp[k], `imp.${k}`);
    example(w, v.ex);
  },
  readings(r, w) {
    id(w, r.id);
    if (!LEVELS.includes(r.level)) err(w, `bad level "${r.level}"`);
    he(w, r.title, 'title');
    str(w, r.titleEn, 'titleEn');
    if (!Array.isArray(r.paragraphs) || !r.paragraphs.length) return err(w, 'paragraphs missing');
    r.paragraphs.forEach((p: any, i: number) => example(`${w} p${i + 1}`, p));
    if (!Array.isArray(r.glossary)) err(w, 'glossary missing');
    else r.glossary.forEach((g: any, i: number) => (he(w, g.he, `glossary[${i}].he`), str(w, g.en, `glossary[${i}].en`)));
    const text = r.paragraphs.map((p: any) => p.he).join(' ');
    questions(w, r.questions, text);
    writing(w, r.writing);
  },
  scenes(s, w) {
    id(w, s.id);
    if (!LEVELS.includes(s.level)) err(w, `bad level "${s.level}"`);
    he(w, s.title, 'title');
    str(w, s.titleEn, 'titleEn');
    str(w, s.synopsis, 'synopsis');
    if (!s.speakers || typeof s.speakers !== 'object') return err(w, 'speakers missing');
    for (const [k, sp] of Object.entries<any>(s.speakers)) {
      he(w, sp.name, `speakers.${k}.name`);
      if (!['m', 'f'].includes(sp.gender)) err(w, `speakers.${k}.gender must be m/f`);
    }
    if (!Array.isArray(s.lines) || s.lines.length < 4) return err(w, 'needs at least 4 lines');
    s.lines.forEach((l: any, i: number) => {
      if (!s.speakers[l.s]) err(w, `line ${i} unknown speaker "${l.s}"`);
      he(`${w} line ${i}`, l.he, 'he');
      str(`${w} line ${i}`, l.en, 'en');
    });
    if (!Array.isArray(s.dictation)) err(w, 'dictation must be an array');
    else s.dictation.forEach((n: any) => (typeof n !== 'number' || !s.lines[n]) && err(w, `dictation index ${n} out of range`));
    (s.expressions ?? []).forEach((e: any, i: number) => (he(w, e.he, `expressions[${i}].he`), str(w, e.en, `expressions[${i}].en`)));
    questions(w, s.questions, s.lines.map((l: any) => l.he).join(' '));
  },
  grammar(g, w) {
    id(w, g.id);
    if (!LEVELS.includes(g.level)) err(w, `bad level "${g.level}"`);
    str(w, g.title, 'title');
    he(w, g.titleHe, 'titleHe');
    str(w, g.summary, 'summary');
    if (!Array.isArray(g.sections) || !g.sections.length) err(w, 'sections missing');
    else
      g.sections.forEach((s: any, i: number) => {
        str(w, s.h, `sections[${i}].h`);
        str(w, s.body, `sections[${i}].body`);
        if (s.table && !(Array.isArray(s.table) && s.table.every((r: any) => Array.isArray(r))))
          err(w, `sections[${i}].table must be string[][]`);
      });
    if (!Array.isArray(g.drills) || g.drills.length < 6) return err(w, 'needs at least 6 drills');
    g.drills.forEach((d: any, i: number) => {
      const dw = `${w} drill ${i + 1}`;
      he(dw, d.prompt, 'prompt');
      str(dw, d.en, 'en');
      if (!Array.isArray(d.answer) || !d.answer.length) return err(dw, 'answer must be a non-empty array');
      d.answer.forEach((a: string) => he(dw, a, 'answer'));
      if (!d.prompt.includes('___')) warn(dw, 'prompt has no ___ gap');
    });
  },
  emails(e, w) {
    id(w, e.id);
    if (!LEVELS.includes(e.level)) err(w, `bad level "${e.level}"`);
    str(w, e.title, 'title');
    str(w, e.situation, 'situation');
    if (e.incoming) {
      str(w, e.incoming.from, 'incoming.from');
      he(w, e.incoming.subject, 'incoming.subject');
      he(w, e.incoming.body, 'incoming.body');
      str(w, e.incoming.bodyEn, 'incoming.bodyEn');
    }
    if (!e.task) return err(w, 'task missing');
    writing(w, e.task);
    if (!Array.isArray(e.phrases)) err(w, 'phrases missing');
    else e.phrases.forEach((p: any, i: number) => (he(w, p.he, `phrases[${i}].he`), str(w, p.en, `phrases[${i}].en`)));
  },
};

const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
let count = 0;
const seenVocab = new Map<string, string>();
for (const f of files) {
  const kind = f.split(/[-.]/)[0];
  const v = validators[kind];
  if (!v) {
    err(f, `unknown content kind "${kind}" (file name must start with ${Object.keys(validators).join('/')})`);
    continue;
  }
  let data: any;
  try {
    data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  } catch (e) {
    err(f, `invalid JSON: ${(e as Error).message}`);
    continue;
  }
  if (!Array.isArray(data)) {
    err(f, 'top level must be an array');
    continue;
  }
  data.forEach((item: any, i: number) => {
    const where = `${f}[${i}]${item?.id ? ` (${item.id})` : ''}`;
    if (only && !f.includes(only)) {
      if (item?.id) ids.set(item.id, where);
      return;
    }
    v(item, where);
    count++;
    if (kind === 'vocab' && item?.he) {
      const key = `${item.he}|${item.pos}`;
      if (seenVocab.has(key)) warn(where, `same word as ${seenVocab.get(key)}`);
      seenVocab.set(key, where);
    }
  });
}

for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`\n${count} items checked, ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);

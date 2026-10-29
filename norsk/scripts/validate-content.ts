// Checks every content file in src/content against the schema and the course
// plan. Run: npm run validate  (or: npx vite-node scripts/validate-content.ts -- 3 4 to check lessons 3 and 4 only)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { Drill, Lesson, LessonText, Word } from '../src/content/types.ts';
import { LEVELS } from '../src/content/types.ts';
import { containsKeyword, containsPhrase, expandVariants, normalize } from '../src/lib/norsk.ts';
import { PLAN } from '../src/lib/plan.ts';

const DIR = 'src/content';
const only = process.argv.slice(2).map(Number).filter((n) => n > 0);
const lessonsToCheck = only.length ? only : PLAN.map((p) => p.n);
const requireAll = !only.length && process.env.PARTIAL !== '1';

const errors: string[] = [];
const warnings: string[] = [];
const err = (where: string, msg: string) => errors.push(`${where}: ${msg}`);
const warn = (where: string, msg: string) => warnings.push(`${where}: ${msg}`);

const pad = (n: number) => String(n).padStart(2, '0');
const POS = ['noun', 'verb', 'adj', 'adv', 'prep', 'conj', 'pron', 'num', 'phrase', 'interj', 'name'];
const VG = ['1', '2', '3', '4', 'sterk', 'uregelm', 'modal'];
// Letters that don't belong in Bokmål text (German umlauts, ß). Swedish/German names are allowed in lists below.
const FOREIGN = /[ßäöü]/i;
const FOREIGN_OK = /Zürich|Göteborg|Malmö|München|Köln|Düsseldorf|Österreich|Jönköping|Kühne|Müller|Brötchen/;

function isStr(x: unknown): x is string {
  return typeof x === 'string' && x.trim().length > 0;
}

function checkNorwegian(where: string, s: string) {
  if (FOREIGN.test(s.replace(new RegExp(FOREIGN_OK, 'g'), ''))) warn(where, `German letters in Norwegian text: "${s.slice(0, 60)}"`);
  if (/\s{2,}/.test(s)) warn(where, 'double space');
}

function checkDrill(where: string, d: Drill) {
  if (!isStr(d.prompt)) return err(where, 'drill without prompt');
  const gaps = d.prompt.split('___').length - 1;
  if (gaps !== 1) err(where, `drill must have exactly one ___ (has ${gaps}): ${d.prompt}`);
  if (!isStr(d.de)) err(where, 'drill without German translation (de)');
  if (!Array.isArray(d.answer) || !d.answer.length || !d.answer.every(isStr)) err(where, 'drill without answers');
  else {
    for (const a of d.answer) {
      if (a.includes('___')) err(where, `answer contains ___: ${a}`);
      checkNorwegian(where, a);
    }
    if (d.answer.some((a) => normalize(a) === '')) err(where, 'empty answer after normalising');
  }
  // The cue in parentheses at the end may be German (»Vorhersage«, »Präteritum«).
  checkNorwegian(where, d.prompt.replace(/\s*\([^()]*\)\s*$/, ''));
}

function textOf(t: LessonText): string {
  return t.lines.map((l) => l.no).join('\n');
}

function checkText(where: string, t: LessonText, plan: { title?: string }) {
  if (!isStr(t.id)) err(where, 'text without id');
  if (!isStr(t.title) || !isStr(t.titleDe)) err(where, 'text needs title and titleDe');
  if (plan.title && t.title !== plan.title) warn(where, `title "${t.title}" differs from plan "${plan.title}"`);
  if (!['dialog', 'prose', 'letter', 'email', 'song', 'info'].includes(t.kind)) err(where, `bad kind ${t.kind}`);
  if (!Array.isArray(t.lines) || t.lines.length < 3) err(where, 'text needs at least 3 lines');
  for (const [i, l] of (t.lines ?? []).entries()) {
    if (!isStr(l.no) || !isStr(l.de)) err(`${where} line ${i}`, 'line needs no and de');
    else checkNorwegian(`${where} line ${i}`, l.no);
    if (t.kind === 'dialog') {
      if (!l.s) err(`${where} line ${i}`, 'dialogue line without speaker (s)');
      else if (!t.speakers?.[l.s]) err(`${where} line ${i}`, `unknown speaker "${l.s}"`);
    }
  }
  if (t.kind === 'dialog' && !t.speakers) err(where, 'dialogue without speakers');
  for (const sp of Object.values(t.speakers ?? {})) {
    if (!isStr(sp.name) || !['m', 'f'].includes(sp.gender)) err(where, 'speaker needs name and gender m/f');
  }
  if (!Array.isArray(t.glossary) || t.glossary.length < 5) err(where, 'glossary needs at least 5 entries');
  const full = textOf(t) + '\n' + t.title;
  for (const g of t.glossary ?? []) {
    if (!isStr(g.no) || !isStr(g.de)) err(where, 'glossary entry needs no and de');
    else if (!expandVariants(g.no).some((v) => containsPhrase(full, v))) warn(where, `glossary "${g.no}" not found verbatim in the text`);
  }
}

// ---------- lessons ----------

const allWordIds = new Map<string, string>();
const allWords: Word[] = [];
let lessonCount = 0;

for (const n of lessonsToCheck) {
  const plan = PLAN.find((p) => p.n === n)!;
  const lf = `${DIR}/lesson-${pad(n)}.json`;
  const vf = `${DIR}/vocab-${pad(n)}.json`;
  if (!existsSync(lf)) {
    (requireAll ? err : warn)(lf, 'missing');
  } else {
    lessonCount++;
    let L: Lesson;
    try {
      L = JSON.parse(readFileSync(lf, 'utf8'));
    } catch (e) {
      err(lf, `invalid JSON: ${(e as Error).message}`);
      continue;
    }
    const W = `L${n}`;
    if (L.n !== n) err(W, `n is ${L.n}`);
    if (L.level !== plan.level) err(W, `level ${L.level} ≠ plan ${plan.level}`);
    if (!LEVELS.includes(L.level)) err(W, 'bad level');
    if (L.title !== plan.title) err(W, `title "${L.title}" ≠ plan "${plan.title}"`);
    if (!isStr(L.titleDe) || !isStr(L.place)) err(W, 'titleDe and place required');
    if (!Array.isArray(L.goals) || L.goals.length < 2) err(W, 'at least 2 goals');
    checkText(`${W} text`, L.text, { title: plan.title });
    if (!Array.isArray(L.extra) || L.extra.length < 1) err(W, 'at least one extra text (Landeskunde)');
    for (const [i, x] of (L.extra ?? []).entries()) checkText(`${W} extra ${i}`, x, { title: plan.extra[i] });
    const ids = new Set<string>();
    for (const t of [L.text, ...(L.extra ?? [])]) {
      if (ids.has(t.id)) err(W, `duplicate text id ${t.id}`);
      ids.add(t.id);
    }
    // Wörterkiste
    if (!L.wk || L.wk.title !== plan.wk) err(W, `wk.title must be "${plan.wk}"`);
    if (!Array.isArray(L.wk?.phrases) || L.wk.phrases.length < 10) err(W, 'Wörterkiste needs at least 10 phrases');
    for (const p of L.wk?.phrases ?? []) {
      if (!isStr(p.no) || !isStr(p.de)) err(`${W} wk`, 'phrase needs no and de');
      else checkNorwegian(`${W} wk`, p.no);
    }
    // Grammar
    const planIds = plan.grammar.map((g) => g.id);
    const gotIds = (L.grammar ?? []).map((g) => g.id);
    if (planIds.join() !== gotIds.join()) err(W, `grammar ids ${gotIds.join(', ')} ≠ plan ${planIds.join(', ')}`);
    for (const g of L.grammar ?? []) {
      const GW = `${W} ${g.id}`;
      if (!isStr(g.title) || !isStr(g.summary)) err(GW, 'title and summary required');
      if (!Array.isArray(g.sections) || g.sections.length < 1) err(GW, 'at least one section');
      for (const s of g.sections ?? []) {
        if (!isStr(s.h) || !isStr(s.body)) err(GW, 'section needs h and body');
        if (s.table) {
          if (!Array.isArray(s.table) || s.table.length < 2) err(GW, 'table needs header + rows');
          const w = s.table[0]?.length;
          if (s.table.some((r) => !Array.isArray(r) || r.length !== w)) err(GW, `table rows must all have ${w} cells`);
        }
      }
      if (!Array.isArray(g.drills) || g.drills.length < 6) err(GW, `at least 6 drills (has ${g.drills?.length ?? 0})`);
      g.drills?.forEach((d, i) => checkDrill(`${GW} drill ${i + 1}`, d));
    }
    // Exercises
    const fullText = textOf(L.text);
    if (!Array.isArray(L.tf) || L.tf.length < 5) err(W, 'at least 5 true/false');
    for (const t of L.tf ?? []) {
      if (!isStr(t.s) || !isStr(t.de) || typeof t.a !== 'boolean' || !isStr(t.why)) err(`${W} tf`, `incomplete: ${JSON.stringify(t).slice(0, 80)}`);
    }
    const tfTrue = (L.tf ?? []).filter((t) => t.a).length;
    if (L.tf?.length && (tfTrue === 0 || tfTrue === L.tf.length)) err(W, 'true/false must mix true and false');
    if (!Array.isArray(L.questions) || L.questions.length < 3) err(W, 'at least 3 questions');
    for (const q of L.questions ?? []) {
      if (!isStr(q.q) || !isStr(q.qDe) || !isStr(q.answer) || !isStr(q.answerDe)) err(`${W} question`, 'incomplete');
      if (!Array.isArray(q.keywords) || !q.keywords.length) err(`${W} question`, `no keywords: ${q.q}`);
      for (const g of q.keywords ?? []) {
        if (!Array.isArray(g) || !g.length) err(`${W} question`, 'empty keyword group');
        else if (!g.some((k) => containsKeyword(q.answer, k))) err(`${W} question`, `keyword group [${g.join(' | ')}] not in model answer "${q.answer}"`);
      }
    }
    if (!Array.isArray(L.find) || L.find.length < 4) err(W, 'at least 4 find-the-word items');
    for (const f of L.find ?? []) {
      if (!isStr(f.de) || !Array.isArray(f.answer) || !f.answer.length) err(`${W} find`, 'incomplete');
      else if (!f.answer.some((a) => containsPhrase(fullText, a))) err(`${W} find`, `"${f.answer[0]}" not in the text`);
    }
    if (!Array.isArray(L.translate) || L.translate.length < 5) err(W, 'at least 5 translations');
    for (const t of L.translate ?? []) {
      if (!isStr(t.de) || !Array.isArray(t.no) || !t.no.length || !t.no.every(isStr)) err(`${W} translate`, `incomplete: ${t.de}`);
      t.no?.forEach((x) => checkNorwegian(`${W} translate`, x));
    }
    if (!Array.isArray(L.summary) || L.summary.length < 3) err(W, 'summary needs at least 3 gaps');
    L.summary?.forEach((d, i) => checkDrill(`${W} summary ${i + 1}`, d));
    if (!Array.isArray(L.dictation) || L.dictation.length < 2) err(W, 'at least 2 dictation lines');
    for (const i of L.dictation ?? []) {
      if (!L.text.lines[i]) err(W, `dictation index ${i} out of range`);
      else if (L.text.lines[i].no.length > 160) warn(W, `dictation line ${i} is long (${L.text.lines[i].no.length} chars)`);
    }
    const wt = L.writing;
    if (!wt || !isStr(wt.prompt) || !isStr(wt.model) || !isStr(wt.modelDe) || !(wt.minWords > 0)) err(W, 'writing task incomplete');
    for (const c of wt?.checklist ?? []) {
      if (!c.keywords.some((k) => containsKeyword(wt.model, k))) err(`${W} writing`, `checklist "${c.de}" not met by the model answer`);
    }
    for (const u of wt?.useWords ?? []) if (!containsKeyword(wt.model, u)) warn(`${W} writing`, `useWord "${u}" not in the model`);
  }

  // ---------- vocabulary ----------
  if (!existsSync(vf)) {
    (requireAll ? err : warn)(vf, 'missing');
    continue;
  }
  let words: Word[];
  try {
    words = JSON.parse(readFileSync(vf, 'utf8'));
  } catch (e) {
    err(vf, `invalid JSON: ${(e as Error).message}`);
    continue;
  }
  if (!Array.isArray(words)) {
    err(vf, 'must be an array');
    continue;
  }
  if (words.length < 40) warn(vf, `only ${words.length} words`);
  for (const w of words) {
    const WW = `${vf} ${w.id ?? w.no}`;
    if (!isStr(w.id) || !w.id.startsWith(`w${pad(n)}_`)) err(WW, `id must start with w${pad(n)}_`);
    if (allWordIds.has(w.id)) err(WW, `duplicate id (also in ${allWordIds.get(w.id)})`);
    allWordIds.set(w.id, vf);
    if (!isStr(w.no) || !isStr(w.de)) err(WW, 'no and de required');
    else checkNorwegian(WW, w.no);
    if (/^(en|ei|et|å) /.test(w.no ?? '')) err(WW, 'no must be without article / å');
    if (!POS.includes(w.pos)) err(WW, `bad pos ${w.pos}`);
    if (w.lesson !== n) err(WW, `lesson ${w.lesson} ≠ ${n}`);
    if (w.pos === 'noun') {
      if (!['m', 'f', 'n'].includes(w.gender ?? '')) err(WW, 'noun needs gender m/f/n');
      if (!Array.isArray(w.forms) || ![2, 4].includes(w.forms.length)) err(WW, 'noun needs 4 forms (or 2 without plural)');
      else if (!expandVariants(w.forms[0]).some((f) => normalize(f) === normalize(w.no))) err(WW, `forms[0] "${w.forms[0]}" ≠ no "${w.no}"`);
      else if (w.gender === 'f' && !/a$/.test(expandVariants(w.forms[1])[0] ?? '')) warn(WW, `feminine definite should end in -a: ${w.forms[1]}`);
    }
    if (w.pos === 'verb') {
      if (!Array.isArray(w.vf) || w.vf.length !== 4) err(WW, 'verb needs vf [presens, preteritum, perfektum, imperativ]');
      if (!VG.includes(w.vg ?? '')) err(WW, `verb needs vg (${VG.join('/')})`);
      w.vf?.slice(0, 3).forEach((f, i) => !isStr(f) && w.vg !== 'modal' && err(WW, `vf[${i}] empty`));
    }
    if (w.pos === 'adj' && w.forms && ![3, 5].includes(w.forms.length)) err(WW, 'adjective forms: 3 (or 5 with comparison)');
    if (w.ex && (!isStr(w.ex.no) || !isStr(w.ex.de))) err(WW, 'example needs no and de');
    allWords.push(w);
  }
}

// Words listed twice across lessons (same spelling and part of speech).
const seen = new Map<string, string>();
for (const w of allWords) {
  const k = `${normalize(w.no)}|${w.pos}`;
  if (seen.has(k)) warn('vocab', `"${w.no}" (${w.pos}) in ${seen.get(k)} and ${w.id}`);
  else seen.set(k, w.id);
}

// Stray files.
for (const f of readdirSync(DIR)) {
  if (f.endsWith('.json') && !/^(lesson|vocab)-\d\d\.json$/.test(f) && !/^(extra|aussprache)[\w-]*\.json$/.test(f)) warn(DIR, `unexpected file ${f}`);
}

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings.slice(0, 400)) console.log('  ⚠ ' + w);
}
if (errors.length) {
  console.log(`\n${errors.length} error(s):`);
  for (const e of errors) console.log('  ✗ ' + e);
  process.exit(1);
}
console.log(`\n✓ Content OK: ${lessonCount} lessons, ${allWords.length} words.`);

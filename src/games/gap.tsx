// Gap Dash (השלמה): a grammar sentence with one gap and three answers to tap.
// Distractors must never also be right: none is lenient-equal to an accepted
// answer; verb distractors are forms of the same verb that can't agree with
// the gap's subject in any tense (so a missing time word can't make them
// right); and answers that share an accepted variant with the drill, even
// through another drill (synonyms such as למרות / על אף), are never used.
// "Both fit?" still lets the learner flag a drill so it stops coming up.
import './gap.css';
import { useState } from 'preact/hooks';
import type { Drill, GrammarLesson, Verb } from '../content/types.ts';
import { grammar, levelRank, verbById } from '../lib/content.ts';
import { expandVariants, lenient, normalize } from '../lib/hebrew.ts';
import { weakTopics } from '../lib/skills.ts';
import { type AppState, getState, setState } from '../lib/store.ts';
import { analyses, tableOf, type TenseKey } from '../lib/verbdrill.ts';
import { renderPrompt } from '../screens/grammar.tsx';
import { confuserForms, type Evidence, formIndex, type GameProps, levelOk, PRONOUNS, pronounsFor, sameForm, say, shuffle, unfinal } from './kit.ts';
import { type Choice, ChoiceGrid, GameShell, Shorshi, useRound } from './kit-ui.tsx';

export interface GapItem {
  key: string; // `${lessonId}#${i}`, as in the grammar lesson and the mistake bank
  lessonId: string;
  i: number;
  prompt: string;
  en: string;
  answer: string; // the right option (the drill's first answer)
  options: string[]; // the answer and two distractors, shuffled
  hint?: string;
  explain?: string;
  verb?: { verbId: string; tense: TenseKey }; // when the answer is a verb form
}

const ROUND = 10;
const MAX_LESSONS = 3;
const FLAG_CAP = 300;
const THIRD = ['הוא', 'היא', 'הם', 'הן'];
const ALL_TENSES: TenseKey[] = ['present', 'past', 'future', 'imp'];
// What names a tense: the cue (עתיד), the lesson (g_a2_past_paal), a time word.
const TENSE_WORD: [RegExp, TenseKey][] = [
  [/(^|\s)עבר(\s|$)|_past/, 'past'],
  [/(^|\s)עתיד(\s|$)|_future/, 'future'],
  [/(^|\s)הווה(\s|$)|_present/, 'present'],
  [/(^|\s)ציווי(\s|$)|imperative/, 'imp'],
];
const NOT_A_TABLE_FORM = /passive|pu'?al|huf'?al|participle|verbal noun|smichut|פועל|הופעל/i;
const TIME_WORD: [RegExp, TenseKey][] = [
  [/(^|\s)(אתמול|שלשום)(\s|$)|שעבר(ה)?(\s|$)/, 'past'],
  [/(^|\s)(מחר|מחרתיים|בעוד)(\s|$)|הבא(ה)?(\s|$)/, 'future'],
  [/(^|\s)(עכשיו|כרגע)(\s|$)/, 'present'],
];

const lessonById = new Map(grammar.map((g) => [g.id, g]));

/** Every answer a drill accepts, with its gendered and optional variants spelled out. */
export function acceptedOf(d: Drill): string[] {
  return [...new Set(d.answer.flatMap((a) => [a, ...expandVariants(a)]))];
}

const isAccepted = (accepted: string[], x: string) => accepted.some((a) => sameForm(a, x));

// The prompt's bracketed cues: "(ללמוד, אני)", "(it seems)".
const cuesOf = (prompt: string) => [...prompt.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]).join(' ');

/**
 * Pronouns a bracketed cue names as the subject: "(לראות, אתה)" → אתה. Only
 * cues count: in the sentence itself את is often the object marker (את החשבונית)
 * and היא a copula, and neither says who the gap's subject is.
 */
export function cuePronouns(prompt: string): string[] {
  const found = new Set(normalize(cuesOf(prompt)).split(' '));
  return PRONOUNS.filter((p) => found.has(p));
}

/** Every pronoun that can say `form` in any of the verb's tables (rare ones too). */
export function speakersOf(v: Verb, form: string): Set<string> {
  return new Set(analyses(v, form).flatMap((a) => pronounsFor(a.tense, a.person).map(([p]) => p)));
}

/**
 * Who the gap's subject can be: when a cue names a pronoun the answer fits,
 * that pronoun or a noun (3rd person); otherwise anyone the answer fits (a
 * dropped subject, יוסי ואני, a gender the sentence doesn't show).
 */
export function gapSubjects(v: Verb, form: string, prompt: string): Set<string> {
  const can = speakersOf(v, form);
  const named = cuePronouns(prompt).filter((p) => can.has(p));
  if (!named.length) return can;
  return new Set([...named, ...THIRD.filter((p) => can.has(p))]);
}

/** A verb distractor is safe when no subject the gap allows could say it, in any tense. */
export function agreesWithSubject(v: Verb, form: string, subjects: Set<string>): boolean {
  for (const p of speakersOf(v, form)) if (subjects.has(p)) return true;
  return false;
}

const words = (s: string) => lenient(s).split(' ').filter(Boolean);
const letters = (s: string) => unfinal(s.replace(/[^א-ת]/g, ''));

// Is the verb's English gloss in a cue ("(want)", "(it seems)" ← to seem)?
function glossInCue(v: Verb, cue: string): boolean {
  const heads = v.en
    .toLowerCase()
    .split(/[/,;]/)
    .map((g) => g.replace(/\(.*?\)/g, '').trim().replace(/^to /, '').split(' ')[0].replace(/[^a-z]/g, ''))
    .filter((w) => w.length >= 3);
  return heads.some((w) => new RegExp(`\\b${w}(s|es|ed|d|ing)?\\b`).test(cue.toLowerCase()));
}

// Is the verb's root spelled out in the prompt ("(כ.ת.ב, פעל, הווה)")?
function rootInPrompt(v: Verb, prompt: string): boolean {
  const r = [...letters(v.root)];
  if (r.length < 2) return false;
  return new RegExp(r.join('\\s*[.׳\'-]\\s*')).test(unfinal(prompt));
}

/**
 * The verb form in the answer: the answer itself or "לא + form", counted as a
 * verb only when the prompt asks for that verb: its infinitive or root is in
 * the prompt, or its gloss is in a cue. Many answers only look like verb forms
 * (אתן "you", נשים "women", לך "to you", ספרנו "our book"). When verbs share
 * a spelling (אלמד: ללמוד / ללמד) the infinitive wins, then the root, then the gloss.
 */
export function answerVerb(d: Drill, lessonId = ''): { verb: Verb; tense: TenseKey; person: string; form: string; prefix: string } | null {
  const idx = formIndex();
  const a = d.answer[0].trim();
  let prefix = '';
  let form = a;
  let hits = idx.get(lenient(a));
  const neg = /^לא\s+(\S+)$/.exec(a);
  if (!hits && neg) {
    prefix = 'לא ';
    form = neg[1];
    hits = idx.get(lenient(form));
  }
  if (!hits?.length) return null;
  const cue = cuesOf(d.prompt);
  // The tables have only active forms: a passive, a participle or a noun that
  // happens to be spelled like one (הוצא "was published", הצעת "offer of") isn't it.
  if (NOT_A_TABLE_FORM.test(cue)) return null;
  const promptWords = new Set(words(d.prompt));
  const ids = [...new Set(hits.map((h) => h.verbId))];
  const verbsHit = ids.map((id) => verbById.get(id)).filter((v): v is Verb => !!v);
  const verb =
    verbsHit.find((v) => promptWords.has(lenient(v.inf))) ?? verbsHit.find((v) => rootInPrompt(v, d.prompt)) ?? verbsHit.find((v) => glossInCue(v, cue));
  if (!verb) return null;
  const mine = hits.filter((h) => h.verbId === verb.id);
  // The tense the cue or the lesson names, else a time word's (אתמול), else the first reading.
  const fits = (list: [RegExp, TenseKey][], text: string) => list.find(([re, t]) => re.test(text) && mine.some((h) => h.tense === t))?.[1];
  const named = fits(TENSE_WORD, normalize(`${cue} ${lessonId}`)) ?? fits(TIME_WORD, normalize(d.prompt));
  const pick = mine.find((h) => h.tense === named) ?? mine[0];
  return { verb, tense: pick.tense, person: pick.person, form, prefix };
}

// Drills tied to drill i through a shared accepted answer, transitively: their
// answers are synonyms of this one, so never distractors.
function tiedDrills(lesson: GrammarLesson, i: number): Set<number> {
  const acc = lesson.drills.map((d) => new Set(acceptedOf(d).map(lenient)));
  const tied = new Set([i]);
  for (let grew = true; grew; ) {
    grew = false;
    acc.forEach((set, j) => {
      if (tied.has(j)) return;
      if ([...tied].some((k) => [...acc[k]].some((x) => set.has(x)))) {
        tied.add(j);
        grew = true;
      }
    });
  }
  return tied;
}

/**
 * Other drills' answers from the lesson that can't be right here: similar
 * lengths first (within 1, then within 3), so a letter gap gets letters.
 */
export function lessonDistractors(lesson: GrammarLesson, i: number, rnd: () => number = Math.random): string[] {
  const d = lesson.drills[i];
  const accepted = acceptedOf(d);
  const tied = tiedDrills(lesson, i);
  const len = d.answer[0].length;
  const out: string[] = [];
  for (const [j, x] of lesson.drills.entries()) {
    if (tied.has(j)) continue;
    const a = x.answer[0].trim();
    if (!a || isAccepted(accepted, a) || expandVariants(a).some((v) => isAccepted(accepted, v)) || out.some((o) => sameForm(o, a))) continue;
    out.push(a);
  }
  const band = (a: string) => {
    const diff = Math.abs(a.length - len);
    return diff <= 1 ? 0 : diff <= 3 ? 1 : 2;
  };
  return shuffle(out, rnd).sort((a, b) => band(a) - band(b));
}

/**
 * The item for drill i of a lesson, or null if two safe distractors can't be
 * found. Verb answers get forms of the same verb (another person, another
 * tense) that can't agree with the subject; the rest get other answers from
 * the lesson.
 */
export function gapItemFor(lesson: GrammarLesson, i: number, rnd: () => number = Math.random): GapItem | null {
  const d = lesson.drills[i];
  if (!d || (d.prompt.match(/___/g) ?? []).length !== 1 || !d.answer[0]?.trim()) return null;
  const answer = d.answer[0].trim();
  const accepted = acceptedOf(d);
  const hit = answerVerb(d, lesson.id);
  const picked: string[] = [];
  const fresh = (x: string) => !isAccepted(accepted, x) && !picked.some((p) => sameForm(p, x));
  if (hit) {
    const { verb, tense, person, form, prefix } = hit;
    const subjects = gapSubjects(verb, form, d.prompt);
    const core = accepted.map((a) => (prefix && a.startsWith(prefix) ? a.slice(prefix.length) : a));
    const agreeing = ALL_TENSES.flatMap((t) => Object.values(tableOf(verb, t) ?? {}).map((f) => f[0])).filter((f) => agreesWithSubject(verb, f, subjects));
    for (const c of confuserForms(verb, tense, person, 2, rnd, [...core, ...agreeing])) {
      const opt = prefix + c;
      if (fresh(opt)) picked.push(opt);
    }
    // Top up from the lesson, keeping out forms of this verb that could agree.
    for (const x of lessonDistractors(lesson, i, rnd)) {
      if (picked.length >= 2) break;
      const bare = prefix && x.startsWith(prefix) ? x.slice(prefix.length) : x;
      if (analyses(verb, bare).length && agreesWithSubject(verb, bare, subjects)) continue;
      if (fresh(x)) picked.push(x);
    }
  } else {
    for (const x of lessonDistractors(lesson, i, rnd)) {
      if (picked.length >= 2) break;
      if (fresh(x)) picked.push(x);
    }
  }
  if (picked.length < 2) return null;
  return {
    key: `${lesson.id}#${i}`,
    lessonId: lesson.id,
    i,
    prompt: d.prompt,
    en: d.en,
    answer,
    options: shuffle([answer, ...picked.slice(0, 2)], rnd),
    hint: d.hint,
    explain: d.explain,
    verb: hit ? { verbId: hit.verb.id, tense: hit.tense } : undefined,
  };
}

/**
 * Lessons to draw from, best first: weak lessons (weakest first), then lessons
 * done (newest first), then the rest by how close their level is.
 */
export function gapLessons(s: AppState, rnd: () => number = Math.random): GrammarLesson[] {
  const pool = grammar.filter((g) => levelOk(g.level, s));
  const weak = weakTopics('g_', s).map((w) => w.topic);
  const me = levelRank(s.level);
  const dist = (g: GrammarLesson) => {
    const d = levelRank(g.level) - me;
    return d <= 0 ? -d * 0.6 : d * 1.5;
  };
  const tier = (g: GrammarLesson) => (weak.includes(g.id) ? 0 : s.done[g.id] ? 1 : 2);
  return shuffle(pool, rnd).sort((a, b) => {
    const ta = tier(a);
    const tb = tier(b);
    if (ta !== tb) return ta - tb;
    if (ta === 0) return weak.indexOf(a.id) - weak.indexOf(b.id);
    if (ta === 1) return s.done[b.id].at - s.done[a.id].at;
    return dist(a) - dist(b);
  });
}

/**
 * 10 drills from at most 3 lessons. Weak lessons always come in; the other
 * places vary among the next best lessons. Drills reported "both fit" are
 * skipped. Drills stay grouped by lesson.
 */
export function buildGapItems(s: AppState, n = ROUND, rnd: () => number = Math.random): GapItem[] {
  const ordered = gapLessons(s, rnd);
  const weak = new Set(weakTopics('g_', s).map((w) => w.topic));
  const sure = ordered.filter((g) => weak.has(g.id)).slice(0, MAX_LESSONS);
  const rest = ordered.filter((g) => !sure.includes(g));
  const need = MAX_LESSONS - sure.length;
  const lessons = [...sure, ...shuffle(rest.slice(0, need * 2), rnd).slice(0, need), ...rest.slice(need * 2)];
  const flagged = new Set(s.play.flagged);
  const out: GapItem[] = [];
  let used = 0;
  for (const lesson of lessons) {
    if (out.length >= n || used >= MAX_LESSONS) break;
    const left = MAX_LESSONS - used;
    const quota = Math.ceil((n - out.length) / left);
    const items: GapItem[] = [];
    for (const i of shuffle(
      lesson.drills.map((_, j) => j),
      rnd,
    )) {
      if (items.length >= quota) break;
      if (flagged.has(`${lesson.id}#${i}`)) continue;
      const it = gapItemFor(lesson, i, rnd);
      if (it) items.push(it);
    }
    if (!items.length) continue;
    used++;
    out.push(...items);
  }
  return out;
}

/** Remembers a drill the learner says has two right answers (it is skipped from then on). */
export function flagGap(key: string): void {
  setState((s) => {
    if (s.play.flagged.includes(key)) return;
    s.play.flagged.push(key);
    if (s.play.flagged.length > FLAG_CAP) s.play.flagged.splice(0, s.play.flagged.length - FLAG_CAP);
  });
}

// The sentence to read aloud: the gap filled, the cue in brackets dropped.
const spoken = (it: GapItem) => it.prompt.replace('___', it.answer).replace(/\s*\([^)]*\)\s*$/, '');
// A short label for the result card: "אתמול ___ שלוש שעות. → למדתי".
const missLabel = (it: GapItem) => `${it.prompt.replace(/\s*\([^)]*\)\s*$/, '').trim()} → ${it.answer}`;

export function GapGame({ mode }: GameProps) {
  const round = useRound<GapItem>({ game: 'gap', mode, tier: 'tap', build: () => buildGapItems(getState()) });
  const [pick, setPick] = useState<{ key: string; k: string } | null>(null);
  const [hintFor, setHintFor] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<string[]>([]);
  const it = round.item;
  const picked = it && pick?.key === it.key ? pick.k : null;
  const status = picked !== null ? round.status : null;
  const lesson = it ? lessonById.get(it.lessonId) : undefined;
  const fromLesson = it ? round.items.filter((x) => x.lessonId === it.lessonId) : [];
  const nInLesson = it ? fromLesson.findIndex((x) => x.key === it.key) + 1 : 0;

  const onPick = (c: Choice) => {
    if (!it || round.status !== null) return;
    setPick({ key: it.key, k: c.k });
    const evidence: Evidence[] = [{ tier: 'tap', ok: c.ok, skill: 'grammar', topics: [it.lessonId], cardId: null }];
    if (it.verb) {
      const v = verbById.get(it.verb.verbId);
      evidence.push({
        tier: 'tap',
        ok: c.ok,
        skill: 'verbs',
        topics: [...(v ? [`binyan:${v.binyan}`] : []), `tense:${it.verb.tense}`],
        cardId: it.verb.tense === 'imp' ? null : `c:${it.verb.verbId}:${it.verb.tense}`,
      });
    }
    round.answer({ ok: c.ok, evidence, miss: missLabel(it), verbId: it.verb?.verbId });
    say(spoken(it));
  };

  const flag = () => {
    if (!it || flagged.includes(it.key)) return;
    flagGap(it.key);
    setFlagged([...flagged, it.key]);
  };

  let prompt = null;
  if (it) {
    const showHint = hintFor === it.key && status === null;
    prompt = (
      <div class="gap-stage">
        {lesson && (
          <div class="gap-lesson">
            <span class="he" lang="he" dir="rtl">
              {lesson.titleHe}
            </span>
            <span class="gap-lesson-en">
              {lesson.title} · {nInLesson}/{fromLesson.length}
            </span>
          </div>
        )}
        <div class={`gap-card ${status === true ? 'ok' : status === false ? 'bad' : ''}`} key={it.key} lang="he" data-key={it.key}>
          {renderPrompt(it.prompt, status !== null ? it.answer : undefined)}
          <div class="gap-en" lang="en">
            {it.en}
          </div>
        </div>
        <div class="gap-after" aria-live="off">
          {status === null ? (
            it.hint &&
            (showHint ? (
              <div class="gap-hint">💡 {it.hint}</div>
            ) : (
              <button type="button" class="gap-hint-btn" onClick={() => setHintFor(it.key)}>
                💡 Hint
              </button>
            ))
          ) : (
            <>
              <div class="gap-verdict">
                <Shorshi mood={status ? 'cheer' : 'oops'} size={36} />
                <span>{status ? 'Right!' : 'The answer is'}</span>
                <span class="gap-answer he" lang="he" dir="rtl">
                  {it.answer}
                </span>
              </div>
              {it.explain && <p class="gap-explain">{it.explain}</p>}
              {status === false &&
                (flagged.includes(it.key) ? (
                  <p class="gap-flagged">🚩 Thanks: this one won't come up again.</p>
                ) : (
                  <button type="button" class="gap-flag" onClick={flag}>
                    🚩 Both fit? Report it
                  </button>
                ))}
            </>
          )}
        </div>
      </div>
    );
  } else if (!round.total) prompt = <p class="muted">No grammar drills to play at your level yet.</p>;

  const choices: Choice[] = it ? it.options.map((o) => ({ k: o, label: o, ok: sameForm(o, it.answer), he: true })) : [];
  const controls = it && (
    <div class="gap-opts">
      <ChoiceGrid choices={choices} cols={1} picked={picked} locked={round.status !== null} onPick={onPick} />
    </div>
  );
  const live =
    it && status !== null ? `${status ? 'Right!' : 'Not quite.'} ${spoken(it)}.${round.lastGain ? ` +${round.lastGain} XP.` : ''}` : undefined;

  return <GameShell game="gap" mode={mode} round={round} prompt={prompt} controls={controls} live={live} />;
}

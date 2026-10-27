import { useMemo, useState } from 'preact/hooks';
import { AnswerInput, Feedback, wordDiff } from '../components/answer.tsx';
import { HeText } from '../components/hebrew.tsx';
import { Progress, TopBar } from '../components/ui.tsx';
import type { Drill, Form, Level, Question, Verb, VocabItem } from '../content/types.ts';
import { LEVELS } from '../content/types.ts';
import { grammar, levelRank, readings, scenes, verbs, vocab } from '../lib/content.ts';
import { startUnitForLevel } from '../lib/course.ts';
import { lookup } from '../lib/content.ts';
import { type CheckResult, checkHebrew, containsKeyword, scoreKeywords, wordCount } from '../lib/hebrew.ts';
import { go } from '../lib/router.ts';
import { applyRecord, type Assessment, levelFromScore, type Skill, SKILLS } from '../lib/skills.ts';
import { setState } from '../lib/store.ts';
import { speak, ttsSupported } from '../lib/tts.ts';
import { renderPrompt } from './grammar.tsx';

// Difficulty bands used to turn answers into a level estimate.
type Band = 0 | 1 | 2 | 3; // 0 = A1/A2, 1 = A2+/B1, 2 = B1+/B2, 3 = C1
const BANDS: Band[] = [0, 1, 2, 3];

type Item =
  | { kind: 'vocab'; band: Band; item: VocabItem }
  | { kind: 'verb'; band: Band; verb: Verb; tense: 'present' | 'past' | 'future'; person: string; pronoun: string; label: string; answer: Form }
  | { kind: 'drill'; band: Band; drill: Drill; lesson: string }
  | { kind: 'dictation'; band: Band; text: string; gender?: 'm' | 'f' }
  | { kind: 'reading'; band: Band; text: string; q: Question }
  | { kind: 'writing'; band: Band };

interface Section {
  skill: Skill;
  title: string;
  intro: string;
  items: Item[];
}

const shuffle = <T,>(xs: T[]): T[] => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

const PERSONS: [string, string, string][] = [
  ['past', '1s', 'אני'],
  ['past', '3fs', 'היא'],
  ['past', '1p', 'אנחנו'],
  ['future', '1s', 'אני'],
  ['future', '3ms', 'הוא'],
  ['future', '2mp', 'אתם'],
  ['present', 'fs', 'היא'],
  ['present', 'mp', 'הם'],
];

function buildSections(): Section[] {
  const single = (v: VocabItem) => ['noun', 'verb', 'adj'].includes(v.pos) && !/[ /]/.test(v.he);
  const words = (lvl: string, n: number) => shuffle(vocab.filter((v) => v.level === lvl && single(v))).slice(0, n);
  const vocabItems: Item[] = [
    ...words('A1', 2).map((item) => ({ kind: 'vocab' as const, band: 0 as Band, item })),
    ...words('A2', 3).map((item) => ({ kind: 'vocab' as const, band: 0 as Band, item })),
    ...words('B1', 3).map((item) => ({ kind: 'vocab' as const, band: 1 as Band, item })),
    ...words('B2', 3).map((item) => ({ kind: 'vocab' as const, band: 2 as Band, item })),
    ...words('C1', 2).map((item) => ({ kind: 'vocab' as const, band: 3 as Band, item })),
  ];

  const verbItems: Item[] = [];
  const pool = (levels: string[], paal?: boolean) =>
    shuffle(verbs.filter((v) => levels.includes(v.level) && !v.rare?.length && (paal === undefined || (v.binyan === 'paal') === paal)));
  const persons = shuffle(PERSONS);
  [...pool(['A1', 'A2'], true).slice(0, 3), ...pool(['A2', 'B1'], false).slice(0, 2), ...pool(['B2', 'C1']).slice(0, 2)].forEach((verb, i) => {
    const [tense, person, pronoun] = persons[i % persons.length];
    const table = verb[tense as 'past'] as Record<string, Form>;
    if (!table?.[person]) return;
    verbItems.push({
      kind: 'verb',
      band: (['A1', 'A2'].includes(verb.level) ? 0 : verb.level === 'B1' ? 1 : verb.level === 'B2' ? 2 : 3) as Band,
      verb,
      tense: tense as 'past',
      person,
      pronoun,
      label: `${pronoun} · ${tense === 'past' ? 'עבר' : tense === 'future' ? 'עתיד' : 'הווה'}`,
      answer: table[person],
    });
  });

  const drillsFrom = (levels: Level[], n: number, band: Band): Item[] =>
    shuffle(grammar.filter((g) => levels.includes(g.level)))
      .slice(0, n)
      .map((g) => ({ kind: 'drill' as const, band, drill: shuffle(g.drills)[0], lesson: g.id }));
  const grammarItems = [...drillsFrom(['A1', 'A2'], 3, 0), ...drillsFrom(['A2+', 'B1'], 3, 1), ...drillsFrom(['B1+', 'B2'], 2, 2), ...drillsFrom(['C1'], 2, 3)];

  const dict = (lvl: Level, band: Band): Item[] => {
    const sc = shuffle(scenes.filter((s) => s.level === lvl && s.dictation.length))[0];
    if (!sc) return [];
    const line = sc.lines[sc.dictation[0]];
    return [{ kind: 'dictation', band, text: line.he, gender: sc.speakers[line.s]?.gender }];
  };
  const listeningItems = ttsSupported()
    ? [...dict('A1', 0), ...dict('A2', 0), ...dict('A2+', 1), ...dict('B1', 1), ...dict('B1+', 2), ...dict('B2', 2), ...dict('C1', 3)]
    : [];

  const read = (lvl: Level, band: Band): Item[] => {
    const r = shuffle(readings.filter((x) => x.level === lvl))[0];
    if (!r) return [];
    const text = r.paragraphs.slice(0, 2).map((p) => p.he).join('\n\n');
    // Pick a question answerable from the first two paragraphs if possible.
    const q = r.questions.find((qq) => qq.keywords.every((g) => g.some((k) => containsKeyword(text, k)))) ?? r.questions[0];
    return [{ kind: 'reading', band, text, q }];
  };
  const readingItems = [...read('A2', 0), ...read('B1', 1), ...read('B2', 2), ...read('C1', 3)];

  return [
    { skill: 'vocab', title: 'Vocabulary', intro: 'Type the Hebrew word. They get harder as you go — “I don’t know” is fine.', items: vocabItems },
    { skill: 'verbs', title: 'Verb forms', intro: 'Type the verb in the person and tense shown.', items: verbItems },
    { skill: 'grammar', title: 'Grammar', intro: 'Fill the gap with the missing word.', items: grammarItems },
    { skill: 'listening', title: 'Listening', intro: 'Listen and type what you hear. You can replay as often as you like.', items: listeningItems },
    { skill: 'reading', title: 'Reading', intro: 'Read the text and answer the question in Hebrew, in your own words.', items: readingItems },
    { skill: 'writing', title: 'Writing', intro: 'Write a few sentences. There is no single right answer.', items: [{ kind: 'writing', band: 1 }] },
  ].filter((s) => s.items.length) as Section[];
}

/** Level from per-band accuracy (0 = A1/A2, 1 = A2+/B1, 2 = B1+/B2, 3 = C1). */
export function levelFromBands(acc: (number | null)[]): Level {
  const [b0, b1, b2, b3] = acc;
  if (b0 !== null && b0 < 0.4) return 'A1';
  if (b0 !== null && b0 < 0.7) return 'A2';
  if (b1 === null) return b0 !== null && b0 >= 0.9 ? 'A2+' : 'A2';
  if (b1 < 0.4) return 'A2';
  if (b1 < 0.75) return 'A2+';
  if (b2 === null || b2 < 0.4) return 'B1';
  if (b2 < 0.75) return 'B1+';
  if (b3 === null || b3 < 0.6) return 'B2';
  return 'C1';
}

const CONNECTORS = ['כי', 'אבל', 'לכן', 'למרות', 'בגלל', 'כש', 'אם', 'גם', 'אחרי', 'לפני', 'בנוסף', 'אולם', 'כדי', 'בזמן', 'עם זאת'];

function writingScore(text: string): number {
  const words = wordCount(text);
  const connectors = CONNECTORS.filter((c) => containsKeyword(text, c)).length;
  const verbsFound = new Set(
    text
      .split(/\s+/)
      .filter((w) => lookup(w).entries.some((e) => e.verbId))
      .map((w) => w),
  ).size;
  return 0.4 * Math.min(words / 35, 1) + 0.3 * Math.min(connectors / 3, 1) + 0.3 * Math.min(verbsFound / 4, 1);
}

export function AssessmentPage() {
  const sections = useMemo(buildSections, []);
  const [started, setStarted] = useState(false);
  const [si, setSi] = useState(0);
  const [ii, setIi] = useState(0);
  const [scores, setScores] = useState<Record<string, { band: Band; v: number }[]>>({});
  const [topicHits, setTopicHits] = useState<{ topic: string; v: number }[]>([]);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [dictScore, setDictScore] = useState<number | null>(null);
  const [readScore, setReadScore] = useState<number | null>(null);
  const [selfRate, setSelfRate] = useState<number | null>(null);
  const [missStreak, setMissStreak] = useState(0);
  const total = sections.reduce((a, s) => a + s.items.length, 0);
  const doneCount = sections.slice(0, si).reduce((a, s) => a + s.items.length, 0) + ii;

  if (!started) {
    return (
      <>
        <TopBar title="Skills check" backTo={true} />
        <main class="page">
          <div class="card">
            <h2>Find your level in each skill</h2>
            <p>
              About 10 minutes, {sections.length} short parts: {sections.map((s) => s.title.toLowerCase()).join(', ')}. You type
              every answer, just like in the app.
            </p>
            <p class="small muted">
              Your result is a level per skill (A2 → B2). The daily plan then gives more time to your weakest skill and keeps
              updating the profile from your practice. You can retake it any time.
            </p>
            <button class="btn primary block" onClick={() => setStarted(true)}>
              Start
            </button>
          </div>
        </main>
      </>
    );
  }

  if (si >= sections.length) return <AssessmentResult scores={scores} topicHits={topicHits} sections={sections} />;

  const section = sections[si];
  const item = section.items[ii];

  const push = (v: number, topic?: string) => {
    setScores((s) => ({ ...s, [section.skill]: [...(s[section.skill] ?? []), { band: item.band, v }] }));
    if (topic) setTopicHits((t) => [...t, { topic, v }]);
    setMissStreak((m) => (v < 0.5 ? m + 1 : 0));
  };

  const advance = () => {
    setValue('');
    setResult(null);
    setDictScore(null);
    setReadScore(null);
    setSelfRate(null);
    // In vocabulary, four misses in a row means the rest is too hard: score it and move on.
    if (section.skill === 'vocab' && missStreak >= 4) {
      const rest = section.items.slice(ii + 1);
      setScores((s) => ({ ...s, vocab: [...(s.vocab ?? []), ...rest.map((r) => ({ band: r.band, v: 0 }))] }));
      setSi(si + 1);
      setIi(0);
      setMissStreak(0);
      return;
    }
    if (ii + 1 < section.items.length) setIi(ii + 1);
    else {
      setSi(si + 1);
      setIi(0);
      setMissStreak(0);
    }
  };

  const skipSection = () => {
    setValue('');
    setResult(null);
    setSi(si + 1);
    setIi(0);
    setMissStreak(0);
  };

  const checkTyped = (accepted: string[], strict: boolean, topic?: string) => {
    const r = value.trim() ? checkHebrew(value, accepted, { strict }) : ({ verdict: 'wrong', expected: accepted[0] } as CheckResult);
    setResult(r);
    if (r.verdict === 'latin') return;
    push(r.verdict === 'correct' ? 1 : r.verdict === 'close' ? 0.7 : 0, topic);
  };

  const answered = (result && result.verdict !== 'latin') || dictScore !== null || readScore !== null || selfRate !== null;

  return (
    <>
      <TopBar title={`Skills check · ${section.title}`} backTo={true} right={<span class="small muted">{doneCount + 1}/{total}</span>} />
      <main class="page">
        <Progress value={doneCount / total} />
        {ii === 0 && !answered && <div class="card tight primary small mt">{section.intro}</div>}
        <div class="card">
          {item.kind === 'vocab' && (
            <div class="prompt-box">
              <div class="small muted">How do you say…</div>
              <div class="big-en">{item.item.en}</div>
              <div class="hint">{item.item.pos}</div>
            </div>
          )}
          {item.kind === 'verb' && (
            <div class="prompt-box">
              <div class="he he-lg">{item.verb.inf}</div>
              <div class="small muted">{item.verb.en}</div>
              <div class="he he-md mt">{item.label}</div>
            </div>
          )}
          {item.kind === 'drill' && (
            <div class="prompt-box">
              {renderPrompt(item.drill.prompt)}
              <div class="hint">{item.drill.en}</div>
            </div>
          )}
          {item.kind === 'dictation' && (
            <div class="prompt-box">
              <button class="btn primary" onClick={() => speak(item.text, { gender: item.gender })}>
                🔊 Play
              </button>{' '}
              <button class="btn ghost" onClick={() => speak(item.text, { gender: item.gender, rate: 0.65 })}>
                🐢 Slow
              </button>
            </div>
          )}
          {item.kind === 'reading' && (
            <>
              <div class="pre">
                <HeText text={item.text} />
              </div>
              <hr class="sep" />
              <HeText text={item.q.q} />
            </>
          )}
          {item.kind === 'writing' && (
            <>
              <HeText text="ספרו בכמה משפטים על העבודה או על הלימודים שלכם: מה אתם עושים, מה אתם אוהבים, ומה קשה לכם." />
              <div class="en">Write a few sentences about your work or studies: what you do, what you like, what's hard.</div>
            </>
          )}

          {item.kind === 'writing' || item.kind === 'reading' ? (
            item.kind === 'writing' ? (
              <textarea
                class="answer he mt"
                dir="rtl"
                lang="he"
                value={value}
                placeholder="כתבו כאן…"
                autocorrect="off"
                spellcheck={false}
                disabled={answered}
                onInput={(e) => setValue((e.target as HTMLTextAreaElement).value)}
              />
            ) : (
              <div class="mt">
                <AnswerInput value={value} onInput={setValue} placeholder="תשובה בעברית…" disabled={answered} />
              </div>
            )
          ) : (
            <div class="mt">
              <AnswerInput
                value={value}
                onInput={setValue}
                autoFocus
                onEnter={() => {
                  if (answered) return advance();
                  if (item.kind === 'vocab') checkTyped([item.item.he, ...(item.item.alt ?? [])], false);
                  if (item.kind === 'verb') checkTyped([item.answer[0]], true, `binyan:${item.verb.binyan}`);
                  if (item.kind === 'drill') checkTyped(item.drill.answer, true, item.lesson);
                  if (item.kind === 'dictation') {
                    const s = wordDiff(item.text, value).score;
                    setDictScore(s);
                    push(s);
                  }
                }}
              />
            </div>
          )}

          {result && <Feedback result={result} />}
          {dictScore !== null && item.kind === 'dictation' && (
            <div class={`feedback ${dictScore >= 0.99 ? 'ok' : dictScore >= 0.6 ? 'close' : 'bad'}`}>
              <strong>{Math.round(dictScore * 100)}% of words</strong>
              <div class="he he-md mt" style={{ color: 'var(--text)' }}>
                {item.text}
              </div>
            </div>
          )}
          {readScore !== null && item.kind === 'reading' && (
            <div class="feedback close">
              <div class="small">Model answer</div>
              <div class="he he-md" style={{ color: 'var(--text)' }}>
                {item.q.answer}
              </div>
            </div>
          )}
          {item.kind === 'writing' && answered && <div class="feedback ok">Thanks — saved to your profile.</div>}

          <div class="btn-row">
            {!answered ? (
              <>
                <button
                  class="btn ghost"
                  onClick={() => {
                    if (item.kind === 'dictation') {
                      setDictScore(0);
                      push(0);
                    } else if (item.kind === 'reading') {
                      setReadScore(0);
                      push(0);
                    } else if (item.kind === 'writing') {
                      setSelfRate(0);
                      push(0);
                    } else checkTyped(item.kind === 'vocab' ? [item.item.he] : item.kind === 'verb' ? [item.answer[0]] : item.drill.answer, true, item.kind === 'drill' ? item.lesson : undefined);
                  }}
                >
                  I don't know
                </button>
                <button
                  class="btn primary"
                  disabled={!value.trim()}
                  onClick={() => {
                    if (item.kind === 'vocab') checkTyped([item.item.he, ...(item.item.alt ?? [])], false);
                    else if (item.kind === 'verb') checkTyped([item.answer[0]], true, `binyan:${item.verb.binyan}`);
                    else if (item.kind === 'drill') checkTyped(item.drill.answer, true, item.lesson);
                    else if (item.kind === 'dictation') {
                      const s = wordDiff(item.text, value).score;
                      setDictScore(s);
                      push(s);
                    } else if (item.kind === 'reading') {
                      const s = scoreKeywords(value, item.q.keywords).score;
                      setReadScore(s);
                      push(s);
                    } else {
                      const s = writingScore(value);
                      setSelfRate(s);
                      push(s);
                    }
                  }}
                >
                  {item.kind === 'writing' ? 'Done' : 'Check'}
                </button>
              </>
            ) : (
              <button class="btn primary block" onClick={advance}>
                Next →
              </button>
            )}
          </div>
          {!answered && (
            <button class="btn small ghost mt" onClick={skipSection}>
              Skip this part
            </button>
          )}
        </div>
      </main>
    </>
  );
}

function AssessmentResult({
  scores,
  topicHits,
  sections,
}: {
  scores: Record<string, { band: Band; v: number }[]>;
  topicHits: { topic: string; v: number }[];
  sections: Section[];
}) {
  const levels: Partial<Record<Skill, Level>> = {};
  const raw: Partial<Record<Skill, number>> = {};
  for (const s of sections) {
    const list = scores[s.skill];
    if (!list?.length) continue;
    const acc = BANDS.map((b) => {
      const xs = list.filter((x) => x.band === b);
      return xs.length ? xs.reduce((a, x) => a + x.v, 0) / xs.length : null;
    });
    raw[s.skill] = list.reduce((a, x) => a + x.v, 0) / list.length;
    levels[s.skill] = s.skill === 'writing' ? levelFromScore(raw[s.skill]!) : levelFromBands(acc);
  }
  const ranked = Object.values(levels).map((l) => levelRank(l!)).sort((a, b) => a - b);
  const overall: Level = ranked.length ? LEVELS[ranked[Math.floor((ranked.length - 1) / 2)]] : 'A2+';
  const order = (Object.keys(levels) as Skill[]).sort((a, b) => levelRank(levels[a]!) - levelRank(levels[b]!) || (raw[a] ?? 0) - (raw[b] ?? 0));
  const weakest = order.slice(0, 2);

  const save = () => {
    const assessment: Assessment = { at: Date.now(), level: overall, skills: levels, scores: raw };
    setState((st) => {
      st.level = overall;
      st.onboarded = true;
      st.profile.assessment = assessment;
      // Seed the live profile so the first days of practice don't swing it wildly.
      for (const [skill, v] of Object.entries(raw)) applyRecord(st, skill as Skill, v!, [], 3);
      for (const t of topicHits) applyRecord(st, 'grammar', t.v, [t.topic], 0);
      // Place the learner in the course unless they have already passed a unit check.
      if (!Object.keys(st.done).some((k) => /^unit:.*:check$/.test(k))) st.courseUnit = startUnitForLevel(overall);
    });
    go('today');
  };

  return (
    <>
      <TopBar title="Your Hebrew profile" />
      <main class="page">
        <div class="card center">
          <div class="small muted">Overall</div>
          <div style={{ fontSize: 48, fontWeight: 800 }}>{overall}</div>
        </div>
        <div class="card">
          {SKILLS.filter((s) => levels[s.id]).map((s) => (
            <SkillBar label={`${s.emoji} ${s.label}`} level={levels[s.id]!} />
          ))}
        </div>
        {weakest.length > 0 && (
          <div class="card accent small">
            <strong>Focus first:</strong> {weakest.map((w) => SKILLS.find((s) => s.id === w)!.label.toLowerCase()).join(' and ')}. Your
            daily plan will put these first and give them extra practice.
          </div>
        )}
        <button class="btn primary block" onClick={save}>
          Save and start
        </button>
      </main>
    </>
  );
}

export function SkillBar({ label, level, live }: { label: string; level: Level; live?: number }) {
  const idx = LEVELS.indexOf(level);
  return (
    <div class="mb">
      <div class="row small">
        <span>{label}</span>
        <div class="spacer" />
        {live !== undefined && <span class="muted">practice {Math.round(live * 100)}% · </span>}
        <strong>{level}</strong>
      </div>
      <div class="row" style={{ gap: 3, marginTop: 4 }}>
        {LEVELS.map((l, i) => (
          <div
            title={l}
            style={{ flex: 1, height: 8, borderRadius: 4, background: i <= idx ? 'var(--primary)' : 'var(--surface-2)' }}
          />
        ))}
      </div>
    </div>
  );
}

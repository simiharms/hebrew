import { useMemo, useState } from 'preact/hooks';
import { AnswerInput, Feedback } from '../components/answer.tsx';
import { Progress, Seg, TopBar } from '../components/ui.tsx';
import type { Drill, Level, VocabItem } from '../content/types.ts';
import { LEVELS } from '../content/types.ts';
import { grammar, vocab } from '../lib/content.ts';
import { type CheckResult, checkHebrew, hasHebrew } from '../lib/hebrew.ts';
import { go } from '../lib/router.ts';
import { type Focus, getState, setState } from '../lib/store.ts';
import { hebrewVoices, speak, ttsSupported } from '../lib/tts.ts';
import { renderPrompt } from './grammar.tsx';
import { InstallCard } from './me.tsx';

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [kb, setKb] = useState('');
  const [voiceTried, setVoiceTried] = useState(false);
  const s = getState();
  const [level, setLevel] = useState<Level>(s.level);
  const [focus, setFocus] = useState<Focus>(s.settings.focus);
  const [perDay, setPerDay] = useState(s.settings.newPerDay);

  const finish = (placement: boolean) => {
    setState((st) => {
      st.level = level;
      st.settings.focus = focus;
      st.settings.newPerDay = perDay;
      st.onboarded = true;
    });
    go(placement ? 'placement' : 'today');
  };

  return (
    <>
      <TopBar title="Welcome to Shoresh" />
      <main class="page">
        <Progress value={step / 3} />
        {step === 0 && (
          <div class="card">
            <div class="he he-xl" style={{ textAlign: 'center' }}>
              שורש
            </div>
            <p class="center muted">“root” — because Hebrew grows from roots</p>
            <p>
              <strong>Built for getting past A2</strong> — the point where apps usually stop helping:
            </p>
            <ul>
              <li>
                <strong>You type every answer in Hebrew.</strong> No word banks, no multiple choice. Recall is what builds fluency.
              </li>
              <li>
                <strong>Real reading:</strong> graded articles and work emails, tap any word for meaning, root and prefixes, then answer
                questions in your own words.
              </li>
              <li>
                <strong>Real listening:</strong> TV-style scenes (sitcom, office, news, phone calls) with slang, at adjustable speed.
              </li>
              <li>
                <strong>The grammar Duolingo skips:</strong> roots, binyanim, verb tables, prepositions with endings, numbers and
                gender, formal register for business.
              </li>
              <li>
                <strong>Smart reviews:</strong> a spaced-repetition scheduler brings each word back right before you would forget it.
              </li>
            </ul>
            <p class="small muted">Free, works offline, no account. Progress stays on your phone.</p>
            <button class="btn primary block" onClick={() => setStep(1)}>
              Let's set up →
            </button>
          </div>
        )}
        {step === 1 && (
          <div class="card">
            <h3>1. Hebrew keyboard & voice</h3>
            <p class="small">
              Type <span class="he">שלום</span> below. No Hebrew keyboard yet? iPhone: <strong>Settings → General → Keyboard →
              Keyboards → Add New Keyboard → Hebrew</strong>. Then switch with the 🌐 key.
            </p>
            <AnswerInput value={kb} onInput={setKb} placeholder="שלום" />
            {kb && (hasHebrew(kb) ? <div class="feedback ok">✓ Hebrew keyboard works</div> : <div class="feedback bad">That's not Hebrew yet — tap 🌐 to switch keyboards.</div>)}
            <hr class="sep" />
            <p class="small">Now check the voice:</p>
            <button
              class="btn"
              onClick={() => {
                speak('שלום! ברוכים הבאים. בואו נלמד עברית.');
                setVoiceTried(true);
              }}
              disabled={!ttsSupported()}
            >
              🔊 Play a sentence
            </button>
            {voiceTried && hebrewVoices().length === 0 && (
              <div class="feedback close small">
                No Hebrew voice detected. iPhone: <strong>Settings → Accessibility → Spoken Content → Voices → Hebrew</strong> and
                download <strong>Carmit</strong> (Enhanced sounds best).
              </div>
            )}
            <p class="small muted mt">
              Tip: the 🎤 key on the Hebrew keyboard lets you dictate answers — free speaking practice.
            </p>
            <InstallCard />
            <div class="btn-row">
              <button class="btn ghost" onClick={() => setStep(0)}>
                Back
              </button>
              <button class="btn primary" onClick={() => setStep(2)}>
                Next →
              </button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div class="card">
            <h3>2. Your level & goals</h3>
            <p class="small">Finished the Duolingo course or stuck around its end? That's usually A2 to A2+.</p>
            <Seg value={level} options={LEVELS.map((l) => ({ v: l, label: l }))} onChange={setLevel} />
            <ul class="small muted">
              <li>A2 — basic sentences, present tense, simple past</li>
              <li>A2+ — past & future, but real texts are hard</li>
              <li>B1 — can follow easy articles and slow conversation</li>
              <li>B1+ — work emails and meetings with effort</li>
              <li>B2 — news and business press with a dictionary</li>
            </ul>
            <div class="small muted mt">Focus</div>
            <Seg
              value={focus}
              options={[
                { v: 'business', label: 'Business' },
                { v: 'both', label: 'Both' },
                { v: 'daily', label: 'Everyday life' },
              ]}
              onChange={setFocus}
            />
            <div class="small muted mt">New words per day</div>
            <Seg value={perDay} options={[5, 8, 12, 15].map((n) => ({ v: n, label: String(n) }))} onChange={setPerDay} />
            <div class="btn-row">
              <button class="btn" onClick={() => finish(true)}>
                Take 3-min placement test
              </button>
              <button class="btn primary" onClick={() => finish(false)}>
                Start at {level} →
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

// ---------- Placement test ----------

type PQ = { tier: number; kind: 'vocab'; item: VocabItem } | { tier: number; kind: 'drill'; drill: Drill };

const shuffle = <T,>(xs: T[]): T[] => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

function buildPlacement(): PQ[] {
  const out: PQ[] = [];
  const tiers: { vocab: string; grammar: Level[] }[] = [
    { vocab: 'A2', grammar: ['A2', 'A2+'] },
    { vocab: 'B1', grammar: ['B1'] },
    { vocab: 'B2', grammar: ['B1+', 'B2'] },
  ];
  tiers.forEach((t, tier) => {
    const words = shuffle(vocab.filter((v) => v.level === t.vocab && ['noun', 'verb', 'adj'].includes(v.pos) && !v.he.includes(' ')));
    const drills = shuffle(grammar.filter((g) => t.grammar.includes(g.level)).flatMap((g) => g.drills));
    const nDrills = Math.min(2, drills.length);
    words.slice(0, 5 - nDrills).forEach((item) => out.push({ tier, kind: 'vocab', item }));
    drills.slice(0, nDrills).forEach((drill) => out.push({ tier, kind: 'drill', drill }));
  });
  return out;
}

export function Placement() {
  const qs = useMemo(buildPlacement, []);
  const [i, setI] = useState(0);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [score, setScore] = useState<number[]>([0, 0, 0]);
  const [count, setCount] = useState<number[]>([0, 0, 0]);

  if (i >= qs.length) {
    const r = score.map((x, k) => (count[k] ? x / count[k] : 0));
    const level: Level = r[0] < 0.6 ? 'A2' : r[1] < 0.6 ? 'A2+' : r[2] < 0.4 ? 'B1' : r[2] < 0.8 ? 'B1+' : 'B2';
    return (
      <>
        <TopBar title="Placement result" />
        <main class="page">
          <div class="card center">
            <div class="small muted">Suggested level</div>
            <div style={{ fontSize: 48, fontWeight: 800 }}>{level}</div>
            <p class="small muted">
              Basics {Math.round(r[0] * 100)}% · Intermediate {Math.round(r[1] * 100)}% · Advanced {Math.round(r[2] * 100)}%
            </p>
            <button
              class="btn primary block"
              onClick={() => {
                setState((st) => {
                  st.level = level;
                  st.onboarded = true;
                });
                go('today');
              }}
            >
              Start at {level}
            </button>
            <p class="small muted mt">You can change the level any time in settings.</p>
          </div>
        </main>
      </>
    );
  }

  const q = qs[i];
  const accepted = q.kind === 'vocab' ? [q.item.he, ...(q.item.alt ?? [])] : q.drill.answer;
  const done = result && result.verdict !== 'latin';

  const submit = (given: string) => {
    const r = given ? checkHebrew(given, accepted) : ({ verdict: 'wrong', expected: accepted[0] } as CheckResult);
    setResult(r);
    if (r.verdict === 'latin') return;
    const ok = r.verdict !== 'wrong';
    setScore((s) => s.map((x, k) => (k === q.tier && ok ? x + 1 : x)));
    setCount((c) => c.map((x, k) => (k === q.tier ? x + 1 : x)));
  };
  const next = () => {
    setI(i + 1);
    setValue('');
    setResult(null);
  };

  return (
    <>
      <TopBar title={`Placement ${i + 1}/${qs.length}`} backTo="today" />
      <main class="page">
        <Progress value={i / qs.length} />
        <div class="card">
          {q.kind === 'vocab' ? (
            <div class="prompt-box">
              <div class="small muted">How do you say…</div>
              <div class="big-en">{q.item.en}</div>
              <div class="hint">{q.item.pos}</div>
            </div>
          ) : (
            <div class="prompt-box">
              <div class="small muted">Fill the gap</div>
              {renderPrompt(q.drill.prompt)}
              <div class="hint">{q.drill.en}</div>
            </div>
          )}
          <AnswerInput value={value} onInput={setValue} onEnter={done ? next : () => submit(value)} autoFocus disabled={!!done} />
          {result && <Feedback result={result} />}
          <div class="btn-row">
            {!done ? (
              <>
                <button class="btn ghost" onClick={() => submit('')}>
                  I don't know
                </button>
                <button class="btn primary" onClick={() => submit(value)} disabled={!value.trim()}>
                  Check
                </button>
              </>
            ) : (
              <button class="btn primary block" onClick={next}>
                Next →
              </button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

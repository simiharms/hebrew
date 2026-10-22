import { useState } from 'preact/hooks';
import { AnswerInput } from '../components/answer.tsx';
import { Progress, Seg, TopBar } from '../components/ui.tsx';
import type { Level } from '../content/types.ts';
import { LEVELS } from '../content/types.ts';
import { hasHebrew } from '../lib/hebrew.ts';
import { go } from '../lib/router.ts';
import { type Focus, getState, setState } from '../lib/store.ts';
import { hebrewVoices, speak, ttsSupported } from '../lib/tts.ts';
import { InstallCard } from './me.tsx';
import { isMac, setupHelp } from '../lib/platform.ts';

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
    go(placement ? 'assessment' : 'today');
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
            <p class="small muted">Free, works offline, no account. Progress stays on your device.</p>
            <button class="btn primary block" onClick={() => setStep(1)}>
              Let's set up →
            </button>
          </div>
        )}
        {step === 1 && (
          <div class="card">
            <h3>1. Hebrew keyboard & voice</h3>
            <p class="small">
              Type <span class="he">שלום</span> below. No Hebrew keyboard yet? {setupHelp.device}: <strong>{setupHelp.keyboard}</strong>.
              Then switch with {setupHelp.switchKey}.
            </p>
            <AnswerInput value={kb} onInput={setKb} placeholder="שלום" />
            {kb && (hasHebrew(kb) ? <div class="feedback ok">✓ Hebrew keyboard works</div> : <div class="feedback bad">That's not Hebrew yet — switch keyboards with {setupHelp.switchKey}.</div>)}
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
                No Hebrew voice detected. {setupHelp.device}: <strong>{setupHelp.voice}</strong> ({setupHelp.voiceAfter}).
              </div>
            )}
            {!isMac && (
              <p class="small muted mt">
                Tip: the 🎤 key on the Hebrew keyboard lets you dictate answers — free speaking practice.
              </p>
            )}
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
                Take the 10-min skills check
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

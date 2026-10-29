import { useState } from 'preact/hooks';
import { Seg, SpeakBtn } from '../components/ui.tsx';
import { DEDICATION } from '../gift.ts';
import { go } from '../lib/router.ts';
import { PLAN } from '../lib/plan.ts';
import { seedKnownUpTo } from '../lib/srs.ts';
import { setState, useAppState } from '../lib/store.ts';
import { norwegianVoices, speak, ttsSupported } from '../lib/tts.ts';

export function Onboarding() {
  const s = useAppState();
  const [step, setStep] = useState(0);
  const [lesson, setLesson] = useState(s.lesson);
  const [seed, setSeed] = useState(true);
  const voices = norwegianVoices();

  const finish = () => {
    setState((st) => {
      st.lesson = lesson;
      st.onboarded = true;
    });
    if (seed && lesson > 1) seedKnownUpTo(lesson);
    go('heute');
  };

  return (
    <main class="page onboarding">
      {step === 0 && (
        <div class="center">
          <div class="hero">🌌</div>
          <h1>Velkommen!</h1>
          <p class="lead">Willkommen bei Nordlys – deiner Norwegisch-App zum Lehrbuch »Et år i Norge«.</p>
          {DEDICATION && <div class="card accent dedication">{DEDICATION}</div>}
          <div class="card left">
            <p>Die App geht mit dir durch alle 23 Lektionen des Buches – mit denselben Themen, Orten und derselben Grammatik in derselben Reihenfolge:</p>
            <ul>
              <li>📖 ein Text zu jeder Lektion zum Lesen und Anhören – tippe auf ein Wort, und du siehst, was es heißt</li>
              <li>🗂️ der Wortschatz als Lernkarten, die zur richtigen Zeit wiederkommen</li>
              <li>🧩 die Grammatik auf Deutsch erklärt, mit Übungen</li>
              <li>✏️ Übungen zum Text, Hören, Diktat und Schreiben</li>
            </ul>
            <p class="small muted">Die Texte und Übungen sind neu für diese App geschrieben – sie ergänzen das Buch, sie ersetzen es nicht.</p>
          </div>
          <button class="btn primary block" onClick={() => setStep(1)}>
            Los geht's
          </button>
        </div>
      )}
      {step === 1 && (
        <>
          <h2>Bei welcher Lektion bist du?</h2>
          <p class="muted">Du kannst das später jederzeit ändern. Alle Lektionen bleiben offen.</p>
          <div class="lesson-grid">
            {PLAN.map((p) => (
              <button class={`btn lesson-pick ${lesson === p.n ? 'primary' : ''}`} onClick={() => setLesson(p.n)}>
                <strong>{p.n}</strong>
                <span class="small">{p.title}</span>
              </button>
            ))}
          </div>
          {lesson > 1 && (
            <label class="card tight row">
              <input type="checkbox" checked={seed} onChange={(e) => setSeed((e.target as HTMLInputElement).checked)} />
              <span class="small">
                Die Wörter der Lektionen 1–{lesson - 1} kenne ich schon. Sie kommen in den nächsten Wochen nach und nach zur Wiederholung.
              </span>
            </label>
          )}
          <button class="btn primary block mt" onClick={() => setStep(2)}>
            Weiter
          </button>
        </>
      )}
      {step === 2 && (
        <>
          <h2>Schrift und Stimme</h2>
          <div class="card">
            <div class="small muted">Schriftgröße</div>
            <div class="mt">
              <Seg
                value={s.settings.fontScale}
                options={[
                  { v: 1, label: 'Normal' },
                  { v: 1.15, label: 'Groß' },
                  { v: 1.3, label: 'Sehr groß' },
                ]}
                onChange={(v) =>
                  setState((st) => {
                    st.settings.fontScale = v;
                  })
                }
              />
            </div>
            <p class="no no-md mt">Hei! Jeg heter Susanne. Jeg kommer fra Tyskland.</p>
          </div>
          <div class="card">
            <div class="small muted">Norwegische Stimme</div>
            {ttsSupported() && voices.length > 0 ? (
              <>
                <p>Tippe zum Anhören:</p>
                <SpeakBtn text="Hei, og velkommen til Nordlys! Lykke til med norsken." label="Probe hören" />
              </>
            ) : (
              <p class="small">
                Auf diesem Gerät ist noch keine norwegische Stimme installiert. Auf dem iPhone und iPad: <strong>Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Norwegisch → Nora</strong> (am besten die »erweiterte« Version laden). Auf dem Mac: <strong>Systemeinstellungen → Bedienungshilfen → Gesprochene Inhalte → Systemstimme → Stimmen verwalten → Norwegisch</strong>.
              </p>
            )}
            {ttsSupported() && voices.length > 0 && (
              <button class="btn small ghost mt" onClick={() => speak('Takk for maten!')}>
                Noch ein Beispiel
              </button>
            )}
          </div>
          <div class="card">
            <div class="small muted">æ, ø und å</div>
            <p class="small">
              Unter jedem Eingabefeld gibt es die Tasten <strong>æ ø å</strong>. Auf dem iPhone kannst du auch lange auf <strong>a</strong> oder <strong>o</strong>{' '}
              drücken. Wer viel schreibt, fügt die norwegische Tastatur hinzu: Einstellungen → Allgemein → Tastatur → Tastaturen → Norwegisch.
            </p>
          </div>
          <button class="btn primary block" onClick={finish}>
            Fertig – zur App
          </button>
        </>
      )}
    </main>
  );
}

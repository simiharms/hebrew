// Reading and listening to a lesson text: tap any word, play everything or one line.
import { useEffect, useState } from 'preact/hooks';
import { NoText } from '../components/text.tsx';
import { DeToggle, Seg, TopBar } from '../components/ui.tsx';
import { lessonByN, textById } from '../lib/content.ts';
import { go } from '../lib/router.ts';
import { markDone, setState, useAppState } from '../lib/store.ts';
import { speak, speakerPitches, speakSequence, stopSpeaking, ttsSupported } from '../lib/tts.ts';

export function TextReader({ n, id, main }: { n: number; id: string; main?: boolean }) {
  const s = useAppState();
  const L = lessonByN.get(n);
  const t = textById(n, id);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(-1);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [slow, setSlow] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  if (!L || !t) return <TopBar title="Nicht gefunden" backTo={`lektion/${n}`} />;
  const stepId = main ? `L${n}:text` : `L${n}:${t.id}`;
  const showDe = s.settings.showDe;
  const pitches = t.speakers ? speakerPitches(t.speakers) : {};
  const rate = slow ? Math.max(0.55, s.settings.rate - 0.25) : s.settings.rate;

  const playAll = async (from = 0) => {
    setPlaying(true);
    const items = t.lines.slice(from).map((l) => {
      const sp = l.s ? t.speakers?.[l.s] : undefined;
      return { text: l.no, gender: sp?.gender, pitch: l.s ? pitches[l.s] : undefined };
    });
    const finished = await speakSequence(items, { rate, gap: t.kind === 'dialog' ? 300 : 500, onLine: (i) => setNow(from + i) });
    setPlaying(false);
    setNow(-1);
    if (finished && from === 0) markDone(stepId, 1);
  };
  const stop = () => {
    stopSpeaking();
    setPlaying(false);
    setNow(-1);
  };
  const toggleLine = (i: number) => {
    const next = new Set(open);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setOpen(next);
  };

  return (
    <>
      <TopBar title={t.title} backTo={`lektion/${n}`} />
      <main class="page">
        <div class="card">
          <div class="small muted">{main ? `Leksjon ${n} · Text` : `Leksjon ${n} · ${t.kind === 'song' ? 'Lied' : 'Landeskunde'}`}</div>
          <h2 class="lesson-title">{t.title}</h2>
          <div class="muted">{t.titleDe}</div>
          {t.intro && <p class="small">{t.intro}</p>}
          {t.speakers && (
            <div class="small muted">
              {Object.values(t.speakers)
                .map((sp) => sp.name)
                .join(' · ')}
            </div>
          )}
        </div>

        <div class="reader-tools">
          {ttsSupported() &&
            (playing ? (
              <button class="btn primary" onClick={stop}>
                ⏹ Stopp
              </button>
            ) : (
              <button class="btn primary" onClick={() => playAll(0)}>
                ▶︎ Alles vorlesen
              </button>
            ))}
          <Seg
            value={slow ? 'slow' : 'normal'}
            options={[
              { v: 'normal', label: 'Normal' },
              { v: 'slow', label: 'Langsam' },
            ]}
            onChange={(v) => setSlow(v === 'slow')}
          />
          <DeToggle
            on={showDe}
            onToggle={() =>
              setState((st) => {
                st.settings.showDe = !st.settings.showDe;
              })
            }
          />
        </div>
        <p class="small muted">Tippe auf ein Wort für die Übersetzung, auf ▸ für einen Satz, auf »DE« für die deutsche Übersetzung.</p>

        <div class={`card text-card ${t.kind}`}>
          {t.lines.map((l, i) => {
            const sp = l.s ? t.speakers?.[l.s] : undefined;
            return (
              <div class={`line ${now === i ? 'now' : ''}`}>
                {sp && <div class="speaker">{sp.name}</div>}
                <div class="line-row">
                  <div class="grow">
                    <NoText text={l.no} />
                  </div>
                  <div class="line-tools">
                    <button class="icon-btn small" aria-label="Vorlesen" onClick={() => speak(l.no, { gender: sp?.gender, rate, pitch: l.s ? pitches[l.s] : undefined })}>
                      ▸
                    </button>
                    {!showDe && (
                      <button class="icon-btn small de-btn" aria-label="Übersetzung" onClick={() => toggleLine(i)}>
                        DE
                      </button>
                    )}
                  </div>
                </div>
                {(showDe || open.has(i)) && <div class="de">{l.de}</div>}
              </div>
            );
          })}
        </div>

        <button class="btn block" onClick={() => setShowGlossary(!showGlossary)}>
          {showGlossary ? 'Wörterliste ausblenden' : `Wörter zum Text (${t.glossary.length})`}
        </button>
        {showGlossary && (
          <div class="card">
            <table class="grid gloss">
              <tbody>
                {t.glossary.map((g) => (
                  <tr>
                    <td>
                      <button class="linklike no" onClick={() => speak(g.no)}>
                        {g.no}
                      </button>
                    </td>
                    <td>{g.de}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div class="btn-row">
          <button
            class={`btn ${s.done[stepId] ? 'good' : 'primary'}`}
            onClick={() => {
              markDone(stepId, 1);
              go(`lektion/${n}`);
            }}
          >
            {s.done[stepId] ? '✓ Gelesen' : 'Gelesen – weiter'}
          </button>
        </div>
      </main>
    </>
  );
}

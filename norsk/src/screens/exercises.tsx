// The exercises around a lesson: comprehension, Wörterkiste, listening, writing.
import { useEffect, useState } from 'preact/hooks';
import { Dictation, OpenQuestion, WritingBox } from '../components/answer.tsx';
import { DrillSet, FindSet, TranslateSet, TrueFalseSet } from '../components/exercises.tsx';
import { NoText } from '../components/text.tsx';
import { Seg, SpeakBtn, TopBar } from '../components/ui.tsx';
import { lessonByN } from '../lib/content.ts';
import { go } from '../lib/router.ts';
import { markDone, useAppState } from '../lib/store.ts';
import { speakerPitches, speakSequence, stopSpeaking, ttsSupported } from '../lib/tts.ts';

type Part = 'tf' | 'q' | 'find' | 'translate' | 'summary';
const PARTS: { v: Part; label: string }[] = [
  { v: 'tf', label: 'Richtig/falsch' },
  { v: 'q', label: 'Fragen' },
  { v: 'find', label: 'Finden' },
  { v: 'translate', label: 'Übersetzen' },
  { v: 'summary', label: 'Lücken' },
];

export function ExercisesPage({ n }: { n: number }) {
  const s = useAppState();
  const L = lessonByN.get(n);
  const [part, setPart] = useState<Part>('tf');
  const [showText, setShowText] = useState(false);
  const [qScores, setQScores] = useState<Record<number, number>>({});
  const ids = PARTS.map((p) => `L${n}:${p.v}`);
  const allDone = ids.every((id) => s.done[id]);
  useEffect(() => {
    if (allDone && !s.done[`L${n}:ex`]) markDone(`L${n}:ex`, ids.reduce((a, id) => a + (s.done[id]?.score ?? 0), 0) / ids.length);
  }, [allDone]);
  if (!L) return <TopBar title="Nicht gefunden" backTo="lektionen" />;
  const fullText = L.text.lines.map((l) => l.no).join('\n');

  const onQuestion = (i: number, v: number) => {
    const next = { ...qScores, [i]: v };
    setQScores(next);
    if (Object.keys(next).length === L.questions.length) markDone(`L${n}:q`, Object.values(next).reduce((a, b) => a + b, 0) / L.questions.length);
  };

  return (
    <>
      <TopBar title="Übungen zum Text" backTo={`lektion/${n}`} />
      <main class="page">
        <div class="tabs-scroll">
          <Seg value={part} options={PARTS.map((p) => ({ v: p.v, label: (s.done[`L${n}:${p.v}`] ? '✓ ' : '') + p.label }))} onChange={setPart} />
        </div>
        <button class="btn small ghost mt" onClick={() => setShowText(!showText)}>
          {showText ? 'Text ausblenden' : `Text »${L.text.title}« anzeigen`}
        </button>
        {showText && (
          <div class="card text-card">
            {L.text.lines.map((l) => (
              <div class="line">
                {l.s && <div class="speaker">{L.text.speakers?.[l.s]?.name}</div>}
                <NoText text={l.no} />
              </div>
            ))}
          </div>
        )}
        <div key={part}>
          {part === 'tf' && <TrueFalseSet id={`L${n}:tf`} items={L.tf} />}
          {part === 'q' && (
            <>
              <div class="section-title">Fragen zum Text · antworte auf Norwegisch</div>
              {L.questions.map((q, i) => (
                <OpenQuestion q={q} n={i + 1} onDone={(v) => onQuestion(i, v)} />
              ))}
            </>
          )}
          {part === 'find' && <FindSet id={`L${n}:find`} items={L.find} text={fullText} />}
          {part === 'translate' && <TranslateSet id={`L${n}:translate`} items={L.translate} />}
          {part === 'summary' && <DrillSet id={`L${n}:summary`} drills={L.summary} title="Ergänze die Zusammenfassung" />}
        </div>
        <div class="btn-row">
          {PARTS.findIndex((p) => p.v === part) < PARTS.length - 1 ? (
            <button class="btn" onClick={() => (setPart(PARTS[PARTS.findIndex((p) => p.v === part) + 1].v), window.scrollTo(0, 0))}>
              Nächster Teil ›
            </button>
          ) : (
            <button class="btn primary" onClick={() => go(`lektion/${n}`)}>
              Zur Lektion
            </button>
          )}
        </div>
      </main>
    </>
  );
}

export function WkPage({ n }: { n: number }) {
  const s = useAppState();
  const L = lessonByN.get(n);
  if (!L) return <TopBar title="Nicht gefunden" backTo="lektionen" />;
  const learned = L.wk.phrases.filter((_, i) => s.cards[`p:${n}:${i}`]).length;
  return (
    <>
      <TopBar title="Wörterkiste" backTo={`lektion/${n}`} />
      <main class="page">
        <div class="card">
          <div class="small muted">Leksjon {n} · Wörterkiste</div>
          <h2 class="lesson-title">{L.wk.title}</h2>
          <div class="muted">{L.wk.titleDe}</div>
          <p class="small">
            Nützliche Wendungen zum Thema der Lektion. {learned > 0 && `${learned} von ${L.wk.phrases.length} als Karten gelernt.`}
          </p>
          <button class="btn primary block" onClick={() => go(`lernen/wk/${n}`)}>
            🗂️ Als Karten lernen
          </button>
        </div>
        <div class="list">
          {L.wk.phrases.map((p) => (
            <div class="card tight">
              <div class="row">
                <div class="grow">
                  <NoText text={p.no} />
                  <div class="de">{p.de}</div>
                  {p.note && <div class="small muted">💡 {p.note}</div>}
                </div>
                <SpeakBtn text={p.no} small />
              </div>
            </div>
          ))}
        </div>
        <button class="btn block mt" onClick={() => (markDone(`L${n}:wk`, 1), go(`lektion/${n}`))}>
          {s.done[`L${n}:wk`] ? '✓ Erledigt' : 'Durchgelesen – erledigt'}
        </button>
      </main>
    </>
  );
}

export function ListenPage({ n }: { n: number }) {
  const s = useAppState();
  const L = lessonByN.get(n);
  const [playing, setPlaying] = useState(false);
  const [scores, setScores] = useState<Record<number, number>>({});
  useEffect(() => () => stopSpeaking(), []);
  if (!L) return <TopBar title="Nicht gefunden" backTo="lektionen" />;
  const t = L.text;
  const pitches = t.speakers ? speakerPitches(t.speakers) : {};
  const play = async () => {
    setPlaying(true);
    await speakSequence(
      t.lines.map((l) => ({ text: l.no, gender: l.s ? t.speakers?.[l.s]?.gender : undefined, pitch: l.s ? pitches[l.s] : undefined })),
      { gap: 400 },
    );
    setPlaying(false);
  };
  const onDict = (i: number, v: number) => {
    const next = { ...scores, [i]: v };
    setScores(next);
    if (Object.keys(next).length === L.dictation.length) markDone(`L${n}:listen`, Object.values(next).reduce((a, b) => a + b, 0) / L.dictation.length);
  };
  return (
    <>
      <TopBar title="Hören und Diktat" backTo={`lektion/${n}`} />
      <main class="page">
        <div class="card">
          <h3>1. Nur hören</h3>
          <p class="small">Hör dir den Text »{t.title}« ohne Text an. Was verstehst du? Danach kannst du ihn mitlesen.</p>
          {ttsSupported() ? (
            playing ? (
              <button class="btn primary" onClick={() => (stopSpeaking(), setPlaying(false))}>
                ⏹ Stopp
              </button>
            ) : (
              <button class="btn primary" onClick={play}>
                ▶︎ Text abspielen
              </button>
            )
          ) : (
            <p class="small muted">Dieses Gerät hat keine Sprachausgabe.</p>
          )}
          <button class="btn ghost small" onClick={() => go(`lektion/${n}/text`)}>
            Zum Text
          </button>
        </div>
        <div class="section-title">2. Diktat · {Object.keys(scores).length}/{L.dictation.length}</div>
        {L.dictation.map((i, k) => {
          const line = t.lines[i];
          if (!line) return null;
          const sp = line.s ? t.speakers?.[line.s] : undefined;
          return <Dictation text={line.no} gender={sp?.gender} onDone={(v) => onDict(k, v)} />;
        })}
        {s.done[`L${n}:listen`] && (
          <button class="btn primary block" onClick={() => go(`lektion/${n}`)}>
            ✓ Zur Lektion
          </button>
        )}
      </main>
    </>
  );
}

export function WritePage({ n }: { n: number }) {
  const L = lessonByN.get(n);
  if (!L) return <TopBar title="Nicht gefunden" backTo="lektionen" />;
  return (
    <>
      <TopBar title="Schreiben" backTo={`lektion/${n}`} />
      <main class="page">
        <WritingBox task={L.writing} id={`L${n}:write`} />
      </main>
    </>
  );
}

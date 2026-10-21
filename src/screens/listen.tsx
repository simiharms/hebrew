import { useEffect, useState } from 'preact/hooks';
import { Dictation } from '../components/answer.tsx';
import { HeText, learnGlossary } from '../components/hebrew.tsx';
import { Item, LevelBadge, Seg, TopBar } from '../components/ui.tsx';
import { LEVELS } from '../content/types.ts';
import { levelRank, scenes } from '../lib/content.ts';
import { go } from '../lib/router.ts';
import { getState, useAppState } from '../lib/store.ts';
import { hebrewVoices, speak, speakerPitches, speakSequence, stopSpeaking, ttsSupported } from '../lib/tts.ts';
import { NextUp, QuestionSet } from './read.tsx';

const GENRE_EMOJI: Record<string, string> = {
  sitcom: '😂',
  drama: '🎭',
  news: '📡',
  interview: '🎙️',
  phone: '📞',
  meeting: '💼',
  podcast: '🎧',
  ad: '📣',
  street: '🥙',
};

export function ListenList() {
  const s = useAppState();
  const order = [...LEVELS].sort((a, b) => Math.abs(levelRank(a) - levelRank(s.level)) - Math.abs(levelRank(b) - levelRank(s.level)));
  return (
    <>
      <TopBar title="Listen" />
      <main class="page">
        <div class="card primary small">
          Short TV-style scenes in real spoken Hebrew — slang, interruptions, office talk. Listen <strong>without the text</strong>
          first, answer in Hebrew, then check the transcript.
        </div>
        {!ttsSupported() && <div class="card accent small">This browser has no speech output. On iPhone use Safari.</div>}
        <Item emoji="🔢" title="Numbers by ear" sub="Prices, phone numbers, times — type the digits" onClick={() => go('numbers')} />
        {order.map((lvl) => {
          const list = scenes.filter((x) => x.level === lvl);
          if (!list.length) return null;
          return (
            <>
              <div class="section-title">
                {lvl} {lvl === s.level && '· your level'}
              </div>
              <div class="list">
                {list.map((x) => {
                  const d = s.done[x.id];
                  return (
                    <Item
                      emoji={GENRE_EMOJI[x.genre] ?? '📺'}
                      title={<span class="he he-md">{x.title}</span>}
                      sub={`${x.titleEn} · ${x.genre}`}
                      done={!!d}
                      right={d ? <span class="badge good">{Math.round(d.score * 100)}%</span> : <LevelBadge level={x.level} />}
                      onClick={() => go(`listen/${x.id}`)}
                    />
                  );
                })}
              </div>
            </>
          );
        })}
      </main>
    </>
  );
}

const RATES = [
  { v: 0.65, label: '🐢 Slow' },
  { v: 0.85, label: 'Normal' },
  { v: 1.0, label: 'Fast' },
];

export function ScenePlayer({ id }: { id: string }) {
  const sc = scenes.find((x) => x.id === id);
  const [rate, setRate] = useState(() => {
    const r = getState().settings.rate;
    return RATES.reduce((best, x) => (Math.abs(x.v - r) < Math.abs(best - r) ? x.v : best), 0.85);
  });
  const [playing, setPlaying] = useState(false);
  const [line, setLine] = useState(-1);
  const [plays, setPlays] = useState(0);
  const [showText, setShowText] = useState(false);
  const [showEn, setShowEn] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  if (!sc) return <TopBar title="Not found" backTo="listen" />;
  const pitches = speakerPitches(sc.speakers);

  const play = async (from = 0) => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      setLine(-1);
      return;
    }
    setPlaying(true);
    setPlays((n) => n + 1);
    const items = sc.lines.slice(from).map((l) => ({ text: l.he, gender: sc.speakers[l.s]?.gender, pitch: pitches[l.s] }));
    await speakSequence(items, { rate, gap: 450, onLine: (i) => setLine(from + i) });
    setPlaying(false);
    setLine(-1);
  };

  const voices = hebrewVoices().length;

  return (
    <>
      <TopBar title={sc.titleEn} backTo="listen" right={<LevelBadge level={sc.level} />} />
      <main class="page">
        <div class="card">
          <div class="row">
            <span style={{ fontSize: 28 }}>{GENRE_EMOJI[sc.genre] ?? '📺'}</span>
            <HeText text={sc.title} size="lg" />
          </div>
          <p class="small">{sc.synopsis}</p>
          <div class="chip-row">
            {Object.values(sc.speakers).map((sp) => (
              <span class="chip">
                <span class="he">{sp.name}</span> {sp.gender === 'f' ? '♀' : '♂'}
              </span>
            ))}
          </div>
          <div class="mt">
            <Seg value={rate} options={RATES} onChange={setRate} />
          </div>
          <div class="btn-row">
            <button class="btn primary" onClick={() => play(0)}>
              {playing ? '■ Stop' : plays ? '▶ Play again' : '▶ Play scene'}
            </button>
          </div>
          {playing && line >= 0 && !showText && (
            <div class="small muted mt center">
              line {line + 1} / {sc.lines.length} · <span class="he">{sc.speakers[sc.lines[line].s]?.name}</span>
            </div>
          )}
          {voices === 0 && ttsSupported() && (
            <div class="card tight accent small">
              No Hebrew voice found. On iPhone: Settings → Accessibility → Spoken Content → Voices → Hebrew → download “Carmit”.
            </div>
          )}
        </div>

        <QuestionSet id={sc.id} questions={sc.questions} />

        <div class="section-title">Transcript</div>
        {!showText ? (
          <button class="btn block" onClick={() => setShowText(true)}>
            Show transcript {plays === 0 && '(try listening first!)'}
          </button>
        ) : (
          <div class="card">
            <div class="row">
              <button class="btn small ghost" onClick={() => setShowEn(!showEn)}>
                {showEn ? 'Hide English' : 'Show English'}
              </button>
            </div>
            {sc.lines.map((l, i) => (
              <div class={`line ${line === i ? 'now' : ''}`}>
                <div class="row">
                  <span class="speaker he">{sc.speakers[l.s]?.name}</span>
                  <div class="spacer" />
                  <button class="btn small ghost" onClick={() => speak(l.he, { gender: sc.speakers[l.s]?.gender, pitch: pitches[l.s], rate })}>
                    🔊
                  </button>
                </div>
                <HeText text={l.he} />
                {showEn && <div class="en">{l.en}</div>}
              </div>
            ))}
          </div>
        )}

        {sc.dictation.length > 0 && (
          <>
            <div class="section-title">Dictation</div>
            {sc.dictation.map((i) => (
              <Dictation text={sc.lines[i].he} gender={sc.speakers[sc.lines[i].s]?.gender} />
            ))}
          </>
        )}

        {sc.expressions.length > 0 && (
          <>
            <div class="section-title">Expressions from this scene</div>
            <div class="card">
              <button class="btn small mb" onClick={() => learnGlossary(sc.expressions)}>
                ＋ Add to my word reviews
              </button>
              {sc.expressions.map((e) => (
                <div class="mb">
                  <div class="row">
                    <span class="he he-md">{e.he}</span>
                    <span>— {e.en}</span>
                  </div>
                  {e.note && <div class="small muted">{e.note}</div>}
                </div>
              ))}
            </div>
          </>
        )}
        <NextUp level={sc.level} currentId={sc.id} kind="listen" />
      </main>
    </>
  );
}

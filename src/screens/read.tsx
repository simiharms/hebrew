import { useState } from 'preact/hooks';
import { OpenQuestion, WritingBox } from '../components/answer.tsx';
import { HeText, learnGlossary } from '../components/hebrew.tsx';
import { Item, LevelBadge, SpeakBtn, TopBar } from '../components/ui.tsx';
import type { Level, Question } from '../content/types.ts';
import { LEVELS } from '../content/types.ts';
import { levelRank, readings, scenes } from '../lib/content.ts';
import { go } from '../lib/router.ts';
import { record } from '../lib/skills.ts';
import { getState, markDone, markTask, useAppState } from '../lib/store.ts';
import { speakSequence, stopSpeaking } from '../lib/tts.ts';

const KIND_EMOJI: Record<string, string> = {
  news: '🗞️',
  article: '📄',
  email: '📧',
  blog: '✏️',
  story: '📖',
  ad: '🏷️',
  interview: '🎙️',
  notice: '📌',
};

export function ReadList() {
  const s = useAppState();
  const order = [...LEVELS].sort((a, b) => Math.abs(levelRank(a) - levelRank(s.level)) - Math.abs(levelRank(b) - levelRank(s.level)));
  return (
    <>
      <TopBar title="Read" />
      <main class="page">
        <div class="card primary small">
          Tap any word for its meaning, root and prefixes. Answer the questions <strong>in Hebrew</strong> — that's where the learning happens.
        </div>
        <Item emoji="🗞️" title="News" sub="This week's news in easy Hebrew, plus today's real headlines ranked for your level" onClick={() => go('news')} />
        <Item emoji="📋" title="Your own text" sub="Paste any Hebrew: news, subtitles, messages" onClick={() => go('own')} />
        {order.map((lvl) => {
          const list = readings.filter((r) => r.level === lvl && !r.date);
          if (!list.length) return null;
          return (
            <>
              <div class="section-title">
                {lvl} {lvl === s.level && '· your level'}
              </div>
              <div class="list">
                {list.map((r) => {
                  const d = s.done[r.id];
                  return (
                    <Item
                      emoji={KIND_EMOJI[r.kind] ?? '📄'}
                      title={<span class="he he-md">{r.title}</span>}
                      sub={`${r.titleEn} · ${r.paragraphs.map((p) => p.he).join(' ').split(/\s+/).length} words`}
                      done={!!d}
                      right={d ? <span class="badge good">{Math.round(d.score * 100)}%</span> : <LevelBadge level={r.level} />}
                      onClick={() => go(`read/${r.id}`)}
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

export function QuestionSet({ id, questions, skill }: { id: string; questions: Question[]; skill: 'reading' | 'listening' }) {
  const [scores, setScores] = useState<(number | undefined)[]>(() => questions.map(() => undefined));
  const answered = scores.filter((x) => x !== undefined).length;
  const set = (i: number, v: number) => {
    const next = [...scores];
    if (next[i] === undefined) record(skill, v);
    next[i] = v;
    setScores(next);
    if (next.every((x) => x !== undefined)) {
      const avg = (next as number[]).reduce((a, b) => a + b, 0) / next.length;
      markDone(id, avg);
      markTask(id);
    }
  };
  return (
    <>
      <div class="section-title">
        Questions · {answered}/{questions.length}
      </div>
      {questions.map((q, i) => (
        <OpenQuestion q={q} n={i + 1} onDone={(v) => set(i, v)} />
      ))}
    </>
  );
}

export function Reader({ id }: { id: string }) {
  const r = readings.find((x) => x.id === id);
  const [showEn, setShowEn] = useState<Record<number, boolean>>({});
  const [playing, setPlaying] = useState(false);
  const [showGloss, setShowGloss] = useState(false);
  if (!r) return <TopBar title="Not found" backTo="read" />;
  const showTr = getState().settings.showTr;

  const readAll = async () => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    await speakSequence(r.paragraphs.map((p) => ({ text: p.he })), { gap: 500 });
    setPlaying(false);
  };

  return (
    <>
      <TopBar title={r.titleEn} backTo="read" right={<LevelBadge level={r.level} />} />
      <main class="page">
        <div class="card">
          <HeText text={r.title} size="lg" />
          <div class="btn-row">
            <button class="btn" onClick={readAll}>
              {playing ? '■ Stop' : '🔊 Read aloud'}
            </button>
            <button class="btn" onClick={() => setShowGloss(!showGloss)}>
              📚 Key words ({r.glossary.length})
            </button>
          </div>
          {showGloss && (
            <button class="btn small mt" onClick={() => learnGlossary(r.glossary)}>
              ＋ Add these to my word reviews
            </button>
          )}
          {showGloss && (
            <table class="grid mt">
              <tbody>
                {r.glossary.map((g) => (
                  <tr>
                    <td class="he" style={{ fontSize: 19 }}>{g.he}</td>
                    <td>
                      {g.en}
                      {showTr && g.tr && <div class="tr small">{g.tr}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div class="card">
          {r.paragraphs.map((p, i) => (
            <>
              <div class="para">
                <HeText text={p.he} />
              </div>
              {showEn[i] && <div class="en mb">{p.en}</div>}
              <div class="para-tools">
                <SpeakBtn text={p.he} small />
                <button class="btn small ghost" onClick={() => setShowEn({ ...showEn, [i]: !showEn[i] })}>
                  {showEn[i] ? 'Hide' : 'EN'}
                </button>
              </div>
            </>
          ))}
        </div>
        <QuestionSet id={r.id} questions={r.questions} skill="reading" />
        {r.writing && (
          <>
            <div class="section-title">Your turn</div>
            <WritingBox task={r.writing} id={`${r.id}:w`} />
          </>
        )}
        {r.sources && (
          <div class="card tight small">
            <div class="muted">
              {r.date && <>Easy-news issue of {new Date(`${r.date}T12:00:00`).toLocaleDateString()}. </>}Facts from:
            </div>
            {r.sources.map((src) => (
              <div>
                <a href={src.url} target="_blank" rel="noopener">
                  {src.name} ↗
                </a>
              </div>
            ))}
          </div>
        )}
        <NextUp level={r.level} currentId={r.id} kind="read" />
      </main>
    </>
  );
}

export function NextUp({ level, currentId, kind }: { level: Level; currentId: string; kind: 'read' | 'listen' }) {
  const s = getState();
  const list: { id: string; level: Level; titleEn: string }[] = kind === 'read' ? readings.filter((x) => !x.date) : scenes;
  const next = list.find((x) => x.id !== currentId && !s.done[x.id] && levelRank(x.level) >= levelRank(level));
  if (!next) return null;
  return (
    <div class="btn-row mt">
      <button class="btn" onClick={() => go(`${kind}/${next.id}`)}>
        Next: {next.titleEn} →
      </button>
    </div>
  );
}

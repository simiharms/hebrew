import { useState } from 'preact/hooks';
import { WritingBox } from '../components/answer.tsx';
import { HeText } from '../components/hebrew.tsx';
import { Item, LevelBadge, SpeakBtn, TopBar } from '../components/ui.tsx';
import { emails } from '../lib/content.ts';
import { go } from '../lib/router.ts';
import { getState, useAppState } from '../lib/store.ts';

export function WriteList() {
  const s = useAppState();
  return (
    <>
      <TopBar title="Writing at work" backTo="practice" />
      <main class="page">
        <div class="card primary small">
          Real messages from colleagues, clients and landlords. Reply in Hebrew; the checklist ticks off as you cover each point,
          then compare with a model reply.
        </div>
        <div class="list">
          {emails.map((e) => {
            const d = s.done[`${e.id}:w`];
            return (
              <Item
                emoji={e.incoming?.from ? '📨' : '✍️'}
                title={e.title}
                sub={e.situation}
                done={!!d}
                right={d ? <span class="badge good">done</span> : <LevelBadge level={e.level} />}
                onClick={() => go(`write/${e.id}`)}
              />
            );
          })}
        </div>
      </main>
    </>
  );
}

export function WriteTask({ id }: { id: string }) {
  const e = emails.find((x) => x.id === id);
  const [showEn, setShowEn] = useState(false);
  const [showPhrases, setShowPhrases] = useState(true);
  if (!e) return <TopBar title="Not found" backTo="write" />;
  const showTr = getState().settings.showTr;
  return (
    <>
      <TopBar title={e.title} backTo="write" right={<LevelBadge level={e.level} />} />
      <main class="page">
        <p class="small muted">{e.situation}</p>
        {e.incoming && (
          <div class="card">
            <div class="row small muted">
              <span>
                From: <span class="he">{e.incoming.from}</span>
              </span>
              <div class="spacer" />
              <SpeakBtn text={e.incoming.body} small />
              <button class="btn small ghost" onClick={() => setShowEn(!showEn)}>
                EN
              </button>
            </div>
            <div class="he" style={{ fontWeight: 650, fontSize: 18 }}>
              {e.incoming.subject}
            </div>
            <hr class="sep" />
            <div class="pre">
              <HeText text={e.incoming.body} />
            </div>
            {showEn && <div class="en mt pre">{e.incoming.bodyEn}</div>}
          </div>
        )}
        <div class="section-title row">
          Useful phrases
          <div class="spacer" />
          <button class="btn small ghost" onClick={() => setShowPhrases(!showPhrases)}>
            {showPhrases ? 'hide' : 'show'}
          </button>
        </div>
        {showPhrases && (
          <div class="card tight">
            <table class="grid">
              <tbody>
                {e.phrases.map((p) => (
                  <tr>
                    <td class="he" style={{ fontSize: 18 }}>{p.he}</td>
                    <td>
                      {p.en}
                      {showTr && p.tr && <div class="tr small">{p.tr}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <WritingBox task={e.task} id={`${e.id}:w`} />
      </main>
    </>
  );
}

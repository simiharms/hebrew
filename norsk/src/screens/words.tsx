import { useState } from 'preact/hooks';
import { Item, Progress, SpeakBtn, TopBar } from '../components/ui.tsx';
import type { Word } from '../content/types.ts';
import { display, lessonByN, searchWords, words, wordsOfLesson } from '../lib/content.ts';
import { strength } from '../lib/fsrs.ts';
import { PLAN } from '../lib/plan.ts';
import { go } from '../lib/router.ts';
import { dueCount, isStarred, lessonWordProgress, newLeftToday, newWordQueue, toggleStar } from '../lib/srs.ts';
import { useAppState } from '../lib/store.ts';
import { speak } from '../lib/tts.ts';

export function WordsHome() {
  const s = useAppState();
  const [q, setQ] = useState('');
  const hits = q.trim() ? searchWords(q) : [];
  const due = dueCount(s);
  const newLeft = Math.min(newLeftToday(s), newWordQueue(s).length);
  const known = words.filter((w) => s.cards[`w:${w.id}`]).length;
  const starred = s.starred.length;
  return (
    <>
      <TopBar title="Wörter" />
      <main class="page">
        <div class="stats">
          <div class="stat">
            <div class="num">{known}</div>
            <div class="lbl">gelernt</div>
          </div>
          <div class="stat">
            <div class="num">{due}</div>
            <div class="lbl">fällig</div>
          </div>
          <div class="stat">
            <div class="num">{words.length}</div>
            <div class="lbl">im Buch</div>
          </div>
        </div>
        <button class="btn primary block mt" onClick={() => go('lernen')} disabled={due + newLeft === 0}>
          {due + newLeft > 0 ? `🗂️ Jetzt üben (${due + newLeft})` : '✓ Für heute alles geübt'}
        </button>
        <input class="search mt" type="search" placeholder="Suchen – Norwegisch oder Deutsch" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        {q.trim() ? (
          <div class="list mt">
            {hits.length === 0 && <div class="muted small">Nichts gefunden.</div>}
            {hits.map((w) => (
              <WordRow w={w} />
            ))}
          </div>
        ) : (
          <>
            {starred > 0 && (
              <div class="list mt">
                <Item emoji="★" title="Markierte Wörter" sub={`${starred} Karten`} onClick={() => go('lernen/markiert')} />
              </div>
            )}
            <div class="section-title">Nach Lektion</div>
            <div class="list">
              {PLAN.map((p) => {
                const pr = lessonWordProgress(s, p.n);
                if (!pr.total) return null;
                return (
                  <Item
                    emoji={pr.learned === pr.total ? '✅' : String(p.n)}
                    title={p.title}
                    sub={
                      <>
                        {pr.learned}/{pr.total} Wörter gelernt
                        <Progress value={pr.learned / pr.total} />
                      </>
                    }
                    onClick={() => go(`woerter/${p.n}`)}
                  />
                );
              })}
            </div>
          </>
        )}
      </main>
    </>
  );
}

function WordRow({ w }: { w: Word }) {
  const s = useAppState();
  const st = strength(s.cards[`w:${w.id}`]);
  const dot = st === 'new' ? '' : st === 'learning' ? '🟡' : st === 'known' ? '🟢' : '🌲';
  return (
    <div class="word-row" onClick={() => speak(display(w))}>
      <div class="grow">
        <div>
          <span class="no">{display(w)}</span> {dot}
        </div>
        <div class="small muted">
          {w.de}
          {w.pos === 'noun' && w.forms && ` · ${w.forms.slice(1).join(', ')}`}
          {w.vf && ` · ${w.vf.slice(0, 3).filter(Boolean).join(', ')}`}
        </div>
      </div>
      <span class="badge">L{w.lesson}</span>
      <button
        class="icon-btn"
        aria-label="Markieren"
        onClick={(e) => {
          e.stopPropagation();
          toggleStar(`w:${w.id}`);
        }}
      >
        {isStarred(`w:${w.id}`) ? '★' : '☆'}
      </button>
    </div>
  );
}

export function LessonWords({ n }: { n: number }) {
  const s = useAppState();
  const L = lessonByN.get(n);
  const list = wordsOfLesson(n);
  const pr = lessonWordProgress(s, n);
  const fresh = newWordQueue(s, n).length;
  const plan = PLAN.find((p) => p.n === n);
  return (
    <>
      <TopBar title={`Wörter · Lektion ${n}`} backTo={`lektion/${n}`} />
      <main class="page">
        <div class="card">
          <h2 class="lesson-title">{plan?.title}</h2>
          <div class="small muted">
            {pr.learned} von {pr.total} Wörtern gelernt
          </div>
          <Progress value={pr.total ? pr.learned / pr.total : 0} />
          <div class="btn-row">
            <button class="btn primary" disabled={!fresh} onClick={() => go(`lernen/lektion/${n}`)}>
              {fresh ? `🗂️ Lernen (${Math.min(12, fresh)} von ${fresh} neu)` : '✓ Alle gelernt'}
            </button>
            {L && L.wk.phrases.length > 0 && (
              <button class="btn" onClick={() => go(`lektion/${n}/woerterkiste`)}>
                💬 Wörterkiste
              </button>
            )}
          </div>
          <p class="small muted">Tippe auf ein Wort, um es zu hören. 🟡 in Arbeit · 🟢 sitzt · 🌲 sitzt fest</p>
        </div>
        <div class="list">
          {list.map((w) => (
            <WordRow w={w} />
          ))}
        </div>
        {list.length > 0 && <SpeakBtn text={list.slice(0, 20).map(display).join('. ')} label="Die ersten 20 vorlesen" />}
      </main>
    </>
  );
}

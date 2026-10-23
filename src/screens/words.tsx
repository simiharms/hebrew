import { useState } from 'preact/hooks';
import { queueWord, showGloss } from '../components/hebrew.tsx';
import { Item, LevelBadge, Seg, SpeakBtn, TopBar } from '../components/ui.tsx';
import type { VocabItem } from '../content/types.ts';
import { WORD_LEVELS } from '../content/types.ts';
import { allRoots, allVocab, displayRoot, rootFamily, TOPIC_LABELS } from '../lib/content.ts';
import { strength } from '../lib/fsrs.ts';
import { lenient, normalizeEn } from '../lib/hebrew.ts';
import { go } from '../lib/router.ts';
import { dueWordCards, newWordsLeft } from '../lib/session.ts';
import { type AppState, useAppState } from '../lib/store.ts';

const STRENGTH_BADGE: Record<string, [string, string]> = {
  new: ['', 'new'],
  learning: ['warn', 'learning'],
  known: ['good', 'known'],
  mature: ['good', 'solid'],
};

function WordRow({ v, s }: { v: VocabItem; s: AppState }) {
  const st = strength(s.cards[`v:${v.id}`]);
  const queued = s.queue.includes(v.id);
  const [cls, label] = STRENGTH_BADGE[st];
  return (
    <div class="item" onClick={() => showGloss(v.he)}>
      <span class="grow">
        <div class="he he-md">{v.he}</div>
        <div class="sub">
          {v.en}
          {v.tr && s.settings.showTr ? ` · ${v.tr}` : ''}
        </div>
      </span>
      {st === 'new' && !queued ? (
        <button
          class="btn small"
          onClick={(e) => {
            e.stopPropagation();
            queueWord(v.id);
          }}
        >
          ＋
        </button>
      ) : (
        <span class={`badge ${cls}`}>{queued && st === 'new' ? 'queued' : label}</span>
      )}
    </div>
  );
}

export function WordsHome() {
  const s = useAppState();
  const [tab, setTab] = useState<'topics' | 'roots' | 'search'>('topics');
  const [q, setQ] = useState('');
  const vocab = allVocab();
  const due = dueWordCards().length;
  const fresh = newWordsLeft();
  const counts = { learning: 0, known: 0, mature: 0 };
  for (const v of vocab) {
    const st = strength(s.cards[`v:${v.id}`]);
    if (st !== 'new') counts[st]++;
  }
  const topics = [...new Set(vocab.map((v) => v.topic))];

  const ql = q.trim();
  const results = ql
    ? vocab
        .filter((v) => (/[א-ת]/.test(ql) ? lenient(v.he).includes(lenient(ql)) || lenient(v.plural ?? '').includes(lenient(ql)) : normalizeEn(v.en).includes(normalizeEn(ql)) || (v.enAlt ?? []).some((a) => normalizeEn(a).includes(normalizeEn(ql)))))
        .slice(0, 60)
    : [];

  return (
    <>
      <TopBar title="Words" />
      <main class="page">
        <div class="card primary">
          <div class="row">
            <div class="grow">
              <h3>Practice words</h3>
              <div class="small">
                {due} due · {fresh} new today
              </div>
            </div>
            <button class="btn primary" onClick={() => go('session/words')}>
              Start
            </button>
          </div>
        </div>
        <Item emoji="🃏" title="Card decks" sub="Flip cards by topic, level and binyan, plus the alphabet" onClick={() => go('decks')} />
        <div class="stats">
          <div class="stat">
            <div class="num">{counts.learning}</div>
            <div class="lbl">learning</div>
          </div>
          <div class="stat">
            <div class="num">{counts.known}</div>
            <div class="lbl">known</div>
          </div>
          <div class="stat">
            <div class="num">{counts.mature}</div>
            <div class="lbl">solid (3+ wks)</div>
          </div>
        </div>
        <div class="mt">
          <Seg
            value={tab}
            options={[
              { v: 'topics', label: 'Topics' },
              { v: 'roots', label: '🌱 Roots' },
              { v: 'search', label: '🔎 Search' },
            ]}
            onChange={setTab}
          />
        </div>
        {tab === 'topics' && (
          <div class="list mt">
            {topics.map((t) => {
              const items = vocab.filter((v) => v.topic === t);
              const known = items.filter((v) => ['known', 'mature'].includes(strength(s.cards[`v:${v.id}`]))).length;
              return (
                <Item
                  title={TOPIC_LABELS[t] ?? t}
                  sub={`${items.length} words · ${known} known`}
                  onClick={() => go(`words/topic/${t}`)}
                  right={<span class="muted">›</span>}
                />
              );
            })}
            <Item emoji="📋" title="Verb conjugation tables" sub="All verbs by binyan" onClick={() => go('verbs')} />
          </div>
        )}
        {tab === 'roots' && (
          <>
            <p class="small muted mt">
              Most Hebrew words are built from a 3-letter root. Learn the family once and you can guess new words in articles.
            </p>
            <div class="chip-row">
              {allRoots().map((r) => (
                <button class="chip" onClick={() => go(`words/root/${r.root}`)}>
                  <span class="he" style={{ fontSize: 18 }}>{displayRoot(r.root)}</span> <span class="muted">{r.count}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {tab === 'search' && (
          <>
            <input
              class="answer ltr mt"
              placeholder="Search Hebrew or English"
              value={q}
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              onInput={(e) => setQ((e.target as HTMLInputElement).value)}
            />
            <div class="list mt">
              {results.map((v) => (
                <WordRow v={v} s={s} />
              ))}
              {ql && !results.length && <div class="muted center">No matches.</div>}
            </div>
          </>
        )}
      </main>
    </>
  );
}

export function TopicPage({ topic }: { topic: string }) {
  const s = useAppState();
  const items = allVocab().filter((v) => v.topic === topic);
  const levels = WORD_LEVELS;
  return (
    <>
      <TopBar title={TOPIC_LABELS[topic] ?? topic} backTo="words" />
      <main class="page">
        <p class="small muted">Tap a word for details. ＋ adds it to your next session.</p>
        <button
          class="btn block"
          onClick={() => {
            items.filter((v) => strength(s.cards[`v:${v.id}`]) === 'new' && !s.queue.includes(v.id)).slice(0, 10).forEach((v) => queueWord(v.id));
          }}
        >
          ＋ Queue the next 10 new words from this topic
        </button>
        {levels.map((l) => {
          const list = items.filter((v) => v.level === l);
          if (!list.length) return null;
          return (
            <>
              <div class="section-title">{l}</div>
              <div class="list">
                {list.map((v) => (
                  <WordRow v={v} s={s} />
                ))}
              </div>
            </>
          );
        })}
      </main>
    </>
  );
}

export function RootPage({ root }: { root: string }) {
  const s = useAppState();
  const fam = rootFamily(root);
  return (
    <>
      <TopBar title={`Root ${displayRoot(root)}`} backTo="words" />
      <main class="page">
        <div class="card center">
          <div class="he he-xl" style={{ textAlign: 'center', letterSpacing: '0.2em' }}>
            {displayRoot(root)}
          </div>
          <p class="small muted">
            {fam.vocab.length + fam.verbs.length} words share this root. Notice how the pattern around the root letters changes the
            meaning.
          </p>
        </div>
        {fam.verbs.length > 0 && <div class="section-title">Verbs</div>}
        <div class="list">
          {fam.verbs.map((v) => (
            <Item
              title={
                <>
                  <span class="he he-md">{v.inf}</span> <span class="muted">· {v.en}</span>
                </>
              }
              sub={v.binyan}
              right={<LevelBadge level={v.level} />}
              onClick={() => go(`verb/${v.id}`)}
            />
          ))}
        </div>
        {fam.vocab.length > 0 && <div class="section-title">Words</div>}
        <div class="list">
          {fam.vocab.map((v) => (
            <WordRow v={v} s={s} />
          ))}
        </div>
        {fam.vocab[0] && (
          <div class="mt center">
            <SpeakBtn text={[...fam.verbs.map((v) => v.inf), ...fam.vocab.map((v) => v.he)].join(', ')} label="Hear the family" />
          </div>
        )}
      </main>
    </>
  );
}

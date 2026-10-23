import { useEffect, useMemo, useState } from 'preact/hooks';
import { HeText } from '../components/hebrew.tsx';
import { Item, Progress, Seg, SpeakBtn, TopBar } from '../components/ui.tsx';
import { allDecks, type Card, type Deck, deckById, deckQueue } from '../lib/decks.ts';
import { type Rating, review, strength } from '../lib/fsrs.ts';
import { go } from '../lib/router.ts';
import { record } from '../lib/skills.ts';
import { type AppState, getState, setState, todayLog, useAppState } from '../lib/store.ts';
import { speak } from '../lib/tts.ts';
import { SessionDone } from './session-words.tsx';

function deckStats(deck: Deck, s: AppState, now = Date.now()) {
  const cards = deck.cards();
  let learned = 0;
  let due = 0;
  for (const c of cards) {
    const st = s.cards[c.id];
    if (!st) continue;
    if (strength(st) === 'known' || strength(st) === 'mature') learned++;
    if (st.due <= now) due++;
  }
  return { total: cards.length, learned, due, started: cards.some((c) => s.cards[c.id]) };
}

export function DecksPage() {
  const s = useAppState();
  const decks = allDecks();
  const groups = [...new Set(decks.map((d) => d.group))];
  return (
    <>
      <TopBar title="Card decks" backTo="words" />
      <main class="page">
        <div class="card primary small">
          Flip a card, say the answer to yourself, then rate how well you knew it. Cards you find hard come back sooner. Word
          cards share their schedule with your daily word reviews.
        </div>
        {groups.map((g) => (
          <>
            <div class="section-title">{g}</div>
            <div class="list">
              {decks
                .filter((d) => d.group === g)
                .map((d) => {
                  const st = deckStats(d, s);
                  return (
                    <Item
                      emoji={d.kind === 'verbs' ? '🔁' : d.kind === 'letters' ? '🔤' : '🃏'}
                      title={d.title}
                      sub={`${d.sub}${st.started ? ` · ${st.learned}/${st.total} learned` : ''}`}
                      right={st.due ? <span class="badge warn">{st.due} due</span> : <span class="muted">›</span>}
                      onClick={() => go(`deck/${d.id}`)}
                    />
                  );
                })}
            </div>
          </>
        ))}
      </main>
    </>
  );
}

export function DeckPage({ id }: { id: string }) {
  const s = useAppState();
  const deck = deckById(id);
  const [browse, setBrowse] = useState(false);
  if (!deck) return <TopBar title="Deck not found" backTo="decks" />;
  const st = deckStats(deck, s);
  const cards = deck.cards();
  const typeRoute = deck.kind === 'words' ? `session/words/${deck.id}` : deck.kind === 'verbs' ? `session/vdeck/${deck.id}` : null;
  return (
    <>
      <TopBar title={deck.title} backTo="decks" />
      <main class="page">
        <div class="card">
          <div class="small muted">{deck.sub}</div>
          <div class="stats mt">
            <div class="stat">
              <div class="num">{st.total}</div>
              <div class="lbl">cards</div>
            </div>
            <div class="stat">
              <div class="num">{st.learned}</div>
              <div class="lbl">learned</div>
            </div>
            <div class="stat">
              <div class="num">{st.due}</div>
              <div class="lbl">due now</div>
            </div>
          </div>
          {deck.kind !== 'letters' && (
            <>
              <div class="small muted mt">Show first</div>
              <Seg
                value={s.settings.deckDir}
                options={[
                  { v: 'he2en', label: 'Hebrew' },
                  { v: 'en2he', label: 'English' },
                ]}
                onChange={(v) => setState((x) => void (x.settings.deckDir = v))}
              />
            </>
          )}
          <div class="btn-row">
            <button class="btn primary" onClick={() => go(`session/deck/${deck.id}`)} disabled={!cards.length}>
              🃏 Flip cards
            </button>
            {typeRoute && (
              <button class="btn" onClick={() => go(typeRoute)} disabled={!cards.length}>
                ⌨️ {deck.kind === 'verbs' ? 'Drill these verbs' : 'Type the answers'}
              </button>
            )}
          </div>
        </div>
        {!cards.length && <div class="card small muted">No cards here yet. Star cards while you study to fill this deck.</div>}
        {cards.length > 0 && (
          <button class="btn ghost block" onClick={() => setBrowse(!browse)}>
            {browse ? 'Hide the cards' : `Browse all ${cards.length} cards`}
          </button>
        )}
        {browse && (
          <div class="list mt">
            {cards.map((c) => (
              <Item
                title={
                  <>
                    <span class="he he-md">{c.he}</span> <span class="muted">· {c.en}</span>
                  </>
                }
                sub={c.tr}
                right={<StarBtn id={c.id} />}
                onClick={() => (c.verb ? go(`verb/${c.verb.id}`) : speak(c.speak))}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

export function StarBtn({ id }: { id: string }) {
  const s = useAppState();
  const on = s.starred.includes(id);
  return (
    <button
      class="btn small ghost"
      aria-label={on ? 'Unstar' : 'Star'}
      onClick={(e) => {
        e.stopPropagation();
        setState((x) => {
          x.starred = on ? x.starred.filter((y) => y !== id) : [...x.starred, id];
        });
      }}
    >
      {on ? '⭐' : '☆'}
    </button>
  );
}

const RATINGS: [Rating, string, string][] = [
  [1, 'Again', 'bad'],
  [2, 'Hard', 'close'],
  [3, 'Good', 'ok'],
  [4, 'Easy', 'ok'],
];

export function FlipSession({ id }: { id: string }) {
  const deck = deckById(id);
  const initial = useMemo(() => (deck ? deckQueue(deck, deck.kind === 'letters' ? 14 : 10) : []), [id]);
  const [queue, setQueue] = useState<Card[]>(initial);
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(false);
  const [stats, setStats] = useState({ right: 0, total: 0 });
  const rated = useMemo(() => new Set<string>(), []);
  const dir = getState().settings.deckDir;

  const card = queue[idx];
  const heFirst = deck?.kind === 'letters' || dir === 'he2en';

  const rate = (g: Rating) => {
    if (!card) return;
    if (!rated.has(card.id)) {
      rated.add(card.id);
      setState((s) => {
        const prev = s.cards[card.id];
        s.cards[card.id] = review(prev, g, Date.now(), s.settings.retention);
        const log = todayLog(s);
        if (!prev && card.id.startsWith('v:')) log.newWords++;
        log.reviews++;
        if (g >= 3) log.correct++;
      });
      record(card.verb ? 'verbs' : 'vocab', g >= 3 ? 1 : g === 2 ? 0.6 : 0, [], 0.5);
      setStats((x) => ({ right: x.right + (g >= 3 ? 1 : 0), total: x.total + 1 }));
    }
    const q = [...queue];
    // Cards you didn't know come back once more at the end of the session.
    if (g === 1 && q.slice(idx + 1).every((c) => c.id !== card.id)) q.push(card);
    setQueue(q);
    setIdx(idx + 1);
    setShown(false);
  };

  // Mac and keyboard users: space shows the answer, 1–4 rate it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!shown && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setShown(true);
      } else if (shown && ['1', '2', '3', '4'].includes(e.key)) rate(Number(e.key) as Rating);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (card && heFirst && !shown) speak(card.speak);
  }, [idx]);

  if (!deck) return <TopBar title="Deck not found" backTo="decks" />;
  if (!initial.length) {
    return (
      <>
        <TopBar title={deck.title} backTo={`deck/${id}`} />
        <main class="page">
          <div class="card center">
            <h2>Nothing due 🎉</h2>
            <p class="muted">You've seen every card in this deck and none is due yet.</p>
            <button class="btn primary" onClick={() => go(`deck/${id}`)}>
              Back to the deck
            </button>
          </div>
        </main>
      </>
    );
  }
  if (idx >= queue.length) return <SessionDone task={`deck:${id}`} right={stats.right} total={stats.total} doneId={`deck:${id}`} />;

  const front = heFirst ? (
    <div class={`he ${deck.kind === 'letters' ? 'he-xl' : 'he-lg'}`} style={deck.kind === 'letters' ? { fontSize: 96, lineHeight: 1.1 } : undefined}>
      {card.he}
    </div>
  ) : (
    <div class="big-en">{card.en}</div>
  );

  return (
    <>
      <TopBar title={deck.title} backTo={`deck/${id}`} right={<span class="small muted">{idx + 1}/{queue.length}</span>} />
      <main class="page">
        <Progress value={idx / queue.length} />
        <div class="card center flip-card">
          <div class="row">
            {!getState().cards[card.id] && <span class="badge warn">new</span>}
            <div class="spacer" />
            <StarBtn id={card.id} />
          </div>
          <div class="prompt-box">{front}</div>
          {shown ? (
            <div class="mt">
              {heFirst ? <div class="big-en">{card.en}</div> : <HeText text={card.he} size="lg" />}
              {card.tr && <div class="tr">{card.tr}</div>}
              {card.sub && <div class="small muted mt">{card.sub}</div>}
              {card.forms && (
                <table class="grid mt">
                  <tbody>
                    {card.forms.map(([label, form]) => (
                      <tr>
                        <td class="he muted small">{label}</td>
                        <td class="he" style={{ fontSize: 20 }} onClick={() => speak(form)}>
                          {form}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {card.ex && (
                <div class="mt">
                  <HeText text={card.ex.he} />
                  <div class="en">{card.ex.en}</div>
                </div>
              )}
              <div class="btn-row">
                <SpeakBtn text={card.speak} small />
                {card.verb && (
                  <button class="btn small ghost" onClick={() => go(`verb/${card.verb!.id}`)}>
                    Full table
                  </button>
                )}
              </div>
              <div class="rate-row mt">
                {RATINGS.map(([g, label, cls]) => (
                  <button class={`btn rate ${cls}`} onClick={() => rate(g)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div class="btn-row">
              {heFirst && <SpeakBtn text={card.speak} small />}
              <button class="btn primary block" onClick={() => setShown(true)}>
                Show answer
              </button>
            </div>
          )}
        </div>
        <p class="small muted center">Say the answer to yourself first, then check. Keyboard: space shows, 1–4 rates.</p>
      </main>
    </>
  );
}

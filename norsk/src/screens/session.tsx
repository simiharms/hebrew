// Word and phrase practice with spaced repetition: new words are shown first,
// then asked; due cards are asked. Flip-and-rate or type-the-answer.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { AnswerInput, Feedback } from '../components/answer.tsx';
import { NoText } from '../components/text.tsx';
import { Progress, SpeakBtn, TopBar } from '../components/ui.tsx';
import type { Word } from '../content/types.ts';
import { acceptedNo, ARTICLE, display, GENDER_DE, lessonByN } from '../lib/content.ts';
import { intervalDays, type Rating, review } from '../lib/fsrs.ts';
import { type CheckResult, checkAnswer, checkGerman, normalize } from '../lib/norsk.ts';
import { back, go } from '../lib/router.ts';
import { type CardRef, dueCards, isStarred, newLeftToday, newWordQueue, rateCard, resolveCard, toggleStar } from '../lib/srs.ts';
import { addMistake, clearMistake, getState, markDone, setState, useAppState } from '../lib/store.ts';
import { speak, stopSpeaking } from '../lib/tts.ts';

export type SessionMode = { type: 'daily' } | { type: 'lesson'; n: number } | { type: 'wk'; n: number } | { type: 'starred' };

interface QItem {
  id: string;
  isNew: boolean;
  again?: boolean;
}

const shuffle = <T,>(xs: T[]): T[] => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

function buildQueue(mode: SessionMode): QItem[] {
  const s = getState();
  const now = Date.now();
  if (mode.type === 'daily') {
    const due = dueCards(s, now).slice(0, 60);
    const fresh = newWordQueue(s).slice(0, newLeftToday(s));
    return [...shuffle(due).map((id) => ({ id, isNew: false })), ...fresh.map((w) => ({ id: `w:${w.id}`, isNew: true }))];
  }
  if (mode.type === 'lesson') {
    const due = dueCards(s, now).filter((id) => resolveCard(id)?.kind === 'word' && (resolveCard(id) as { word: Word }).word.lesson === mode.n);
    const fresh = newWordQueue(s, mode.n).slice(0, 12);
    return [...shuffle(due).map((id) => ({ id, isNew: false })), ...fresh.map((w) => ({ id: `w:${w.id}`, isNew: true }))];
  }
  if (mode.type === 'wk') {
    const L = lessonByN.get(mode.n);
    if (!L) return [];
    const ids = L.wk.phrases.map((_, i) => `p:${mode.n}:${i}`);
    const fresh = ids.filter((id) => !s.cards[id]);
    const due = ids.filter((id) => s.cards[id] && s.cards[id].due <= now);
    const list = [...shuffle(due).map((id) => ({ id, isNew: false })), ...fresh.map((id) => ({ id, isNew: true }))];
    return list.length ? list : shuffle(ids).map((id) => ({ id, isNew: false }));
  }
  return shuffle(s.starred.filter((id) => resolveCard(id))).map((id) => ({ id, isNew: false }));
}

const TITLE: Record<SessionMode['type'], string> = { daily: 'Wörter üben', lesson: 'Neue Wörter', wk: 'Wörterkiste', starred: 'Markierte Wörter' };

export function WordSession({ mode }: { mode: SessionMode }) {
  const s = useAppState();
  const [queue, setQueue] = useState<QItem[]>(() => buildQueue(mode));
  const [pos, setPos] = useState(0);
  const [stats, setStats] = useState({ done: 0, right: 0 });
  useEffect(() => () => stopSpeaking(), []);
  const total = queue.length;
  const exitTo = mode.type === 'lesson' ? `lektion/${mode.n}` : mode.type === 'wk' ? `lektion/${mode.n}/woerterkiste` : 'heute';
  const finished = pos >= total;
  useEffect(() => {
    if (finished && total && mode.type === 'wk') markDone(`L${mode.n}:wk`, 1);
    if (finished && total && mode.type === 'lesson' && newWordQueue(getState(), mode.n).length === 0) markDone(`L${mode.n}:vocab`, 1);
  }, [finished]);

  if (finished) {
    const more = buildQueue(mode).length > 0;
    return (
      <>
        <TopBar title={TITLE[mode.type]} backTo={exitTo} />
        <main class="page">
          <div class="card center">
            {total === 0 ? (
              <>
                <div class="hero">🌿</div>
                <h2>Nichts zu tun</h2>
                <p class="muted">{mode.type === 'starred' ? 'Du hast noch keine Wörter markiert (☆).' : 'Für jetzt ist alles gelernt und wiederholt.'}</p>
              </>
            ) : (
              <>
                <div class="hero">🎉</div>
                <h2>Bra jobba!</h2>
                <p>
                  {stats.done} Karten geübt, {stats.right} auf Anhieb gewusst.
                </p>
              </>
            )}
            <div class="btn-row">
              <button class="btn" onClick={() => go(exitTo)}>
                Zurück
              </button>
              {more && total > 0 && (
                <button
                  class="btn primary"
                  onClick={() => {
                    setQueue(buildQueue(mode));
                    setPos(0);
                  }}
                >
                  Weiter üben
                </button>
              )}
            </div>
            {mode.type === 'daily' && newLeftToday(s) === 0 && (
              <p class="small muted mt">Das Tageslimit für neue Wörter ist erreicht. Mehr gibt es unter Lektionen → Neue Wörter lernen oder in den Einstellungen.</p>
            )}
          </div>
        </main>
      </>
    );
  }

  const item = queue[pos];
  const card = resolveCard(item.id);
  const next = (g: Rating | null) => {
    if (g !== null) {
      rateCard(item.id, g, item.isNew && !item.again);
      setStats((x) => ({ done: x.done + 1, right: x.right + (g >= 3 && !item.again ? 1 : 0) }));
      if (g === 1 && !item.again) setQueue((q) => [...q, { id: item.id, isNew: false, again: true }]);
    }
    setPos((p) => p + 1);
  };

  return (
    <>
      <TopBar
        title={TITLE[mode.type]}
        backTo={true}
        right={
          <span class="small muted">
            {pos + 1}/{total}
          </span>
        }
      />
      <main class="page">
        <Progress value={pos / total} />
        {card ? <CardView key={`${item.id}#${pos}`} card={card} item={item} onNext={next} /> : <button class="btn" onClick={() => next(null)}>Weiter</button>}
        <button class="btn ghost block mt" onClick={() => back(exitTo)}>
          Pause – später weitermachen
        </button>
      </main>
    </>
  );
}

const RATE_LABEL: Record<Rating, string> = { 1: 'Nochmal', 2: 'Schwer', 3: 'Gut', 4: 'Leicht' };

function intervalLabel(id: string, g: Rating): string {
  const s = getState();
  if (g === 1) return '< 10 Min.';
  const c = review(s.cards[id], g, Date.now(), s.settings.retention);
  const days = Math.max(1, Math.round(intervalDays(c.s, s.settings.retention)));
  return days === 1 ? '1 Tag' : days < 31 ? `${days} Tage` : days < 365 ? `${Math.round(days / 30)} Mon.` : `${Math.round(days / 365)} J.`;
}

function CardView({ card, item, onNext }: { card: CardRef; item: QItem; onNext: (g: Rating | null) => void }) {
  const s = getState();
  const [phase, setPhase] = useState<'intro' | 'ask' | 'answer'>(item.isNew && !item.again ? 'intro' : 'ask');
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const typed = s.settings.reviewMode === 'type' && card.kind === 'word';
  // Which side is asked: German → Norwegian or Norwegian → German.
  const dir = useMemo(() => {
    if (card.kind === 'phrase') return 'de2no';
    const pref = s.settings.direction;
    if (pref !== 'mixed') return pref;
    if (item.isNew) return 'no2de';
    return (s.cards[card.id]?.reps ?? 0) % 2 === 0 ? 'no2de' : 'de2no';
  }, []);
  const no = card.kind === 'word' ? display(card.word) : card.phrase.no;
  const de = card.kind === 'word' ? card.word.de : card.phrase.de;

  useEffect(() => {
    if (phase === 'intro' || (phase === 'ask' && dir === 'no2de')) speak(no);
    if (phase === 'answer' && dir === 'de2no') speak(no);
  }, [phase]);

  const check = () => {
    if (!value.trim() || result || card.kind !== 'word') return;
    const w = card.word;
    let r: CheckResult;
    if (dir === 'de2no') {
      r = checkAnswer(value, acceptedNo(w, s.extraAnswers[`${card.id}|${dir}`] ?? []));
      // A wrong article with the right word: almost right.
      if (r.verdict === 'wrong' && w.pos === 'noun') {
        const [art, ...rest] = normalize(value).split(' ');
        if (['en', 'ei', 'et'].includes(art) && checkAnswer(rest.join(' '), acceptedNo(w)).verdict !== 'wrong') {
          r = { verdict: 'close', expected: display(w), note: `Das Wort stimmt – aber es heißt »${ARTICLE[w.gender ?? 'm']} ${w.no}«.` };
        }
      }
    } else r = checkGerman(value, [w.de, ...(w.deAlt ?? []), ...(s.extraAnswers[`${card.id}|${dir}`] ?? [])]);
    setResult(r);
    // Right but for æ ø å counts as right; a real typo or a wrong article as »Schwer«.
    const g: Rating = r.verdict === 'correct' || r.keyboard ? 3 : r.verdict === 'close' ? 2 : 1;
    setRating(g);
    setPhase('answer');
    if (g === 1) addMistake({ kind: 'word', ref: card.id, prompt: dir === 'de2no' ? w.de : display(w), answer: dir === 'de2no' ? display(w) : w.de, given: value });
    else clearMistake('word', card.id);
  };

  const override = () => {
    setState((st) => {
      const key = `${card.id}|${dir}`;
      st.extraAnswers[key] = [...(st.extraAnswers[key] ?? []), value.trim()];
    });
    clearMistake('word', card.id);
    setRating(3);
    setResult(result && { ...result, verdict: 'correct', note: 'Gilt ab jetzt als richtig.' });
  };

  // Keyboard on a Mac: space flips, 1–4 rate, Enter continues.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (phase === 'intro' && (e.key === 'Enter' || e.key === ' ')) (e.preventDefault(), setPhase('ask'));
      else if (phase === 'ask' && !typed && (e.key === ' ' || e.key === 'Enter')) (e.preventDefault(), setPhase('answer'));
      else if (phase === 'answer' && !typed && ['1', '2', '3', '4'].includes(e.key)) onNext(Number(e.key) as Rating);
      else if (phase === 'answer' && typed && e.key === 'Enter') onNext(rating);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, rating]);

  if (phase === 'intro') {
    return (
      <div class="card flash">
        <div class="badge good">Neu</div>
        <Details card={card} />
        <button class="btn primary block mt" onClick={() => setPhase('ask')}>
          Weiter – abfragen
        </button>
      </div>
    );
  }

  return (
    <div class="card flash">
      <div class="prompt-box">
        {dir === 'no2de' ? (
          <>
            <div class="no no-xl">{no}</div>
            <SpeakBtn text={no} small />
            <div class="hint">Was heißt das auf Deutsch?</div>
          </>
        ) : (
          <>
            <div class="big-de">{de}</div>
            <div class="hint">{card.kind === 'word' ? posHint(card.word) : 'Wie sagt man das auf Norwegisch?'}</div>
          </>
        )}
      </div>
      {phase === 'ask' && typed && (
        <>
          <AnswerInput value={value} onInput={setValue} onEnter={check} autoFocus german={dir === 'no2de'} />
          <div class="btn-row">
            <button class="btn primary" onClick={check} disabled={!value.trim()}>
              Prüfen
            </button>
            <button class="btn ghost" onClick={() => (setRating(1), setResult({ verdict: 'wrong', expected: dir === 'de2no' ? no : de }), setPhase('answer'))}>
              Weiß ich nicht
            </button>
          </div>
        </>
      )}
      {phase === 'ask' && !typed && (
        <button class="btn primary block" onClick={() => setPhase('answer')}>
          Umdrehen
        </button>
      )}
      {phase === 'answer' && (
        <>
          {typed && result && <Feedback result={result} onOverride={value.trim() ? override : undefined} />}
          <hr class="sep" />
          <Details card={card} />
          {typed ? (
            <button class="btn primary block mt" onClick={() => onNext(rating)}>
              Weiter
            </button>
          ) : (
            <>
              <div class="small muted mt center">Wie gut wusstest du es?</div>
              <div class="rate-row mt">
                {([1, 2, 3, 4] as Rating[]).map((g) => (
                  <button class={`btn rate ${g === 1 ? 'bad' : g === 2 ? 'close' : 'ok'}`} onClick={() => onNext(g)}>
                    <span>{RATE_LABEL[g]}</span>
                    <span class="small">{intervalLabel(card.id, g)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function posHint(w: Word): string {
  switch (w.pos) {
    case 'noun':
      return w.plOnly ? 'Substantiv (nur Plural)' : 'Substantiv – mit en, ei oder et';
    case 'verb':
      return 'Verb';
    case 'adj':
      return 'Adjektiv';
    case 'phrase':
      return 'Wendung';
    default:
      return 'Wie heißt das auf Norwegisch?';
  }
}

/** Everything about a word or phrase: forms, example, tip. */
function Details({ card }: { card: CardRef }) {
  useAppState();
  if (card.kind === 'phrase') {
    return (
      <div class="details">
        <div class="row wrap">
          <NoText text={card.phrase.no} size="lg" />
          <SpeakBtn text={card.phrase.no} small />
        </div>
        <div class="big-de">{card.phrase.de}</div>
        {card.phrase.note && <div class="small muted mt">💡 {card.phrase.note}</div>}
      </div>
    );
  }
  const w = card.word;
  const id = card.id;
  return (
    <div class="details">
      <div class="row wrap">
        <div class="no no-xl">{display(w)}</div>
        <SpeakBtn text={display(w)} small />
        <div class="spacer" />
        <button class="icon-btn" aria-label="Markieren" onClick={() => toggleStar(id)}>
          {isStarred(id) ? '★' : '☆'}
        </button>
      </div>
      <div class="big-de">{w.de}</div>
      {w.deAlt && w.deAlt.length > 0 && <div class="small muted">auch: {w.deAlt.join(', ')}</div>}
      <div class="small muted mt">
        {w.gender && <span class="badge">{w.plOnly ? 'nur Plural' : GENDER_DE[w.gender]}</span>} <span class="badge">Lektion {w.lesson}</span>
      </div>
      {w.forms && w.pos === 'noun' && <FormTable labels={['unbestimmt', 'bestimmt', 'Plural', 'Plural bestimmt']} forms={w.forms} />}
      {w.forms && w.pos === 'adj' && <FormTable labels={['en/ei', 'et', 'Plural/best.', 'Komparativ', 'Superlativ']} forms={w.forms} />}
      {w.vf && <FormTable labels={['Präsens', 'Präteritum', 'Perfekt', 'Imperativ']} forms={w.vf.map((f, i) => (i === 2 && f ? `har ${f}` : f))} />}
      {w.ex && (
        <div class="example mt">
          <div class="row">
            <NoText text={w.ex.no} />
            <SpeakBtn text={w.ex.no} small />
          </div>
          <div class="de">{w.ex.de}</div>
        </div>
      )}
      {w.note && <div class="small mt">💡 {w.note}</div>}
    </div>
  );
}

function FormTable({ labels, forms }: { labels: string[]; forms: string[] }) {
  return (
    <div class="forms mt">
      {forms.map((f, i) =>
        f ? (
          <div class="form">
            <span class="small muted">{labels[i]}</span>
            <button class="linklike no" onClick={() => speak(f.split('/')[0])}>
              {f.replace(/\//g, ' / ')}
            </button>
          </div>
        ) : null,
      )}
    </div>
  );
}

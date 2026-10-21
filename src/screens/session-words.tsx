import { useEffect, useMemo, useState } from 'preact/hooks';
import type { VocabItem } from '../content/types.ts';
import { AnswerInput, Feedback } from '../components/answer.tsx';
import { HeText } from '../components/hebrew.tsx';
import { Progress, SpeakBtn, TopBar } from '../components/ui.tsx';
import { allVocab, displayRoot, rootFamily } from '../lib/content.ts';
import { type Rating, review } from '../lib/fsrs.ts';
import { type CheckResult, checkEnglish, checkHebrew, normalizeEn } from '../lib/hebrew.ts';
import { go } from '../lib/router.ts';
import { acceptedHebrew, buildWordSession, findCloze, type WordTask } from '../lib/session.ts';
import { getState, markTask, setState, todayLog } from '../lib/store.ts';
import { speak } from '../lib/tts.ts';

const POS_LABEL: Record<string, string> = {
  noun: 'noun',
  verb: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  prep: 'preposition',
  conj: 'connector',
  phrase: 'phrase',
  num: 'number',
  pron: 'pronoun',
  expr: 'expression',
};

function rateCard(cardId: string, g: Rating) {
  setState((s) => {
    const prev = s.cards[cardId];
    s.cards[cardId] = review(prev, g, Date.now(), s.settings.retention);
    const log = todayLog(s);
    if (!prev) log.newWords++;
    s.queue = s.queue.filter((id) => `v:${id}` !== cardId);
    log.reviews++;
    if (g >= 3) log.correct++;
  });
}

export function WordSession() {
  const initial = useMemo(() => buildWordSession(), []);
  const [queue, setQueue] = useState<WordTask[]>(initial);
  const [idx, setIdx] = useState(0);
  const [stats, setStats] = useState({ right: 0, total: 0 });
  const rated = useMemo(() => new Set<string>(), []);

  if (!initial.length) {
    return (
      <>
        <TopBar title="Words" backTo="words" />
        <main class="page">
          <div class="card center">
            <h2>All caught up 🎉</h2>
            <p class="muted">No reviews due and today's new words are done. Come back tomorrow — or raise "new words per day" in settings.</p>
            <button class="btn primary" onClick={() => go('today')}>
              Back to Today
            </button>
          </div>
        </main>
      </>
    );
  }

  if (idx >= queue.length) return <SessionDone task="words" right={stats.right} total={stats.total} />;

  const task = queue[idx];

  const next = (result: 'right' | 'wrong' | 'skip', g?: Rating) => {
    const first = !rated.has(task.cardId) && task.mode !== 'intro';
    if (first && g) {
      rated.add(task.cardId);
      rateCard(task.cardId, g);
      setStats((s) => ({ right: s.right + (g >= 3 ? 1 : 0), total: s.total + 1 }));
    }
    const q = [...queue];
    if (task.mode === 'intro' && result !== 'skip') {
      // test it a few items later
      q.splice(Math.min(idx + 3, q.length), 0, { ...task, mode: 'en2he' });
    } else if (result === 'wrong') {
      q.splice(Math.min(idx + 4, q.length), 0, { ...task, mode: 'en2he', retry: true });
    }
    setQueue(q);
    setIdx(idx + 1);
  };

  return (
    <>
      <TopBar title="Words" backTo="today" right={<span class="small muted">{idx + 1}/{queue.length}</span>} />
      <main class="page">
        <Progress value={idx / queue.length} />
        {task.mode === 'intro' ? (
          <Intro key={`${idx}-intro`} task={task} onNext={() => next('right')} onKnown={() => (rated.add(task.cardId), rateCard(task.cardId, 4), next('skip'))} />
        ) : (
          <Exercise key={`${idx}-${task.mode}`} task={task} onNext={next} />
        )}
      </main>
    </>
  );
}

export function SessionDone({ task, right, total }: { task: string; right: number; total: number }) {
  useEffect(() => markTask(task), []);
  return (
    <>
      <TopBar title="Session done" backTo="today" />
      <main class="page">
        <div class="card center">
          <h2 class="he">כל הכבוד! 👏</h2>
          <p>
            {right} / {total} correct on the first try.
          </p>
          <div class="btn-row">
            <button class="btn primary" onClick={() => go('today')}>
              Back to Today
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

/** Other words whose English gloss is the same (so an English prompt is ambiguous). */
function sameMeaning(item: VocabItem): VocabItem[] {
  const key = normalizeEn(item.en);
  return allVocab().filter(
    (o) => o.id !== item.id && (normalizeEn(o.en) === key || (o.enAlt ?? []).some((a) => normalizeEn(a) === key)),
  );
}

function WordMeta({ item }: { item: WordTask['item'] }) {
  return (
    <span class="small muted">
      {POS_LABEL[item.pos] ?? item.pos}
      {item.gender ? ` · ${item.gender === 'm' ? 'masc.' : 'fem.'}` : ''}
      {item.gov ? ` · + ${item.gov}` : ''}
      {item.register && item.register !== 'neutral' ? ` · ${item.register}` : ''}
    </span>
  );
}

function Intro({ task, onNext, onKnown }: { task: WordTask; onNext: () => void; onKnown: () => void }) {
  const { item } = task;
  const fam = rootFamily(item.root);
  const relatives = [...fam.vocab.filter((v) => v.id !== item.id).map((v) => ({ he: v.he, en: v.en })), ...fam.verbs.filter((v) => v.inf !== item.he).map((v) => ({ he: v.inf, en: v.en }))].slice(0, 5);
  const showTr = getState().settings.showTr;
  useEffect(() => {
    speak(item.he);
  }, []);
  return (
    <div class="card">
      <div class="row">
        <span class="badge accent">New word</span>
        <span class="badge level">{item.level}</span>
        <div class="spacer" />
        <SpeakBtn text={item.he} />
      </div>
      <div class="center mt">
        <div class="he he-xl">{item.he}</div>
        {showTr && item.tr && <div class="tr">{item.tr}</div>}
        <div class="big-en" style={{ fontSize: 22, fontWeight: 650, marginTop: 6 }}>
          {item.en}
        </div>
        <WordMeta item={item} />
        {item.plural && (
          <div class="small mt">
            plural: <span class="he">{item.plural}</span>
          </div>
        )}
      </div>
      <hr class="sep" />
      <div class="row">
        <HeText text={item.ex.he} />
        <SpeakBtn text={item.ex.he} small />
      </div>
      <div class="en">{item.ex.en}</div>
      {item.note && <div class="card tight accent small">💡 {item.note}</div>}
      {item.root && relatives.length > 0 && (
        <div class="mt">
          <div class="small muted">
            Root <span class="he">{displayRoot(item.root)}</span> — same family:
          </div>
          <div class="chip-row mt">
            {relatives.map((r) => (
              <span class="chip">
                <span class="he">{r.he}</span> · {r.en}
              </span>
            ))}
          </div>
        </div>
      )}
      <div class="btn-row">
        <button class="btn ghost" onClick={onKnown}>
          I already know it
        </button>
        <button class="btn primary" onClick={onNext}>
          Got it →
        </button>
      </div>
    </div>
  );
}

function Exercise({ task, onNext }: { task: WordTask; onNext: (r: 'right' | 'wrong', g?: Rating) => void }) {
  const { item, mode } = task;
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const cloze = mode === 'cloze' ? findCloze(item) : null;
  const synonyms = useMemo(() => sameMeaning(item), [item]);
  const effectiveMode = mode === 'cloze' && !cloze ? 'en2he' : mode;
  const showTr = getState().settings.showTr;

  useEffect(() => {
    if (effectiveMode === 'listen' || effectiveMode === 'he2en') speak(item.he);
  }, []);

  const check = () => {
    if (!value.trim()) return;
    let r: CheckResult;
    if (effectiveMode === 'he2en') r = checkEnglish(value, [item.en, ...(item.enAlt ?? [])]);
    else if (effectiveMode === 'cloze' && cloze) r = checkHebrew(value, [cloze.answer, ...acceptedHebrew(item, task.cardId)]);
    else r = checkHebrew(value, acceptedHebrew(item, task.cardId));
    if (r.verdict === 'wrong' && effectiveMode !== 'he2en') {
      // A synonym with the same English meaning is not a mistake.
      const syn = synonyms.find((o) => checkHebrew(value, [o.he, ...(o.alt ?? [])]).verdict === 'correct');
      if (syn) r = { verdict: 'close', expected: item.he, note: `“${syn.he}” also means “${item.en}” — the word practised here is ${item.he}.` };
    }
    if (r.verdict === 'latin') {
      setResult(r);
      return;
    }
    setResult(r);
    if (r.verdict === 'correct') speak(effectiveMode === 'cloze' ? item.ex.he : item.he);
  };

  const proceed = () => {
    if (!result) return;
    const g: Rating = result.verdict === 'correct' ? 3 : result.verdict === 'close' ? 2 : 1;
    onNext(g === 1 ? 'wrong' : 'right', g);
  };

  const override = () => {
    if (effectiveMode !== 'he2en') {
      setState((s) => {
        const list = s.extraAnswers[task.cardId] ?? [];
        if (!list.includes(value.trim())) list.push(value.trim());
        s.extraAnswers[task.cardId] = list;
      });
    }
    onNext('right', 3);
  };

  const done = result && result.verdict !== 'latin';

  return (
    <div class="card">
      <div class="row">
        <span class="badge">
          {effectiveMode === 'en2he' && 'English → Hebrew'}
          {effectiveMode === 'he2en' && 'What does it mean?'}
          {effectiveMode === 'listen' && 'Type what you hear'}
          {effectiveMode === 'cloze' && 'Fill the gap'}
        </span>
        {task.retry && <span class="badge warn">again</span>}
      </div>

      <div class="prompt-box">
        {effectiveMode === 'en2he' && (
          <>
            <div class="big-en">{item.en}</div>
            <WordMeta item={item} />
            {synonyms.length > 0 && (
              <div class="hint">
                starts with <span class="he">{item.he[0]}</span>
              </div>
            )}
          </>
        )}
        {effectiveMode === 'he2en' && (
          <>
            <div class="he he-xl center" style={{ textAlign: 'center' }}>{item.he}</div>
            <SpeakBtn text={item.he} small />
          </>
        )}
        {effectiveMode === 'listen' && (
          <>
            <button class="btn primary" onClick={() => speak(item.he)}>
              🔊 Play again
            </button>
            <button class="btn ghost" onClick={() => speak(item.he, { rate: 0.6 })}>
              🐢 Slow
            </button>
            {done && <div class="mt">{item.en}</div>}
          </>
        )}
        {effectiveMode === 'cloze' && cloze && (
          <>
            <div class="he he-lg" dir="rtl">
              {cloze.before}
              {cloze.prefix}
              <span style={{ borderBottom: '2px solid var(--primary)', padding: '0 24px' }}>{done ? cloze.answer : ' '}</span>
              {cloze.after}
            </div>
            <div class="en mt">{item.ex.en}</div>
            <div class="hint">missing word: “{item.en}”</div>
          </>
        )}
      </div>

      <AnswerInput
        value={value}
        onInput={setValue}
        onEnter={done ? proceed : check}
        ltr={effectiveMode === 'he2en'}
        autoFocus
        status={!result ? '' : result.verdict === 'correct' ? 'ok' : result.verdict === 'close' ? 'close' : result.verdict === 'latin' ? '' : 'bad'}
      />

      {result && (
        <Feedback
          result={effectiveMode === 'he2en' && result.verdict !== 'correct' ? { ...result, expected: item.en } : result}
          onOverride={override}
          extra={
            done && (
              <div class="mt" style={{ color: 'var(--text)' }}>
                <span class="he he-md">{item.he}</span>
                {showTr && item.tr && <span class="tr"> · {item.tr}</span>}
                <span> · {item.en}</span>
              </div>
            )
          }
        />
      )}

      <div class="btn-row">
        {!done ? (
          <>
            <button class="btn ghost" onClick={() => setResult({ verdict: 'wrong', expected: effectiveMode === 'he2en' ? item.en : item.he })}>
              I don't know
            </button>
            <button class="btn primary" onClick={check} disabled={!value.trim()}>
              Check
            </button>
          </>
        ) : (
          <button class="btn primary block" onClick={proceed}>
            Continue →
          </button>
        )}
      </div>
    </div>
  );
}

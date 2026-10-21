import { useMemo, useState } from 'preact/hooks';
import { HeText } from '../components/hebrew.tsx';
import { Item, TopBar, toast } from '../components/ui.tsx';
import { lookup } from '../lib/content.ts';
import { checkHebrew, hasHebrew, splitWords } from '../lib/hebrew.ts';
import { go } from '../lib/router.ts';
import { setState, useAppState } from '../lib/store.ts';
import { speakSequence, stopSpeaking } from '../lib/tts.ts';

export function OwnList() {
  const s = useAppState();
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const save = () => {
    if (!hasHebrew(text)) {
      toast('Paste some Hebrew text first');
      return;
    }
    const id = `t_${Date.now().toString(36)}`;
    setState((st) => {
      st.own.unshift({ id, title: title.trim() || text.trim().slice(0, 40), text: text.trim(), at: Date.now() });
    });
    setText('');
    setTitle('');
    go(`own/${id}`);
  };
  return (
    <>
      <TopBar title="Your own text" backTo="read" />
      <main class="page">
        <div class="card primary small">
          Paste real Hebrew — a Ynet paragraph, a WhatsApp message from your landlord, subtitles from a Kan 11 episode, song
          lyrics. You get tap-to-translate, read-aloud and an automatic fill-the-gap exercise.
        </div>
        <div class="card">
          <input class="answer ltr" placeholder="Title (optional)" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
          <textarea
            class="answer he mt"
            dir="rtl"
            lang="he"
            placeholder="הדביקו כאן טקסט בעברית…"
            value={text}
            onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          />
          <div class="btn-row">
            <button class="btn primary" onClick={save} disabled={!text.trim()}>
              Save & open
            </button>
          </div>
        </div>
        {s.own.length > 0 && <div class="section-title">Saved texts</div>}
        <div class="list">
          {s.own.map((t) => (
            <Item title={<span class="he">{t.title}</span>} sub={new Date(t.at).toLocaleDateString()} onClick={() => go(`own/${t.id}`)} />
          ))}
        </div>
      </main>
    </>
  );
}

export function OwnText({ id }: { id: string }) {
  const s = useAppState();
  const t = s.own.find((x) => x.id === id);
  const [playing, setPlaying] = useState(false);
  const [cloze, setCloze] = useState(false);
  if (!t) return <TopBar title="Not found" backTo="own" />;
  const paragraphs = t.text.split(/\n+/).filter((p) => p.trim());

  const readAll = async () => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    await speakSequence(paragraphs.map((p) => ({ text: p })), { gap: 500 });
    setPlaying(false);
  };

  return (
    <>
      <TopBar title={t.title} backTo="own" />
      <main class="page">
        <div class="btn-row">
          <button class="btn" onClick={readAll}>
            {playing ? '■ Stop' : '🔊 Read aloud'}
          </button>
          <button class="btn" onClick={() => setCloze(!cloze)}>
            {cloze ? 'Show text' : '🧩 Fill-the-gap'}
          </button>
        </div>
        {cloze ? (
          <ClozeExercise text={t.text} />
        ) : (
          <div class="card">
            {paragraphs.map((p) => (
              <div class="para mb">
                <HeText text={p} />
              </div>
            ))}
          </div>
        )}
        <button
          class="btn ghost block mt"
          onClick={() => {
            if (confirm('Delete this text?')) {
              setState((st) => {
                st.own = st.own.filter((x) => x.id !== id);
              });
              go('own');
            }
          }}
        >
          Delete text
        </button>
      </main>
    </>
  );
}

function ClozeExercise({ text }: { text: string }) {
  // Blank up to 10 words that the dictionary knows (so the learner can get a hint).
  const parts = useMemo(() => splitWords(text), [text]);
  const blanks = useMemo(() => {
    const candidates = parts
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.isWord && p.w.length >= 3 && lookup(p.w).entries.length > 0);
    const step = Math.max(1, Math.floor(candidates.length / 10));
    return new Set(candidates.filter((_, k) => k % step === 0).slice(0, 10).map((c) => c.i));
  }, [parts]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  const correct = [...blanks].filter((i) => checkHebrew(answers[i] ?? '', [parts[i].w]).verdict !== 'wrong' && (answers[i] ?? '').trim()).length;
  return (
    <div class="card">
      <p class="small muted">Fill in the missing words. Hint under each gap = meaning.</p>
      <div class="he he-md" dir="rtl" style={{ lineHeight: 2.4 }}>
        {parts.map((p, i) => {
          if (!blanks.has(i)) return p.w;
          const hint = lookup(p.w).entries[0]?.en ?? '';
          const ok = checked && checkHebrew(answers[i] ?? '', [p.w]).verdict !== 'wrong' && (answers[i] ?? '').trim();
          return (
            <span style={{ display: 'inline-block', verticalAlign: 'top', margin: '0 2px' }}>
              <input
                class={`answer he ${checked ? (ok ? 'ok' : 'bad') : ''}`}
                dir="rtl"
                style={{ width: `${Math.max(4, p.w.length + 1)}em`, fontSize: 18, padding: '4px 6px', display: 'inline-block' }}
                value={answers[i] ?? ''}
                autocomplete="off"
                autocorrect="off"
                spellcheck={false}
                onInput={(e) => setAnswers({ ...answers, [i]: (e.target as HTMLInputElement).value })}
              />
              <div class="small muted" style={{ lineHeight: 1.2, textAlign: 'center', fontFamily: 'var(--ui-font)' }}>
                {checked && !ok ? <span class="he diff-ok">{p.w}</span> : hint}
              </div>
            </span>
          );
        })}
      </div>
      <div class="btn-row">
        <button class="btn primary" onClick={() => setChecked(true)}>
          Check
        </button>
        {checked && (
          <span class="badge good" style={{ alignSelf: 'center' }}>
            {correct}/{blanks.size}
          </span>
        )}
      </div>
    </div>
  );
}


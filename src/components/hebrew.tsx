import { useEffect, useState } from 'preact/hooks';
import { displayRoot, findVocab, invalidateDictionary, lookup, rootFamily } from '../lib/content.ts';
import type { VocabItem } from '../content/types.ts';
import { lenient, splitWords, stripNiqqud } from '../lib/hebrew.ts';
import { go } from '../lib/router.ts';
import { getState, setState, useAppState } from '../lib/store.ts';
import { speak } from '../lib/tts.ts';
import { toast } from './ui.tsx';

// ---- global "gloss sheet" state ----
let openGloss: ((w: string | null) => void) | null = null;

export function showGloss(word: string) {
  openGloss?.(word);
}

/** Hebrew text where every word can be tapped for a translation. */
export function HeText({ text, size = 'md', tap = true }: { text: string; size?: 'md' | 'lg' | 'xl'; tap?: boolean }) {
  if (!tap) return <div class={`he he-${size}`} dir="rtl" lang="he">{text}</div>;
  return (
    <div class={`he he-${size}`} dir="rtl" lang="he">
      {splitWords(text).map((p) =>
        p.isWord ? (
          <span class="w" onClick={() => showGloss(p.w)}>
            {p.w}
          </span>
        ) : (
          p.w
        ),
      )}
    </div>
  );
}

export function queueWord(vocabId: string) {
  const s = getState();
  if (s.cards[`v:${vocabId}`]) {
    toast('Already in your reviews');
    return;
  }
  if (s.queue.includes(vocabId)) {
    toast('Already queued');
    return;
  }
  setState((st) => {
    st.queue.push(vocabId);
  });
  toast('Added — it will come up in your next word session');
}

/** Queue glossary words for learning: known vocab is queued, unknown entries become "My words". */
export function learnGlossary(entries: { he: string; en: string; tr?: string }[]): number {
  let added = 0;
  const s = getState();
  const newCustom: VocabItem[] = [];
  const queue: string[] = [];
  for (const g of entries) {
    const hit = lookup(g.he).entries.find((e) => e.vocabId && lenient(e.he) === lenient(g.he));
    if (hit?.vocabId) {
      if (!s.cards[`v:${hit.vocabId}`] && !s.queue.includes(hit.vocabId)) {
        queue.push(hit.vocabId);
        added++;
      }
      continue;
    }
    if (s.custom.some((c) => lenient(c.he) === lenient(g.he))) continue;
    const id = `u_${Date.now().toString(36)}_${newCustom.length}`;
    newCustom.push({ id, he: g.he, tr: g.tr ?? '', en: g.en, pos: 'phrase', level: 'B1', topic: 'custom', ex: { he: g.he, en: g.en } });
    queue.push(id);
    added++;
  }
  if (added) {
    setState((st) => {
      st.custom.push(...newCustom);
      st.queue.push(...queue);
    });
    invalidateDictionary();
  }
  toast(added ? `${added} added — they'll come up in your next word session` : 'Already in your words');
  return added;
}

export function GlossSheet() {
  const [word, setWord] = useState<string | null>(null);
  const [meaning, setMeaning] = useState('');
  useAppState();
  useEffect(() => {
    openGloss = (w) => {
      setWord(w);
      setMeaning('');
    };
    return () => {
      openGloss = null;
    };
  }, []);
  if (!word) return null;
  const clean = stripNiqqud(word);
  const res = lookup(clean);
  const close = () => setWord(null);
  const enc = encodeURIComponent(clean);

  const addCustom = () => {
    if (!meaning.trim()) return;
    const id = `u_${Date.now().toString(36)}`;
    setState((s) => {
      s.custom.push({
        id,
        he: clean,
        tr: '',
        en: meaning.trim(),
        pos: 'phrase',
        level: 'B1',
        topic: 'custom',
        ex: { he: clean, en: meaning.trim() },
      });
      s.queue.push(id);
    });
    invalidateDictionary();
    toast('Saved to My words');
    close();
  };

  return (
    <>
      <div class="sheet-backdrop" onClick={close} />
      <div class="sheet" role="dialog">
        <div class="grabber" />
        <div class="row">
          <div class="he he-xl">{clean}</div>
          <div class="spacer" />
          <button class="btn small" onClick={() => speak(clean)}>
            🔊
          </button>
          <button class="icon-btn" aria-label="Close" onClick={close}>
            ✕
          </button>
        </div>
        {res.prefix && (
          <div class="small muted mt">
            Prefix: <span class="he">{res.prefix}</span> ({res.prefixMeaning})
          </div>
        )}
        {res.entries.length > 0 ? (
          res.entries.slice(0, 3).map((e) => {
            const vocab = e.vocabId ? findVocab(e.vocabId) : undefined;
            const fam = e.root ? rootFamily(e.root) : null;
            const famCount = fam ? fam.vocab.length + fam.verbs.length : 0;
            return (
              <div class="card tight">
                <div class="row wrap">
                  <span class="he he-lg">{e.he}</span>
                  {e.tr && <span class="tr">{e.tr}</span>}
                </div>
                <div>
                  <strong>{e.en}</strong>
                  {e.form && <span class="badge" style={{ marginInlineStart: 8 }}>{e.form}</span>}
                  {vocab?.gender && <span class="badge" style={{ marginInlineStart: 6 }}>{vocab.gender === 'm' ? 'masc.' : 'fem.'}</span>}
                </div>
                {e.note && <div class="small muted mt">{e.note}</div>}
                <div class="btn-row">
                  {e.root && famCount > 1 && (
                    <button class="btn small" onClick={() => (close(), go(`words/root/${e.root}`))}>
                      🌱 Root {displayRoot(e.root)} ({famCount})
                    </button>
                  )}
                  {e.verbId && (
                    <button class="btn small" onClick={() => (close(), go(`verb/${e.verbId}`))}>
                      📋 Conjugation
                    </button>
                  )}
                  {e.vocabId && (
                    <button class="btn small" onClick={() => queueWord(e.vocabId!)}>
                      ＋ Learn this
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div class="card tight">
            <div class="muted">Not in the built-in dictionary yet.</div>
            <input
              class="answer ltr mt"
              placeholder="Add it: type the meaning in English"
              value={meaning}
              onInput={(e) => setMeaning((e.target as HTMLInputElement).value)}
            />
            <div class="btn-row">
              <button class="btn small primary" disabled={!meaning.trim()} onClick={addCustom}>
                ＋ Save to My words
              </button>
            </div>
          </div>
        )}
        {res.entries.length > 0 && res.also && (
          <div class="card tight small">
            Or read it as <span class="he">{res.also.prefix}</span> ({res.also.prefixMeaning}) +{' '}
            {res.also.entries.slice(0, 2).map((e, i) => (
              <>
                {i > 0 && ' / '}
                <span class="he">{e.he}</span> “{e.en}”
              </>
            ))}
          </div>
        )}
        <div class="chip-row mt">
          <a class="chip" href={`https://www.pealim.com/search/?q=${enc}`} target="_blank" rel="noopener">
            Pealim
          </a>
          <a class="chip" href={`https://www.morfix.co.il/${enc}`} target="_blank" rel="noopener">
            Morfix
          </a>
          <a class="chip" href={`https://translate.google.com/?sl=iw&tl=en&text=${enc}`} target="_blank" rel="noopener">
            Google Translate
          </a>
        </div>
      </div>
    </>
  );
}

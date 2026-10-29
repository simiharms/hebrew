// Norwegian text where every word can be tapped for its meaning, and the
// sheet that shows it.
import { useEffect, useState } from 'preact/hooks';
import { GENDER_DE, lookup, wordById } from '../lib/content.ts';
import { splitWords } from '../lib/norsk.ts';
import { isStarred, queueWord, toggleStar } from '../lib/srs.ts';
import { useAppState } from '../lib/store.ts';
import { speak } from '../lib/tts.ts';
import { toast } from './ui.tsx';

let openGloss: ((w: { word: string; start: boolean } | null) => void) | null = null;

export function showGloss(word: string, start = false) {
  openGloss?.({ word, start });
}

/** Whether each word opens a sentence (then its capital letter means nothing). */
function sentenceStarts(parts: { w: string; isWord: boolean }[]): boolean[] {
  let start = true;
  return parts.map((p) => {
    if (p.isWord) {
      const s = start;
      start = false;
      return s;
    }
    if (/[.!?:«»"–—]/.test(p.w)) start = true;
    return false;
  });
}

export function NoText({ text, size = 'md', tap = true, cls = '' }: { text: string; size?: 'sm' | 'md' | 'lg' | 'xl'; tap?: boolean; cls?: string }) {
  if (!tap) return <div class={`no no-${size} ${cls}`} lang="nb">{text}</div>;
  const parts = splitWords(text);
  const starts = sentenceStarts(parts);
  return (
    <div class={`no no-${size} ${cls}`} lang="nb">
      {parts.map((p, i) =>
        p.isWord ? (
          <span class="w" onClick={(e) => (e.stopPropagation(), showGloss(p.w, starts[i]))}>
            {p.w}
          </span>
        ) : (
          p.w
        ),
      )}
    </div>
  );
}

export function GlossSheet() {
  const [tapped, setWord] = useState<{ word: string; start: boolean } | null>(null);
  const word = tapped?.word ?? null;
  useAppState();
  useEffect(() => {
    openGloss = setWord;
    return () => {
      openGloss = null;
    };
  }, []);
  useEffect(() => {
    if (word) speak(word);
  }, [word]);
  if (!word) return null;
  const res = lookup(word, tapped?.start);
  const close = () => setWord(null);
  const enc = encodeURIComponent(word.toLowerCase());

  const learn = (id: string) => {
    const r = queueWord(id);
    toast(r === 'added' ? 'Gemerkt – kommt bei den nächsten neuen Wörtern' : r === 'known' ? 'Schon in deinen Wiederholungen' : 'Ist schon vorgemerkt');
  };

  return (
    <>
      <div class="sheet-backdrop" onClick={close} />
      <div class="sheet" role="dialog" aria-label={`Bedeutung von ${word}`}>
        <div class="grabber" />
        <div class="row">
          <div class="no no-xl">{word}</div>
          <div class="spacer" />
          <button class="btn small" onClick={() => speak(word)} aria-label="Anhören">
            🔊
          </button>
          <button class="icon-btn" aria-label="Schließen" onClick={close}>
            ✕
          </button>
        </div>
        {res.entries.length > 0 &&
          res.entries.slice(0, 3).map((e) => {
            const w = e.wordId ? wordById.get(e.wordId) : undefined;
            return (
              <div class="card tight">
                <div class="row wrap">
                  <span class="no no-lg">{e.no}</span>
                  {e.form && <span class="badge">{e.form}</span>}
                  {w?.gender && <span class="badge">{w.plOnly ? 'nur Plural' : GENDER_DE[w.gender]}</span>}
                  {e.gloss && !e.wordId && <span class="badge">im Text</span>}
                </div>
                <div class="big-de">{e.de}</div>
                {w?.forms && w.pos === 'noun' && <div class="small muted mt">{w.forms.join(' · ')}</div>}
                {w?.vf && <div class="small muted mt">{w.vf.filter(Boolean).join(' · ')}</div>}
                {e.note && <div class="small muted mt">💡 {e.note}</div>}
                {w && (
                  <div class="btn-row">
                    <button class="btn small" onClick={() => learn(w.id)}>
                      ＋ Lernen
                    </button>
                    <button class="btn small" onClick={() => toggleStar(`w:${w.id}`)}>
                      {isStarred(`w:${w.id}`) ? '★ Markiert' : '☆ Markieren'}
                    </button>
                    {w.pos === 'verb' && (
                      <a class="btn small" href={`#/verb/${w.id}`} onClick={close}>
                        📋 Formen
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        {res.entries.length === 0 && res.parts && (
          <div class="card tight">
            <div class="small muted">Zusammengesetztes Wort:</div>
            <div class="mt">
              <strong>{res.parts[0].no}</strong> ({res.parts[0].de}) + <strong>{res.parts[1].no}</strong> ({res.parts[1].de})
            </div>
          </div>
        )}
        {res.entries.length === 0 && !res.parts && (
          <div class="card tight muted">{res.name ? 'Ein Name – eine Person, ein Ort oder ein Werk.' : 'Dieses Wort steht noch nicht im Wörterbuch der App.'}</div>
        )}
        <div class="chip-row mt">
          <a class="chip" href={`https://ordbokene.no/nob/bm/${enc}`} target="_blank" rel="noopener">
            Ordbøkene
          </a>
          <a class="chip" href={`https://translate.google.com/?sl=no&tl=de&text=${enc}`} target="_blank" rel="noopener">
            Google Übersetzer
          </a>
        </div>
      </div>
    </>
  );
}

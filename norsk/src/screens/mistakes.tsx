// The mistake bank: everything answered wrongly, to try again.
import { useState } from 'preact/hooks';
import { DrillCard } from '../components/exercises.tsx';
import { ConfirmButton, TopBar } from '../components/ui.tsx';
import type { Drill } from '../content/types.ts';
import { lessonByN } from '../lib/content.ts';
import { go } from '../lib/router.ts';
import { clearMistake, type Mistake, setState, useAppState } from '../lib/store.ts';

const KIND_LABEL: Record<Mistake['kind'], string> = {
  drill: 'Grammatik',
  word: 'Wörter',
  verb: 'Verben',
  number: 'Zahlen',
  dictation: 'Diktat',
  translate: 'Übersetzen',
};

/** The grammar drill behind a mistake ref "L3:g03_adjektiv#4" or "L3:summary#2". */
function drillOf(ref: string): Drill | undefined {
  const m = ref.match(/^L(\d+):([\w]+)#(\d+)$/);
  if (!m) return undefined;
  const L = lessonByN.get(Number(m[1]));
  if (!L) return undefined;
  if (m[2] === 'summary') return L.summary[Number(m[3])];
  return L.grammar.find((g) => g.id === m[2])?.drills[Number(m[3])];
}

export function MistakesPage() {
  const s = useAppState();
  const [retry, setRetry] = useState<string | null>(null);
  const list = [...s.mistakes].reverse();
  const drills = list.filter((m) => m.kind === 'drill' && drillOf(m.ref));
  return (
    <>
      <TopBar title="Fehler wiederholen" backTo="ueben" />
      <main class="page">
        {list.length === 0 ? (
          <div class="card center">
            <div class="hero">🌿</div>
            <p>Keine offenen Fehler. Was du falsch beantwortest, landet hier – und verschwindet, sobald du es richtig machst.</p>
          </div>
        ) : (
          <>
            <div class="card primary small">
              Hier sammelt die App, was du falsch beantwortet hast. Grammatik kannst du direkt hier noch einmal versuchen; Wörter und Verben kommen in den
              Wiederholungen von selbst wieder.
            </div>
            {drills.length > 0 && (
              <>
                <div class="section-title">Grammatik nochmal · {drills.length}</div>
                {drills.slice(0, 15).map((m) => (
                  <DrillCard key={m.ref + (retry ?? '')} drill={drillOf(m.ref)!} refId={m.ref} onDone={() => setRetry(null)} />
                ))}
              </>
            )}
            <div class="section-title">Alle Fehler</div>
            <div class="list">
              {list.map((m) => (
                <div class="card tight">
                  <div class="row">
                    <span class="badge">{KIND_LABEL[m.kind]}</span>
                    <div class="spacer" />
                    <button class="btn small ghost" onClick={() => clearMistake(m.kind, m.ref)}>
                      Erledigt
                    </button>
                  </div>
                  <div class="small mt">{m.prompt}</div>
                  <div class="small">
                    Deine Antwort: <span class="diff-extra">{m.given}</span> · richtig: <strong class="no">{m.answer}</strong>
                  </div>
                </div>
              ))}
            </div>
            <div class="btn-row">
              <button class="btn" onClick={() => go('lernen')}>
                Wörter üben
              </button>
              <button class="btn" onClick={() => go('verben/training')}>
                Verben üben
              </button>
            </div>
            <ConfirmButton
              label="Liste leeren"
              confirmLabel="Wirklich alle löschen?"
              onConfirm={() =>
                setState((st) => {
                  st.mistakes = [];
                })
              }
            />
          </>
        )}
      </main>
    </>
  );
}

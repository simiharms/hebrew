import { useState } from 'preact/hooks';
import { DrillSet } from '../components/exercises.tsx';
import { Item, RichText, Table, TopBar } from '../components/ui.tsx';
import { lessonByN, lessons } from '../lib/content.ts';
import { lessonSteps, stepDone } from '../lib/progress.ts';
import { go } from '../lib/router.ts';
import { getState, useAppState } from '../lib/store.ts';

export function GrammarTopicPage({ n, id }: { n: number; id: string }) {
  useAppState();
  const L = lessonByN.get(n);
  const g = L?.grammar.find((x) => x.id === id);
  const [practice, setPractice] = useState(false);
  const [finished, setFinished] = useState<number | null>(null);
  if (!L || !g) return <TopBar title="Nicht gefunden" backTo={`lektion/${n}`} />;
  const stepId = `L${n}:${g.id}`;
  const prev = getState().done[stepId];
  const next = lessonSteps(L).find((st) => st.id !== stepId && !stepDone(getState(), st));

  return (
    <>
      <TopBar title={g.title} backTo={`lektion/${n}`} />
      <main class="page">
        <div class="card">
          <div class="small muted">Leksjon {n} · Grammatik</div>
          <h2>{g.title}</h2>
          {g.titleNo && <div class="muted no-em">{g.titleNo}</div>}
          <p class="small">{g.summary}</p>
        </div>
        {g.sections.map((sec) => (
          <div class="card">
            <h3>{sec.h}</h3>
            <RichText text={sec.body} />
            {sec.table && <Table rows={sec.table} />}
          </div>
        ))}
        {!practice ? (
          <button class="btn primary block" onClick={() => setPractice(true)}>
            ✏️ Üben ({g.drills.length} Aufgaben){prev ? ` · zuletzt ${Math.round(prev.score * 100)} %` : ''}
          </button>
        ) : (
          <DrillSet id={stepId} drills={g.drills} title="Übungen" onAll={(avg) => setFinished(avg)} />
        )}
        {finished !== null && (
          <div class="card center">
            <h3>{Math.round(finished * 100)} % richtig</h3>
            <p class="small muted">Falsche Antworten landen in deiner Fehlerliste (Üben → Fehler wiederholen).</p>
            <div class="btn-row">
              <button class="btn" onClick={() => go(`lektion/${n}`)}>
                Zur Lektion
              </button>
              {next && (
                <button class="btn primary" onClick={() => go(next.route)}>
                  Weiter: {next.title}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export function GrammarOverview() {
  const s = useAppState();
  return (
    <>
      <TopBar title="Grammatik" backTo="ueben" />
      <main class="page">
        <div class="card primary small">Alle Grammatikthemen des Buches in der Reihenfolge der Lektionen – zum Nachschlagen und Wiederholen.</div>
        {lessons.map((L) => (
          <>
            <div class="section-title">
              Leksjon {L.n} · {L.title}
            </div>
            <div class="list">
              {L.grammar.map((g) => {
                const d = s.done[`L${L.n}:${g.id}`];
                return (
                  <Item
                    title={g.title}
                    sub={g.summary}
                    done={!!d}
                    right={d ? <span class="badge good">{Math.round(d.score * 100)} %</span> : <span class="badge level">{L.level}</span>}
                    onClick={() => go(`lektion/${L.n}/grammatik/${g.id}`)}
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

import { Item, LevelBadge, Progress, TopBar } from '../components/ui.tsx';
import { lessonByN } from '../lib/content.ts';
import { lessonProgress, lessonSteps, STEP_EMOJI, stepDone } from '../lib/progress.ts';
import { PLAN } from '../lib/plan.ts';
import { go } from '../lib/router.ts';
import { setState, useAppState } from '../lib/store.ts';

const LEVEL_NOTE: Record<string, string> = {
  A1: 'Lektion 1–5 · Anfänger',
  A2: 'Lektion 6–10 · Grundlagen',
  B1: 'Lektion 11–16 · Mittelstufe',
  B2: 'Lektion 17–23 · Fortgeschritten',
};

export function LessonList() {
  const s = useAppState();
  return (
    <>
      <TopBar title="Lektionen" />
      <main class="page">
        <div class="card primary small">
          Die 23 Lektionen von »Et år i Norge«: ein Jahr in Norwegen, von August bis Juni – Oslo, Bergen, Tromsø und Nord-Norge, Ostern auf der Hütte und
          der 17. Mai.
        </div>
        {PLAN.map((p, i) => {
          const pr = lessonProgress(s, p.n);
          const complete = pr.done === pr.total;
          const heading = i === 0 || PLAN[i - 1].level !== p.level;
          return (
            <>
              {heading && (
                <div class="section-title">
                  {p.level} · {LEVEL_NOTE[p.level]}
                </div>
              )}
              <div class="list-gap">
                <Item
                  emoji={complete ? '✅' : p.n === s.lesson ? '▶️' : String(p.n)}
                  title={p.title}
                  sub={
                    <>
                      {p.titleDe} · {lessonByN.has(p.n) ? `${pr.done}/${pr.total}` : 'bald'}
                    </>
                  }
                  done={complete}
                  onClick={() => go(`lektion/${p.n}`)}
                />
              </div>
            </>
          );
        })}
      </main>
    </>
  );
}

export function LessonPage({ n }: { n: number }) {
  const s = useAppState();
  const L = lessonByN.get(n);
  const plan = PLAN.find((p) => p.n === n);
  if (!plan) return <TopBar title="Nicht gefunden" backTo="lektionen" />;
  const steps = L ? lessonSteps(L) : [];
  const pr = lessonProgress(s, n);
  return (
    <>
      <TopBar title={`Leksjon ${n}`} backTo="lektionen" right={<LevelBadge level={plan.level} />} />
      <main class="page">
        <div class="card">
          <h2 class="lesson-title">{plan.title}</h2>
          <div class="muted">{plan.titleDe}</div>
          <div class="small muted mt">
            📍 {plan.place} · {plan.when}
          </div>
          {L && (
            <>
              <ul class="goals">
                {L.goals.map((g) => (
                  <li>{g}</li>
                ))}
              </ul>
              <Progress value={pr.done / pr.total} />
              <div class="small muted mt">
                {pr.done} von {pr.total} Schritten erledigt
              </div>
            </>
          )}
        </div>
        {!L && <div class="card">Diese Lektion ist noch nicht in der App.</div>}
        <div class="list">
          {steps.map((st) => {
            const done = stepDone(s, st);
            return (
              <Item
                emoji={STEP_EMOJI[st.kind]}
                title={st.title}
                sub={st.sub}
                done={done}
                onClick={() => go(st.route)}
                right={<span class={`check ${done ? 'on' : ''}`}>{done ? '✓' : ''}</span>}
              />
            );
          })}
        </div>
        <div class="btn-row">
          {n > 1 && (
            <button class="btn" onClick={() => go(`lektion/${n - 1}`)}>
              ‹ Lektion {n - 1}
            </button>
          )}
          {n < PLAN.length && (
            <button class="btn" onClick={() => go(`lektion/${n + 1}`)}>
              Lektion {n + 1} ›
            </button>
          )}
        </div>
        {n !== s.lesson && (
          <button
            class="btn ghost block mt"
            onClick={() =>
              setState((st) => {
                st.lesson = n;
              })
            }
          >
            Das ist jetzt meine Lektion
          </button>
        )}
      </main>
    </>
  );
}

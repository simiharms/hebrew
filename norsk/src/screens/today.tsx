import { Item, LevelBadge, Progress, TopBar } from '../components/ui.tsx';
import { lessonByN } from '../lib/content.ts';
import { lessonProgress, nextStep, planOf, STEP_EMOJI } from '../lib/progress.ts';
import { go } from '../lib/router.ts';
import { dueCount, newLeftToday, newWordQueue } from '../lib/srs.ts';
import { streak, today, useAppState } from '../lib/store.ts';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 10) return 'God morgen!';
  if (h < 17) return 'God dag!';
  return 'God kveld!';
}

export function Today() {
  const s = useAppState();
  const n = s.lesson;
  const L = lessonByN.get(n);
  const plan = planOf(n);
  const p = lessonProgress(s, n);
  const next = nextStep(s, n);
  const due = dueCount(s);
  const newLeft = Math.min(newLeftToday(s), newWordQueue(s).length);
  const log = s.days.find((d) => d.date === today());
  const st = streak(s);
  const mistakes = s.mistakes.length;

  return (
    <>
      <TopBar
        title="Nordlys"
        right={
          <button class="icon-btn" aria-label="Einstellungen" onClick={() => go('einstellungen')}>
            ⚙️
          </button>
        }
      />
      <main class="page">
        <div class="hello">
          <h2>{greeting()}</h2>
          <div class="small muted">
            {st > 0 ? `🔥 ${st} ${st === 1 ? 'Tag' : 'Tage'} in Folge` : 'Schön, dass du da bist.'}
            {log && log.reviews > 0 && ` · heute ${log.reviews} Karten geübt`}
          </div>
        </div>

        <div class="card primary">
          <div class="row">
            <span class="small muted">Deine Lektion</span>
            <div class="spacer" />
            {plan && <LevelBadge level={plan.level} />}
          </div>
          <h2 class="lesson-title">
            {n}. {plan?.title}
          </h2>
          <div class="small muted">
            {plan?.titleDe} · {plan?.place}
          </div>
          <div class="mt">
            <Progress value={p.done / p.total} />
            <div class="small muted mt">
              {p.done} von {p.total} Schritten
            </div>
          </div>
          {L ? (
            <div class="btn-row">
              <button class="btn primary" onClick={() => go(next ? next.route : `lektion/${n}`)}>
                {next ? `${STEP_EMOJI[next.kind]} Weiter: ${next.title}` : '✓ Lektion fertig – ansehen'}
              </button>
            </div>
          ) : (
            <p class="small">Diese Lektion ist noch nicht in der App.</p>
          )}
          <button class="btn ghost small mt" onClick={() => go(`lektion/${n}`)}>
            Alle Schritte der Lektion
          </button>
        </div>

        <div class="section-title">Wörter</div>
        <div class="list">
          <Item
            emoji="🗂️"
            title={due + newLeft > 0 ? 'Wörter üben' : 'Für heute alles wiederholt'}
            sub={
              due + newLeft > 0 ? (
                <>
                  {due > 0 && `${due} zum Wiederholen`}
                  {due > 0 && newLeft > 0 && ' · '}
                  {newLeft > 0 && `${newLeft} neue`}
                </>
              ) : (
                'Morgen kommen wieder welche. Du kannst trotzdem neue Wörter einer Lektion lernen.'
              )
            }
            right={due + newLeft > 0 ? <span class="badge level">{due + newLeft}</span> : <span class="check on">✓</span>}
            onClick={() => go(due + newLeft > 0 ? 'lernen' : `lektion/${n}/woerter`)}
          />
        </div>

        <div class="section-title">Außerdem</div>
        <div class="list">
          <Item emoji="🔁" title="Verben trainieren" sub="Präsens, Präteritum, Perfekt" onClick={() => go(`verben/training`)} />
          {mistakes > 0 && <Item emoji="🩹" title="Fehler wiederholen" sub={`${mistakes} ${mistakes === 1 ? 'Aufgabe' : 'Aufgaben'} aus deinen Übungen`} onClick={() => go('fehler')} />}
          <Item emoji="🎧" title="Hörtraining" sub="Sätze aus den Texten hören und schreiben" onClick={() => go('hoertraining')} />
          <Item emoji="🕒" title="Zahlen und Uhrzeit" sub="halv tre = halb drei (2:30)" onClick={() => go('zahlen')} />
        </div>
      </main>
    </>
  );
}

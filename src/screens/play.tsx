// Shoresh Play: the hub (today's line, Verb of the Day, every game, the bus
// settings), the verb collection, and the pieces Today shares with them: the
// dock above the tab bar, the rank chip and the Daily Six squares.
import type { Ref } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Item, TopBar, toast } from '../components/ui.tsx';
import { LineMap, Shorshi } from '../games/kit-ui.tsx';
import { BADGES, GAMES, type GameMeta, peekRound, playerLevel, primeAudio, RANKS, sfx, verbMedal } from '../games/kit.ts';
import { dockAction, gameRoute, type RideStatus, rideStatus, type SixMark, sixStatus, startRide } from '../games/ride.ts';
import { levelRank, verbs } from '../lib/content.ts';
import { go } from '../lib/router.ts';
import { type AppState, getState, setState, useAppState } from '../lib/store.ts';
import { ttsSupported } from '../lib/tts.ts';
import { BINYAN_LABEL } from './verbs.tsx';

const MEDAL = ['·', '🥉', '🥈', '🥇'];
const BINYAN_ORDER = ['paal', 'piel', 'hifil', 'hitpael', 'nifal', 'pual', 'hufal'];
const rankAt = (level: number) => [...RANKS].reverse().find((r) => level >= r.from) ?? RANKS[0];
const fmt = (n: number) => n.toLocaleString('en-US');

// ---------- Shared with Today ----------

export function RankChip({ xp }: { xp: number }) {
  const p = playerLevel(xp);
  return (
    <span class="rank-chip" title={`${p.rank.en} · ${fmt(xp)} XP`} aria-label={`Level ${p.level}, ${p.rank.en}`}>
      {p.rank.emoji} Lv {p.level}
    </span>
  );
}

/** Today's six Verb of the Day squares (blank until answered). */
export function SixSquares({ marks }: { marks: SixMark[] }) {
  const n = marks.filter(Boolean).length;
  return (
    <span class="six-strip" role="img" aria-label={`${n} of 6 answered`}>
      {marks.map((m) => (
        <i class={m} />
      ))}
    </span>
  );
}

/** The next thing to play, fixed just above the tab bar where the thumb is. */
export function Dock({ hideOn }: { hideOn?: string[] }) {
  const s = useAppState();
  const a = dockAction(s);
  if (hideOn?.includes(a.route)) return null;
  return (
    <button
      class={`dock dock-${a.kind}`}
      data-kind={a.kind}
      onClick={() => {
        if (a.kind === 'stop') startRide();
        go(a.route);
      }}
    >
      <span class="dock-ico" aria-hidden="true">
        {a.icon}
      </span>
      <span class="dock-txt">
        <span class="dock-label">{a.label}</span>
        <span class="sub">{a.sub}</span>
      </span>
      <span class="dock-go" aria-hidden="true">
        ▶
      </span>
    </button>
  );
}

// ---------- Hub ----------

function rideAction(st: RideStatus): { label: string; route: string; run: () => void } | null {
  const meta = (g: string) => GAMES.find((x) => x.id === g);
  const peek = peekRound();
  if (st.next) {
    const m = meta(st.next);
    const n = st.plan.indexOf(st.next) + 1;
    const resume = peek && peek.mode === 'ride' && peek.game === st.next;
    const label = resume ? `▶ Resume stop ${n} · ${m?.title}` : st.started ? `▶ Stop ${n} · ${m?.emoji} ${m?.title}` : `▶ Start the ride · ${m?.emoji} ${m?.title}`;
    return {
      label,
      route: gameRoute(st.next, 'ride'),
      run: () => {
        const next = startRide();
        if (next) go(gameRoute(next, 'ride'));
      },
    };
  }
  if (st.terminusOpen) return { label: '👑 Terminus · Table Smash ×2', route: 'play/smash/terminus', run: () => go('play/smash/terminus') };
  return null;
}

function RideCard({ st, act, ctaRef }: { st: RideStatus; act: ReturnType<typeof rideAction>; ctaRef: Ref<HTMLButtonElement> }) {
  const next = st.next ? GAMES.find((g) => g.id === st.next) : null;
  const sub = !st.started
    ? `${st.goal} short rounds · about ${Math.round(st.goal * 1.6)} min`
    : st.met
      ? st.terminusDone
        ? 'Line and terminus done · a new line tomorrow'
        : 'Line finished! The terminus pays double'
      : `${st.done.length} of ${st.goal} stops done`;
  return (
    <section class="ride-card" aria-label="Today's line">
      <div class="ride-head">
        <Shorshi mood={st.met ? 'cheer' : 'idle'} size={44} />
        <div class="grow">
          <h2>🚌 Today's line</h2>
          <div class="ride-sub">{sub}</div>
        </div>
        <span class="ride-count" aria-hidden="true">
          {st.done.length}/{st.goal}
        </span>
      </div>
      <LineMap plan={st.plan} done={st.done} terminusOpen={st.terminusOpen} terminusDone={st.terminusDone} />
      {next && (
        <div class="ride-next">
          Next: <b>{next.title}</b> ·{' '}
          <span class="he" lang="he" dir="rtl">
            {next.titleHe}
          </span>
          <div class="small muted">{next.pitch}</div>
        </div>
      )}
      {act ? (
        <button ref={ctaRef} class={`btn block game-cta ${st.terminusOpen ? 'gold' : 'primary'}`} onClick={act.run}>
          {act.label}
        </button>
      ) : (
        <div class="ride-done">✓ All stops done today. Free play still earns XP.</div>
      )}
    </section>
  );
}

function weekXp(s: AppState): { days: { key: string; xp: number; label: string }[]; week: number; last: number } {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { key, xp: s.days.find((x) => x.date === key)?.xp ?? 0, label: d.toLocaleDateString('en-US', { weekday: 'narrow' }) };
  });
  const sum = (xs: typeof days) => xs.reduce((a, x) => a + x.xp, 0);
  return { days: days.slice(7), week: sum(days.slice(7)), last: sum(days.slice(0, 7)) };
}

function LevelCard({ s }: { s: AppState }) {
  const p = playerLevel(s.play.xp);
  const next = rankAt(p.level + 1);
  const w = weekXp(s);
  const max = Math.max(20, ...w.days.map((d) => d.xp));
  const trend = w.week > w.last ? '▲' : w.week < w.last ? '▼' : '';
  return (
    <section class="card level-card" aria-label="Level and XP">
      <div class="row">
        <span class="lv-num">Lv {p.level}</span>
        <span class="grow lv-rank">
          {p.rank.emoji}{' '}
          <span class="he" lang="he" dir="rtl">
            {p.rank.he}
          </span>{' '}
          {p.rank.en}
        </span>
        <span class="lv-total">{fmt(s.play.xp)} XP</span>
      </div>
      <div class="lvl-bar" aria-hidden="true">
        <div style={{ transform: `scaleX(${p.span ? Math.min(1, p.into / p.span) : 0})` }} />
      </div>
      <div class="lv-to">
        {fmt(p.span - p.into)} XP to {next !== p.rank ? `${next.emoji} ` : ''}Lv {p.level + 1}
        {next !== p.rank ? ` · ${next.en}` : ''}
      </div>
      <div class="week">
        {w.week + w.last === 0 ? (
          <div class="week-empty small muted">Every right answer earns XP. Your week shows up here.</div>
        ) : (
          <div class="week-bars" aria-hidden="true">
            {w.days.map((d, i) => (
              <span class={`wb ${i === 6 ? 'today' : ''}`}>
                <i style={{ transform: `scaleY(${d.xp ? Math.max(0.08, d.xp / max) : 0.03})` }} />
                <small>{d.label}</small>
              </span>
            ))}
          </div>
        )}
        <div class="week-txt">
          <div>
            This week <b>{fmt(w.week)} XP</b>
          </div>
          <div class="small muted">
            last week {fmt(w.last)} {trend && <span class={trend === '▲' ? 'up' : 'down'}>{trend}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}

function SixCard({ s }: { s: AppState }) {
  const six = sixStatus(s);
  const n = six.marks.filter(Boolean).length;
  const greens = six.marks.filter((m) => m === 'g').length;
  const sub = six.done ? `Done · ${greens}/6 first try · tap to share` : six.started ? `${n} of 6 typed · finish today's grid` : 'Type six forms of one verb · once a day';
  return (
    <button class={`card six-card ${six.done ? 'done' : ''}`} onClick={() => go('play/six')}>
      <span class="six-ico" aria-hidden="true">
        🟩
      </span>
      <span class="grow">
        <span class="six-title">
          Verb of the Day ·{' '}
          <span class="he" lang="he" dir="rtl">
            פועל היום
          </span>
        </span>
        <SixSquares marks={six.marks} />
        <span class="small muted">{sub}</span>
      </span>
      <span class="muted" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

const TAGS: Record<GameMeta['input'], string> = { tap: '', tiles: 'build', typing: 'typed', audio: '🎧' };

function GameTile({ g, s, resume }: { g: GameMeta; s: AppState; resume: { answered: number; total: number } | null }) {
  const locked = levelRank(s.level) < levelRank(g.minLevel);
  const best = s.play.best[g.id];
  const sprintBest = s.play.best[`${g.id}:sprint`];
  const n = best?.stars ?? 0;
  const tags = [g.verbs && 'verbs', TAGS[g.input]].filter(Boolean) as string[];
  const open = () => {
    if (locked) toast(`${g.title} opens at ${g.minLevel}: it needs past and future forms.`);
    else go(gameRoute(g.id, 'free'));
  };
  return (
    <div class={`game-cell ${g.sprint && !locked ? 'has-sprint' : ''}`}>
      <button class={`game-tile ${locked ? 'locked' : ''}`} data-game={g.id} onClick={open} aria-label={`${g.title}${locked ? ` (from ${g.minLevel})` : ''}`}>
        <span class="emoji" aria-hidden="true">
          {g.emoji}
        </span>
        <span class="title">{g.title}</span>
        <span class="he" lang="he" dir="rtl">
          {g.titleHe}
        </span>
        <span class="pitch">{g.pitch}</span>
        <span class="tile-foot">
          {locked ? (
            <span class="tag lock">🔒 from {g.minLevel}</span>
          ) : (
            <span class="best" aria-label={best ? `Best ${n} of 3 stars` : 'Not played yet'}>
              {'★'.repeat(n)}
              <span class="off">{'★'.repeat(3 - n)}</span>
            </span>
          )}
          {!g.sprint &&
            !locked &&
            tags.map((t) => (
              <span class="tag" aria-hidden="true">
                {t}
              </span>
            ))}
        </span>
        {resume && (
          <span class="tile-flag" aria-label={`Paused at ${resume.answered} of ${resume.total}`}>
            ⏸ {resume.answered}/{resume.total}
          </span>
        )}
      </button>
      {g.sprint && !locked && (
        <button class="game-sprint" onClick={() => go(gameRoute(g.id, 'sprint'))} aria-label={`${g.title} sprint, 60 seconds${sprintBest ? `, best ${sprintBest.score}` : ''}`}>
          <span>⚡ Sprint</span>
          {sprintBest && <small>best {sprintBest.score}</small>}
        </button>
      )}
    </div>
  );
}

function PrefChips({ s }: { s: AppState }) {
  const toggleSound = () => {
    const on = !getState().settings.sound;
    setState((st) => {
      st.settings.sound = on;
    });
    if (on) {
      primeAudio();
      sfx('tap');
    }
  };
  const speech = ttsSupported();
  return (
    <div class="chip-row play-prefs">
      <button class={`chip ${s.settings.sound ? 'on' : ''}`} aria-pressed={s.settings.sound} onClick={toggleSound}>
        🔈 Sound
      </button>
      <button
        class={`chip ${s.settings.gameVoice && speech ? 'on' : ''}`}
        aria-pressed={s.settings.gameVoice && speech}
        disabled={!speech}
        title={speech ? 'Games read Hebrew answers aloud' : "Speech isn't available in this browser"}
        onClick={() => setState((st) => void (st.settings.gameVoice = !st.settings.gameVoice))}
      >
        🗣️ Voice
      </button>
      <button class={`chip ${s.settings.calm ? 'on' : ''}`} aria-pressed={s.settings.calm} onClick={() => setState((st) => void (st.settings.calm = !st.settings.calm))}>
        🐢 Calm
      </button>
    </div>
  );
}

function medalCounts(s: AppState): [number, number, number] {
  const c: [number, number, number] = [0, 0, 0];
  for (const v of verbs) {
    const m = verbMedal(v, s.cards);
    if (m) c[m - 1]++;
  }
  return c;
}

const badgeEarned = (s: AppState, b: (typeof BADGES)[number]) => s.play.badges.includes(b.id) || b.test(s);

// Whether an element is in view above the dock zone (the bottom 140 px).
function useInView(ref: { current: Element | null }, key: unknown): boolean {
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setSeen(false);
      return;
    }
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { rootMargin: '0px 0px -140px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [key]);
  return seen;
}

export function PlayHub() {
  const s = useAppState();
  const st = rideStatus(s);
  const act = rideAction(st);
  const ctaRef = useRef<HTMLButtonElement>(null);
  // The dock repeats the ride card's button only once that has scrolled out of reach.
  const ctaSeen = useInView(ctaRef, act?.route ?? '');
  const peek = peekRound();
  const [bronze, silver, gold] = medalCounts(s);
  const badges = BADGES.filter((b) => badgeEarned(s, b)).length;
  return (
    <>
      <TopBar title="Play" right={<RankChip xp={s.play.xp} />} />
      <main class="page has-dock play-hub">
        <RideCard st={st} act={act} ctaRef={ctaRef} />
        <LevelCard s={s} />
        {levelRank(s.level) >= 1 && <SixCard s={s} />}
        <div class="section-title">Games · free play</div>
        <div class="game-grid">
          {GAMES.map((g) => (
            <GameTile g={g} s={s} resume={peek && peek.game === g.id && peek.mode === 'free' ? peek : null} />
          ))}
        </div>
        <div class="section-title">On the bus</div>
        <PrefChips s={s} />
        <p class="small muted prefs-note">Everything works muted. Calm turns off confetti, bounces and shakes.</p>
        <Item emoji="🏅" title="Verb collection" sub={`🥉 ${bronze} · 🥈 ${silver} · 🥇 ${gold} · ${badges}/${BADGES.length} badges`} onClick={() => go('play/collection')} />
      </main>
      <Dock hideOn={act && ctaSeen ? ['play', act.route] : ['play']} />
    </>
  );
}

// ---------- Collection ----------

export function CollectionPage() {
  const s = useAppState();
  const medal = new Map(verbs.map((v) => [v.id, verbMedal(v, s.cards)]));
  const [bronze, silver, gold] = medalCounts(s);
  const withMedal = bronze + silver + gold;
  const groups = BINYAN_ORDER.map((b) => ({ b, list: verbs.filter((v) => v.binyan === b) })).filter((g) => g.list.length);
  return (
    <>
      <TopBar title="Verb collection" backTo="play" />
      <main class="page collection">
        <section class="card coll-sum">
          <div class="row">
            <div class="grow">
              <div class="coll-big">
                {withMedal} <span class="muted">/ {verbs.length}</span>
              </div>
              <div class="small muted">verbs with a medal</div>
            </div>
            <div class="coll-medals" aria-label={`${bronze} bronze, ${silver} silver, ${gold} gold`}>
              <span>🥉 {bronze}</span>
              <span>🥈 {silver}</span>
              <span>🥇 {gold}</span>
            </div>
          </div>
          <div class="lvl-bar mt" aria-hidden="true">
            <div style={{ transform: `scaleX(${verbs.length ? withMedal / verbs.length : 0})` }} />
          </div>
          <p class="small muted coll-note">
            🥉 one tense known · 🥈 every tense known · 🥇 every tense mature. Medals come only from typed and built answers (Verb Forge, Verb of
            the Day, verb sessions), never from taps.
          </p>
        </section>

        <div class="section-title">Badges</div>
        <div class="badge-shelf">
          {BADGES.map((b) => {
            const on = badgeEarned(s, b);
            return (
              <div class={`badge-tile ${on ? 'on' : ''}`} aria-label={`${b.en}${on ? '' : ' (not yet)'}`}>
                <span class="b-emoji" aria-hidden="true">
                  {b.emoji}
                </span>
                <span class="he" lang="he" dir="rtl">
                  {b.he}
                </span>
                <span class="b-en">{b.en}</span>
              </div>
            );
          })}
        </div>

        {groups.map(({ b, list }) => {
          const n = list.filter((v) => medal.get(v.id)).length;
          return (
            <>
              <div class="section-title">
                {BINYAN_LABEL[b] ?? b} · {n}/{list.length}
              </div>
              <div class="vchips">
                {list.map((v) => {
                  const m = medal.get(v.id) ?? 0;
                  return (
                    <button class={`vchip m${m}`} onClick={() => go(`verb/${v.id}`)} aria-label={`${v.inf}, ${v.en}${m ? `, ${['', 'bronze', 'silver', 'gold'][m]}` : ''}`}>
                      <span class="vm" aria-hidden="true">
                        {MEDAL[m]}
                      </span>
                      <span class="he" lang="he" dir="rtl">
                        {v.inf}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          );
        })}
      </main>
    </>
  );
}

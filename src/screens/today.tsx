import { Item, Progress, TopBar } from '../components/ui.tsx';
import { allVocab } from '../lib/content.ts';
import { currentUnit, UNITS, unitProgress } from '../lib/course.ts';
import { strength } from '../lib/fsrs.ts';
import { levelUpSuggestion, todaysPlan } from '../lib/plan.ts';
import { SKILLS, weakestSkills } from '../lib/skills.ts';
import { go } from '../lib/router.ts';
import { setState, streak, today, useAppState } from '../lib/store.ts';

const TIPS = [
  'Answer by voice: tap the 🎤 on the Hebrew keyboard and speak — it trains pronunciation and iOS types it for you.',
  'Tap any Hebrew word in an article to see its root, its prefixes (ו, ה, ב, ל, מ, ש) and the dictionary form.',
  'Got marked wrong but you were right? Tap “I was right” — your answer will be accepted from now on.',
  'Watch Kan 11 or Kan Educational shows on YouTube with Hebrew subtitles, then paste a line you liked into “Your own text”.',
  'Israelis mostly use future-tense forms as polite commands: תשלח לי (send me) rather than שלח לי.',
  'Numbers trip everyone up. A daily round of “Numbers by ear” makes prices and phone numbers automatic.',
  'In emails, “אשמח אם…” (I’d be glad if…) is the friendliest way to ask for something.',
  'Read the same article twice on different days. The second time, try answering before looking at the text.',
  'Streetwise Hebrew (a free podcast) is great for slang once you finish the scenes here.',
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'בוקר טוב';
  if (h < 17) return 'צהריים טובים';
  return 'ערב טוב';
}

export function Today() {
  const s = useAppState();
  const plan = todaysPlan(s);
  const done = plan.filter((p) => p.done).length;
  const minutes = plan.filter((p) => !p.done).reduce((a, p) => a + p.minutes, 0);
  const st = streak(s);
  const vocab = allVocab();
  const known = vocab.filter((v) => ['known', 'mature'].includes(strength(s.cards[`v:${v.id}`]))).length;
  const up = levelUpSuggestion(s);
  const tip = TIPS[new Date(today()).getTime() / 86_400_000 % TIPS.length | 0];
  const n = currentUnit(s);
  const unit = UNITS[n];
  const up_ = unitProgress(s, n);
  const weak = weakestSkills(s)[0];
  const weakLabel = weak && SKILLS.find((x) => x.id === weak)!.label.toLowerCase();

  return (
    <>
      <TopBar
        title="Shoresh"
        right={
          <button class="icon-btn" aria-label="Settings and progress" onClick={() => go('me')}>
            ⚙️
          </button>
        }
      />
      <main class="page">
        <div class="row">
          <div class="grow">
            <div class="he he-lg" style={{ textAlign: 'left' }}>
              {greeting()}
            </div>
            <div class="small muted">
              Level {s.level} · {done}/{plan.length} done today{minutes ? ` · ~${minutes} min left` : ''}
            </div>
          </div>
        </div>
        <div class="stats mt">
          <div class="stat">
            <div class="num">{st}🔥</div>
            <div class="lbl">day streak</div>
          </div>
          <div class="stat">
            <div class="num">{known}</div>
            <div class="lbl">words known</div>
          </div>
          <div class="stat">
            <div class="num">{Object.keys(s.done).filter((k) => !k.includes(':')).length}</div>
            <div class="lbl">lessons done</div>
          </div>
        </div>

        {up && (
          <div class="card accent">
            <strong>Ready for {up}?</strong>
            <p class="small">You've done most of the {s.level} reading and listening well.</p>
            <button
              class="btn primary small"
              onClick={() =>
                setState((x) => {
                  x.level = up;
                })
              }
            >
              Move up to {up}
            </button>
          </div>
        )}

        {!s.profile.assessment && (
          <div class="card accent">
            <strong>Find your level in each skill</strong>
            <p class="small">A 10-minute skills check (vocabulary, verbs, grammar, listening, reading, writing) tailors the plan to you.</p>
            <button class="btn primary small" onClick={() => go('assessment')}>
              Take the skills check
            </button>
          </div>
        )}

        {unit && (
          <button class="item mt" onClick={() => go(`unit/${n}`)}>
            <span class="emoji">📘</span>
            <span class="grow">
              <div class="sub">
                Course · Unit {n + 1} of {UNITS.length} · {unit.level}
              </div>
              <div class="title">{unit.title}</div>
              <div class="mt">
                <Progress value={up_.done / up_.total} />
              </div>
            </span>
            <span class="muted">›</span>
          </button>
        )}

        <div class="section-title">
          Today's plan{weakLabel ? ` · focus: ${weakLabel}` : ''}
        </div>
        <div class="list">
          {plan.map((p) => (
            <Item
              emoji={p.emoji}
              title={
                <>
                  {p.title} {p.focus && <span class="badge warn">focus</span>}
                </>
              }
              sub={p.sub}
              done={p.done}
              onClick={() => go(p.route)}
              right={<span class={`check ${p.done ? 'on' : ''}`}>{p.done ? '✓' : ''}</span>}
            />
          ))}
        </div>

        <div class="card tight mt small">
          💡 <span>{tip}</span>
        </div>
      </main>
    </>
  );
}

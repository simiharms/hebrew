// Spaced repetition scheduler based on FSRS-4.5 (default parameters).
// Ratings: 1 again, 2 hard, 3 good, 4 easy.

export type Rating = 1 | 2 | 3 | 4;

export interface CardState {
  due: number; // epoch ms
  s: number; // stability in days
  d: number; // difficulty 1..10
  reps: number;
  lapses: number;
  last: number; // epoch ms of last review
}

const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const DAY = 86_400_000;
const RELEARN_MS = 10 * 60_000;

const clampD = (d: number) => Math.min(10, Math.max(1, d));

function initDifficulty(g: Rating): number {
  return W[4] - (g - 3) * W[5];
}

export function retrievability(elapsedDays: number, s: number): number {
  return Math.pow(1 + (FACTOR * elapsedDays) / s, DECAY);
}

export function intervalDays(s: number, retention: number): number {
  return (s / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
}

export function review(card: CardState | undefined, g: Rating, now: number, retention = 0.9): CardState {
  let s: number;
  let d: number;
  let lapses = card?.lapses ?? 0;
  if (!card || card.reps === 0) {
    s = W[g - 1];
    d = clampD(initDifficulty(g));
  } else {
    const elapsed = Math.max(0, (now - card.last) / DAY);
    const r = retrievability(elapsed, card.s);
    const nextD = card.d - W[6] * (g - 3);
    d = clampD(W[7] * initDifficulty(4) + (1 - W[7]) * nextD);
    if (g === 1) {
      lapses++;
      s = W[11] * Math.pow(card.d, -W[12]) * (Math.pow(card.s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
      s = Math.min(s, card.s);
    } else {
      const hard = g === 2 ? W[15] : 1;
      const easy = g === 4 ? W[16] : 1;
      s =
        card.s *
        (1 + Math.exp(W[8]) * (11 - card.d) * Math.pow(card.s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy);
    }
  }
  s = Math.max(0.1, s);
  let due: number;
  if (g === 1) {
    due = now + RELEARN_MS;
  } else {
    const days = Math.max(1, Math.round(intervalDays(s, retention)));
    due = startOfDay(now) + days * DAY + 4 * 3600_000; // due at 4am local after N days
  }
  return { due, s, d, reps: (card?.reps ?? 0) + 1, lapses, last: now };
}

export function startOfDay(t: number): number {
  const dt = new Date(t);
  dt.setHours(0, 0, 0, 0);
  return dt.getTime();
}

export function isDue(card: CardState, now: number): boolean {
  return card.due <= now;
}

/** "Known" = remembered for at least a few days. "Mature" = stable for 3+ weeks. */
export function strength(card?: CardState): 'new' | 'learning' | 'known' | 'mature' {
  if (!card || card.reps === 0) return 'new';
  if (card.s >= 21) return 'mature';
  if (card.s >= 4) return 'known';
  return 'learning';
}

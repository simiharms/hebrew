import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
// ride.ts first: it imports the kit, which loads ride.ts back through import.meta.glob.
import { dockAction, gameRoute, planRide, rideStatus, sixStatus, startRide } from '../src/games/ride.ts';
import { clearRound, finishRound, GAMES, type RoundSnapshot, saveRound } from '../src/games/kit.ts';
import type { Level } from '../src/content/types.ts';
import type { Skill, Stat } from '../src/lib/skills.ts';
import { type AppState, defaultState, type GameId, getState, restoreState, setState, today } from '../src/lib/store.ts';

// Hebrew voices on the "device" (node has no speech).
const tts = vi.hoisted(() => ({ voices: [] as { lang: string }[] }));
vi.mock('../src/lib/tts.ts', async (orig) => ({ ...(await orig<typeof import('../src/lib/tts.ts')>()), hebrewVoices: () => tts.voices }));

const mem = new Map<string, string>();
beforeAll(() => {
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size;
    },
  } as Storage;
});
beforeEach(() => {
  mem.clear();
  tts.voices = [];
});

const LEVELS: Level[] = ['A1', 'A2', 'B1', 'C1'];
const VERB_GAMES: GameId[] = ['snap', 'sort', 'forge', 'smash', 'six', 'echo'];
const dates = Array.from({ length: 28 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);

function fresh(patch: Partial<AppState> = {}, settings: Partial<AppState['settings']> = {}): AppState {
  restoreState({ ...defaultState(), onboarded: true, level: 'B1', ...patch, settings: { ...defaultState().settings, ...settings } });
  return getState();
}

// A profile where `weak` is clearly the weakest skill.
function weakIn(weak: Skill): AppState['profile'] {
  const stat = (score: number): Stat => ({ score, n: 12, at: Date.now() });
  const skills: Partial<Record<Skill, Stat>> = { vocab: stat(0.9), verbs: stat(0.9), grammar: stat(0.9), listening: stat(0.9), reading: stat(0.9) };
  skills[weak] = stat(0.1);
  return { skills, topics: {} };
}

const snapshot = (game: GameId, mode: RoundSnapshot['mode'], answered: number, total = 8): RoundSnapshot => ({
  v: 1,
  game,
  mode,
  date: today(),
  startedAt: Date.now() - 60_000,
  savedAt: Date.now(),
  items: Array.from({ length: total }, (_, i) => ({ key: `k${i}` })),
  results: Array.from({ length: total }, (_, i) => (i < answered ? { ok: true, firstTry: true } : null)),
  missed: [],
  xp: answered * 10,
  combo: answered,
  bestCombo: answered,
  strengthened: 0,
  rated: [],
  misses: [],
  verbIds: [],
});

describe('planRide', () => {
  it('opens with a tap warm-up, then Verb Forge, with distinct stops sized by the setting', () => {
    for (const level of LEVELS) {
      for (const stops of [2, 3, 4]) {
        for (const verbsOnly of [false, true]) {
          for (const date of dates) {
            const s = fresh({ level }, { rideStops: stops, verbsOnly });
            const plan = planRide(s, date);
            const where = `${level} ${stops} ${verbsOnly} ${date}: ${plan.join(',')}`;
            expect(plan.length, where).toBe(stops);
            expect(new Set(plan).size, where).toBe(stops);
            expect(['snap', 'sort'], where).toContain(plan[0]);
            expect(plan[1], where).toBe('forge');
            for (const g of plan) expect(GAMES.some((x) => x.id === g), where).toBe(true);
            expect(plan, where).not.toContain('six');
            expect(plan, where).not.toContain('echo');
            if (level === 'A1') expect(plan, where).not.toContain('sort');
          }
        }
      }
    }
  });
  it('stays the same all day and varies from day to day', () => {
    const s = fresh({ level: 'B1' });
    expect(planRide(s, '2026-11-22')).toEqual(planRide(s, '2026-11-22'));
    const warmups = new Set(dates.map((d) => planRide(s, d)[0]));
    expect(warmups).toEqual(new Set(['snap', 'sort']));
    expect(planRide(s)).toEqual(planRide(s, today()));
  });
  it('sends the third stop to the weakest skill', () => {
    for (const date of dates) {
      expect(planRide(fresh({ profile: weakIn('grammar') }), date)[2]).toBe('gap');
      expect(planRide(fresh({ profile: weakIn('vocab') }), date)[2]).toBe('match');
      expect(planRide(fresh({ profile: weakIn('listening') }), date)[2]).toBe('match');
      const verbs = planRide(fresh({ profile: weakIn('verbs') }), date);
      expect(verbs[2]).toBe(verbs[0] === 'snap' ? 'sort' : 'snap');
      expect(planRide(fresh({ level: 'A1', profile: weakIn('verbs') }), date)).toEqual(['snap', 'forge', 'smash']);
    }
  });
  it('rotates He or She?, Gap Dash and Match Rush when no skill stands out', () => {
    const s = fresh();
    const thirds = dates.slice(0, 3).map((d) => planRide(s, d)[2]);
    expect(new Set(thirds)).toEqual(new Set(['gender', 'gap', 'match']));
    // reading is the weakest: not a game skill, so the rotation applies
    expect(['gender', 'gap', 'match']).toContain(planRide(fresh({ profile: weakIn('reading') }), dates[0])[2]);
  });
  it('takes Echo along only with game speech on and a Hebrew voice', () => {
    const profile = weakIn('listening');
    expect(planRide(fresh({ profile }, { gameVoice: true }), dates[0])[2]).toBe('match');
    tts.voices = [{ lang: 'he-IL' }];
    expect(planRide(fresh({ profile }), dates[0])[2]).toBe('match');
    expect(planRide(fresh({ profile }, { gameVoice: true }), dates[0])[2]).toBe('echo');
  });
  it('rides only verb games in verbs-only mode', () => {
    for (const level of LEVELS) {
      for (const date of dates) {
        const plan = planRide(fresh({ level, profile: weakIn('grammar') }, { verbsOnly: true }), date);
        expect(plan.every((g) => VERB_GAMES.includes(g)), `${level} ${plan}`).toBe(true);
      }
    }
    for (const level of ['A2', 'B1'] as Level[]) {
      for (const date of dates) {
        const plan = planRide(fresh({ level }, { verbsOnly: true, rideStops: 4 }), date);
        expect(plan.every((g) => VERB_GAMES.includes(g)), `${level} ${plan}`).toBe(true);
      }
    }
  });
  it('falls back to 3 stops for a setting out of range', () => {
    for (const n of [0, 1, 5, Number.NaN]) expect(planRide(fresh({}, { rideStops: n }), dates[0])).toHaveLength(3);
  });
});

describe('rideStatus and startRide', () => {
  it('previews the plan before the ride starts', () => {
    const s = fresh();
    const st = rideStatus(s);
    expect(st).toMatchObject({ plan: planRide(s), done: [], goal: 3, next: planRide(s)[0], met: false, terminusOpen: false, terminusDone: false, started: false });
  });
  it('saves the plan once, and keeps it when settings change later', () => {
    fresh();
    const plan = planRide(getState());
    expect(startRide()).toBe(plan[0]);
    expect(getState().play.ride).toEqual({ date: today(), plan, done: [], terminus: false });
    setState((s) => {
      s.settings.rideStops = 2;
      s.play.ride!.done.push(plan[0]);
    });
    expect(startRide()).toBe(plan[1]);
    expect(getState().play.ride!.plan).toEqual(plan);
    expect(rideStatus(getState()).goal).toBe(3);
  });
  it("starts a new line instead of yesterday's", () => {
    fresh({ play: { ...defaultState().play, ride: { date: '2020-01-01', plan: ['snap', 'forge', 'gap'], done: ['snap', 'forge', 'gap'], terminus: true } } });
    expect(rideStatus(getState())).toMatchObject({ done: [], met: false, terminusDone: false, started: false });
    startRide();
    expect(getState().play.ride!.date).toBe(today());
    expect(getState().play.ride!.done).toEqual([]);
  });
  it('tracks progress, the finished line and the terminus', () => {
    fresh();
    startRide();
    const plan = getState().play.ride!.plan;
    setState((s) => void s.play.ride!.done.push(plan[0], 'gender' as GameId));
    let st = rideStatus(getState());
    expect(st.done).toEqual([plan[0]]); // a game outside the plan doesn't count
    expect(st.next).toBe(plan[1]);
    setState((s) => void s.play.ride!.done.push(...plan.slice(1)));
    st = rideStatus(getState());
    expect(st).toMatchObject({ next: null, met: true, terminusOpen: true, terminusDone: false });
    setState((s) => void (s.play.ride!.terminus = true));
    expect(rideStatus(getState())).toMatchObject({ met: true, terminusOpen: false, terminusDone: true });
  });
  it('lets the kit book ride rounds against the same plan (the glob-loaded ride.ts)', () => {
    fresh({ profile: weakIn('grammar') });
    const plan = planRide(getState());
    const sum = finishRound(snapshot(plan[0], 'ride', 8));
    expect(getState().play.ride).toEqual({ date: today(), plan, done: [plan[0]], terminus: false });
    expect(sum.nextStop).toBe('forge');
  });
});

describe('dockAction', () => {
  it('offers to resume a half-played round first, in its own mode', () => {
    fresh();
    saveRound(snapshot('forge', 'ride', 4));
    const plan = planRide(getState());
    const a = dockAction(getState());
    expect(a.kind).toBe('resume');
    expect(a.route).toBe('play/forge/ride');
    expect(a.label).toBe('Resume · Verb Forge');
    expect(a.sub).toBe(`Stop ${plan.indexOf('forge') + 1}/3 · 4 of 8 done`);
    saveRound(snapshot('snap', 'free', 3, 12));
    expect(dockAction(getState())).toMatchObject({ kind: 'resume', route: 'play/snap', sub: 'Free play · 3 of 12 done' });
    saveRound(snapshot('sort', 'sprint', 9, 60));
    expect(dockAction(getState())).toMatchObject({ kind: 'resume', route: 'play/sort/sprint', sub: '⚡ Sprint · 9 answered, clock paused' });
    clearRound();
    saveRound(snapshot('snap', 'free', 0, 12)); // nothing answered yet: no resume
    expect(dockAction(getState()).kind).toBe('stop');
  });
  it('then the next stop, the terminus, Verb of the Day and free play, in that order', () => {
    fresh();
    const plan = planRide(getState());
    expect(dockAction(getState())).toMatchObject({ kind: 'stop', route: `play/${plan[0]}/ride`, label: `Stop 1/3 · ${GAMES.find((g) => g.id === plan[0])!.title}` });
    startRide();
    setState((s) => void s.play.ride!.done.push(plan[0]));
    expect(dockAction(getState())).toMatchObject({ kind: 'stop', route: 'play/forge/ride', label: 'Stop 2/3 · Verb Forge' });
    setState((s) => void s.play.ride!.done.push(...plan.slice(1)));
    expect(dockAction(getState())).toMatchObject({ kind: 'terminus', route: 'play/smash/terminus' });
    setState((s) => void (s.play.ride!.terminus = true));
    expect(dockAction(getState())).toMatchObject({ kind: 'six', route: 'play/six' });
    setState((s) => {
      s.play.daily = { date: today(), verbId: 'verb_likhtov', slots: [], marks: ['g', 'g', 'y', 'g', 'r', 'g'], tries: [1, 1, 2, 1, 2, 1], rated: [] };
    });
    expect(dockAction(getState())).toMatchObject({ kind: 'free', route: 'play' });
  });
  it('skips Verb of the Day at A1', () => {
    fresh({ level: 'A1' });
    startRide();
    setState((s) => {
      s.play.ride!.done = [...s.play.ride!.plan];
      s.play.ride!.terminus = true;
    });
    expect(dockAction(getState()).kind).toBe('free');
  });
});

describe('sixStatus', () => {
  it("reads today's grid only", () => {
    fresh();
    expect(sixStatus(getState())).toEqual({ marks: ['', '', '', '', '', ''], started: false, done: false, open: true });
    setState((s) => {
      s.play.daily = { date: '2020-01-01', verbId: 'verb_likhtov', slots: [], marks: ['g', 'g', 'g', 'g', 'g', 'g'], tries: [], rated: [] };
    });
    expect(sixStatus(getState()).started).toBe(false);
    setState((s) => {
      s.play.daily = { date: today(), verbId: 'verb_likhtov', slots: [], marks: ['g', 'y', '', '', '', ''], tries: [], rated: [] };
    });
    expect(sixStatus(getState())).toMatchObject({ marks: ['g', 'y', '', '', '', ''], started: true, done: false });
    expect(sixStatus(fresh({ level: 'A1' })).open).toBe(false);
  });
});

describe('gameRoute', () => {
  it('leaves the mode out for free play', () => {
    expect(gameRoute('snap', 'free')).toBe('play/snap');
    expect(gameRoute('smash', 'terminus')).toBe('play/smash/terminus');
  });
});

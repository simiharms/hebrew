import { beforeAll, describe, expect, it } from 'vitest';

// store.ts reads localStorage when it loads; give it an empty one.
beforeAll(() => {
  const mem = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  };
});

describe('backups', () => {
  it('rejects files that are not backups, in German', async () => {
    const { parseBackup } = await import('../src/lib/store.ts');
    expect(() => parseBackup('not json')).toThrow('keine Nordlys-Sicherung');
    expect(() => parseBackup('{"hello": 1}')).toThrow('keine Nordlys-Sicherung');
  });
  it('repairs fields of the wrong type instead of crashing later', async () => {
    const { parseBackup, defaultState } = await import('../src/lib/store.ts');
    const broken = { ...defaultState(), mistakes: null, days: {}, settings: { rate: 'fast', newPerDay: 12 } };
    const { state } = parseBackup(JSON.stringify({ app: 'nordlys', exportedAt: '2026-10-30T10:00:00Z', state: broken }));
    expect(Array.isArray(state.mistakes)).toBe(true);
    expect(Array.isArray(state.days)).toBe(true);
    expect(state.settings.rate).toBe(0.9);
    expect(state.settings.newPerDay).toBe(12);
  });
});

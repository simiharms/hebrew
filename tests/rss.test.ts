import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS helper shared with the GitHub Actions job
import { clip, mergeItems, parseRss } from '../scripts/rss.mjs';
import xml from './fixtures/sample-rss.xml?raw';

describe('rss parsing', () => {
  it('parses Hebrew items, strips HTML and entities, skips non-Hebrew', () => {
    const items = parseRss(xml, 'ynet');
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('הבנק המרכזי השאיר את הריבית ללא שינוי');
    expect(items[0].summary).toBe('ההחלטה התקבלה פה אחד. לדברי הנגיד, האינפלציה ירדה & הצמיחה נמשכת.');
    expect(items[0].published).toBe('2026-10-21T13:05:00.000Z');
  });
  it('dedupes and drops old items', () => {
    const items = parseRss(xml, 'ynet');
    const merged = mergeItems([items], { now: Date.parse('2026-10-22T08:00:00Z') });
    expect(merged).toHaveLength(1);
    expect(mergeItems([items], { now: Date.parse('2026-10-30T08:00:00Z') })).toHaveLength(0);
  });
  it('splits Google News source names', () => {
    const g = parseRss('<rss><item><title>כותרת חדשה - ynet</title><link>https://n</link></item></rss>', 'Google News');
    expect(g[0]).toMatchObject({ title: 'כותרת חדשה', source: 'ynet', summary: '' });
  });
  it('clips long summaries at a sentence end', () => {
    expect(clip('א'.repeat(200) + '. ' + 'ב'.repeat(200), 320)).toBe('א'.repeat(200) + '.');
  });
});

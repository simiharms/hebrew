// Daily job (GitHub Actions): fetch Hebrew news RSS feeds into a JSON file the
// app reads. Keeps the previous file if every feed fails.
// Usage: node scripts/fetch-news.mjs public/news.json
import { readFileSync, writeFileSync } from 'node:fs';
import { mergeItems, parseRss } from './rss.mjs';

const out = process.argv[2] ?? 'public/news.json';

const FEEDS = [
  { name: 'ynet', url: 'https://www.ynet.co.il/Integration/StoryRss2.xml' },
  { name: 'ynet כלכלה', url: 'https://www.ynet.co.il/Integration/StoryRss6.xml' },
  { name: 'וואלה', url: 'https://rss.walla.co.il/feed/1' },
  { name: 'מעריב', url: 'https://www.maariv.co.il/Rss/RssChadashot' },
  { name: 'גלובס', url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585' },
  { name: 'דבר', url: 'https://www.davar1.co.il/feed/' },
  { name: 'גיקטיים', url: 'https://www.geektime.co.il/feed/' },
  { name: 'Google News', url: 'https://news.google.com/rss?hl=he&gl=IL&ceid=IL:he' },
];

async function fetchFeed(feed) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(feed.url, { signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 (Shoresh Hebrew learning app; RSS reader)' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = parseRss(await res.text(), feed.name);
    console.log(`${feed.name}: ${items.length} items`);
    return items;
  } catch (e) {
    console.log(`${feed.name}: failed (${e.message})`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

const lists = await Promise.all(FEEDS.map(fetchFeed));
const items = mergeItems(lists);
if (!items.length) {
  console.log('No items fetched; keeping the previous file.');
  try {
    readFileSync(out);
  } catch {
    writeFileSync(out, JSON.stringify({ updated: null, items: [] }));
  }
  process.exit(0);
}
writeFileSync(out, JSON.stringify({ updated: new Date().toISOString(), items }, null, 1));
console.log(`Wrote ${items.length} headlines to ${out}`);

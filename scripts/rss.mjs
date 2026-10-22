// Minimal RSS parsing for the daily headlines job (no dependencies).

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  if (!m) return '';
  return m[1].replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '');
}

export function cleanText(s) {
  return decodeEntities(decodeEntities(s))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Shorten to at most `max` characters, preferring a sentence end. */
export function clip(s, max = 320) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return end > max * 0.5 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…';
}

const HEBREW = /[א-ת]/;

export function parseRss(xml, sourceName) {
  const items = [];
  for (const block of xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []) {
    let title = cleanText(tag(block, 'title'));
    let source = sourceName;
    // Google News appends " - Source" to each title.
    const dash = title.lastIndexOf(' - ');
    if (sourceName === 'Google News' && dash > 0) {
      source = title.slice(dash + 3).trim();
      title = title.slice(0, dash).trim();
    }
    const summary = sourceName === 'Google News' ? '' : clip(cleanText(tag(block, 'description')));
    const link = cleanText(tag(block, 'link')) || (block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '');
    const date = Date.parse(cleanText(tag(block, 'pubDate')) || cleanText(tag(block, 'dc:date')));
    if (!title || !HEBREW.test(title)) continue;
    items.push({ title, summary: summary === title ? '' : summary, link, source, published: Number.isNaN(date) ? null : new Date(date).toISOString() });
  }
  return items;
}

export function mergeItems(lists, { maxAgeHours = 48, max = 80, now = Date.now() } = {}) {
  const seen = new Set();
  const out = [];
  for (const it of lists.flat()) {
    const key = it.title.replace(/[^א-ת]/g, '').slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    if (it.published && now - Date.parse(it.published) > maxAgeHours * 3600_000) continue;
    out.push(it);
  }
  return out.sort((a, b) => (b.published ?? '').localeCompare(a.published ?? '')).slice(0, max);
}

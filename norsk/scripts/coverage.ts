// Lists the words in the lesson texts that tap-to-translate can't explain
// (not in the vocabulary, the glossaries or the Wörterkiste, with any form).
// Run: npx vite-node scripts/coverage.ts [lesson numbers…]
import { lessons, lookup } from '../src/lib/content.ts';
import { splitWords } from '../src/lib/norsk.ts';

const only = process.argv.slice(2).map(Number).filter((n) => n > 0);
// Names and very common words that need no entry.
const SKIP = new Set(['susanne', 'matthias', 'anna', 'torunn', 'elin', 'mads', 'kari', 'per', 'ola', 'ingrid', 'bamse', 'jonas', 'arne', 'inga', 'erik', 'nygård', 'haugen', 'steiner', 'becker', 'lindqvist', 'kjær', 'eira', 'hansen',
  // names that only ever open a sentence
  'champs-élysées', 'frammuseet', 'galdhøpiggen', 'matterhorn', 'dinner', 'musevisa', 'bergenstoget', 'undsets', 'kristin', 'ntnu', 'margrethe', 'hedda']);

// Words written with a capital inside a sentence somewhere: names.
const names = new Set<string>();
for (const L of lessons)
  for (const t of [L.text, ...L.extra])
    for (const line of t.lines) {
      let start = true;
      for (const p of splitWords(line.no)) {
        if (!p.isWord) {
          if (/[.!?:«»"–—]/.test(p.w)) start = true;
          continue;
        }
        if (!start && /^[A-ZÆØÅ]/.test(p.w)) names.add(p.w.toLowerCase());
        start = false;
      }
    }

let total = 0;
for (const L of lessons) {
  if (only.length && !only.includes(L.n)) continue;
  const missing = new Map<string, string>();
  for (const t of [L.text, ...L.extra]) {
    for (const line of t.lines) {
      let start = true;
      for (const p of splitWords(line.no)) {
        if (!p.isWord) {
          if (/[.!?:«»"–—]/.test(p.w)) start = true;
          continue;
        }
        const atStart = start;
        start = false;
        if (/^[\d.,]+$/.test(p.w)) continue;
        const k = p.w.toLowerCase();
        if (SKIP.has(k) || missing.has(k)) continue;
        const r = lookup(p.w, atStart, line.no);
        // A capitalised word at the start of a sentence only counts as a name if it is one elsewhere too.
        const name = r.name && (!atStart || names.has(k));
        if (!r.entries.length && !r.parts && !name) missing.set(k, t.id);
      }
    }
  }
  total += missing.size;
  if (missing.size) console.log(`L${L.n} (${missing.size}): ${[...missing].map(([w, id]) => `${w} [${id}]`).join(', ')}`);
}
console.log(`\n${total} words without an entry.`);

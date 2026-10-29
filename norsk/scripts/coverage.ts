// Lists the words in the lesson texts that tap-to-translate can't explain
// (not in the vocabulary, the glossaries or the Wörterkiste, with any form).
// Run: npx vite-node scripts/coverage.ts [lesson numbers…]
import { lessons, lookup } from '../src/lib/content.ts';
import { splitWords } from '../src/lib/norsk.ts';

const only = process.argv.slice(2).map(Number).filter((n) => n > 0);
// Names and very common words that need no entry.
const SKIP = new Set(['susanne', 'matthias', 'anna', 'torunn', 'elin', 'mads', 'kari', 'per', 'ola', 'ingrid', 'bamse', 'jonas', 'arne', 'inga', 'erik', 'nygård', 'haugen', 'steiner', 'becker', 'lindqvist', 'kjær', 'eira', 'hansen']);

let total = 0;
for (const L of lessons) {
  if (only.length && !only.includes(L.n)) continue;
  const missing = new Map<string, string>();
  for (const t of [L.text, ...L.extra]) {
    for (const line of t.lines) {
      for (const p of splitWords(line.no)) {
        if (!p.isWord || /^\d/.test(p.w)) continue;
        const k = p.w.toLowerCase();
        if (SKIP.has(k) || missing.has(k)) continue;
        const r = lookup(p.w);
        if (!r.entries.length && !r.parts && !r.name) missing.set(k, t.id);
      }
    }
  }
  total += missing.size;
  if (missing.size) console.log(`L${L.n} (${missing.size}): ${[...missing].map(([w, id]) => `${w} [${id}]`).join(', ')}`);
}
console.log(`\n${total} words without an entry.`);

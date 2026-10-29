// Removes words that an earlier lesson already lists (same spelling and part
// of speech), keeping the first; forms the later entry adds (comparison,
// more variants) move to the first one. Run: node scripts/dedupe-vocab.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const DIR = 'src/content';
const files = readdirSync(DIR)
  .filter((f) => /^vocab-\d\d\.json$/.test(f))
  .sort();
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const data = Object.fromEntries(files.map((f) => [f, JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'))]));
const first = new Map();
let removed = 0;
for (const f of files) {
  data[f] = data[f].filter((w) => {
    const k = `${norm(w.no)}|${w.pos}`;
    const keep = first.get(k);
    if (!keep) {
      first.set(k, w);
      return true;
    }
    if (w.forms && (keep.forms?.length ?? 0) < w.forms.length) keep.forms = w.forms;
    if (w.vf && !keep.vf) keep.vf = w.vf;
    if (w.alt) keep.alt = [...new Set([...(keep.alt ?? []), ...w.alt])];
    removed++;
    return false;
  });
}
for (const f of files) writeFileSync(`${DIR}/${f}`, JSON.stringify(data[f], null, 2) + '\n');
console.log(`removed ${removed} duplicate words`);
for (const f of files) console.log(`${f}: ${data[f].length}`);

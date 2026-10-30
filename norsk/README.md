# Nordlys – Norwegisch zum Lehrbuch »Et år i Norge«

A Norwegian course app for German speakers that follows the textbook **»Et år i Norge – Norwegisch für
Deutschsprachige«** (Randi Rosenvinge Schirmer, Hempen Verlag) lesson by lesson. It's a present, so the
whole app speaks German: explanations, translations, buttons.

Like Shoresh (the Hebrew app in the parent folder), it runs entirely on the device: no account, no server,
no AI service, works offline after the first visit, progress stays on the phone (with a backup file).

## What's inside

| | |
| --- | --- |
| **23 lessons, like the book** | Same titles, places and grammar in the same order, A1 (1–5) → A2 (6–10) → B1 (11–16) → B2 (17–23): a year in Norway from the language course in Oslo to Bergen, Tromsø, Hurtigruten, Christmas in the polar night, Easter at the cabin, the 17th of May and midsummer. Each lesson has the steps below and a lesson test (70 % moves you on). |
| **Text** | 46 new texts (a lesson text and a Landeskunde text per lesson, about 14,000 words) on the book's themes, read aloud by the device's Norwegian voice (all, line by line, or slowly). Tap any word: you hear it and see its meaning and forms (bilen → bil, gikk → gå), the phrase it belongs to in that sentence (i tide, har lyst til), compounds split into parts, and who a person in the story is. German translation per line or for the whole text. |
| **Wörter** | 2,131 words (372 verbs) introduced lesson by lesson, as flash cards with spaced repetition (FSRS): flip and rate, or type the answer. Nouns with en/ei/et and all four forms, verbs with all tenses, adjectives with their endings, an example sentence each. |
| **Grammatik** | 83 grammar topics in the book's order, explained in German, contrastively (what's like German, what isn't), with tables and 882 typed gap-fill drills. |
| **Übungen** | About 800 exercises on the texts: true/false, open questions answered in Norwegian, find-the-word, translate German → Norwegian (word-by-word comparison), gap-filled summary. |
| **Wörterkiste** | 437 useful phrases on the lessons' themes, also as cards. |
| **Landeskunde** | Short texts on Norwegian culture, regions and history (Troll, Bergen og Vestlandet, Hurtigruta, jul, påskekrim, 17. mai, samene …). |
| **Hören, Schreiben** | Listen without the text, dictation, and a writing task with checklist and model text. |
| **Verben** | All verbs with presens, preteritum, perfektum, imperativ; a trainer that only asks the tenses the learner has met. |
| **Zahlen und Uhrzeit** | Numbers by ear and in words, clock times (halv tre = 2:30), dates (syttende mai), years. |
| **Aussprache** | A pronunciation guide with audio examples. |
| **For an older learner** | Large text by default (three sizes), æ ø å keys under every input, dark mode, no time pressure. |

All texts and exercises were written for this app; nothing is copied from the book (the app has no access
to it). The lesson map – titles, places and grammar per lesson – was reconstructed from the book's table of
contents as far as it could be found online; for lessons 11, 13, 14 and 23 the titles aren't known and the
themes were chosen to fit the year's story, and editions differ slightly (photos of her book's
Inhaltsverzeichnis would let `src/lib/plan.ts` match it exactly). The content was written, proofread and
fact-checked by AI editors, not by a Norwegian teacher.

## Give it to someone

1. **Personal message (optional):** put a dedication in `src/gift.ts`, e.g.
   `export const DEDICATION = 'Für Mama – lykke til med norsken! ❤️';`. It appears on the welcome screen.
2. **Publish:** merging into `main` runs the existing GitHub Pages workflow, which now builds Nordlys too
   and publishes it at **`https://simiharms.github.io/hebrew/norsk/`** (Pages must be enabled for the
   repository: Settings → Pages → Source: GitHub Actions; see the main README).
3. **On her iPhone or iPad:** open the address in **Safari** → Share → **Add to Home Screen**. Open it once
   while online; after that it works offline.
4. **Norwegian voice (once):** Settings → Accessibility → Spoken Content → Voices → Norwegian → **Nora**
   (download the *Enhanced* version). On a Mac: System Settings → Accessibility → Spoken Content.
5. **Backups:** progress lives on the device. Einstellungen → Sicherung → *Sicherung speichern* saves a file
   (to Files / iCloud Drive), which also moves progress to another device.

## Develop

```bash
cd norsk
npm install
npm run dev          # dev server
npm test             # unit tests (answer checking, numbers, backups)
npm run validate     # checks all content against the schema and the lesson plan
npx vite-node scripts/coverage.ts   # words in the texts that tap-to-translate can't explain (should be 0)
node scripts/dedupe-vocab.mjs       # drops words a later lesson repeats
npm run build        # validate + typecheck + production build into dist/
npm run e2e          # drives the built app through every lesson and the main flows in headless Chromium (phone size)
node scripts/icons.mjs   # re-renders the app icons
```

Content lives in `src/content/` (`lesson-NN.json`, `vocab-NN.json`, `aussprache.json`), typed by
`src/content/types.ts`. The lesson plan (book titles, places, grammar ids) is `src/lib/plan.ts`; the
authoring guide with the story bible and norms is `docs/AUTHORING.md`, the proofreading checklist
`docs/PROOFREADING.md`.

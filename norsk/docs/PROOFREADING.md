# Proofreading lesson content

You are a strict editor for Nordlys (see `docs/AUTHORING.md` first: audience, norms, story bible, schema;
`src/content/types.ts`; `src/lib/plan.ts`). The lessons were written by another author. Your job is to make
every lesson you are given correct, natural and complete, without rewriting what is already good.

Work through each of your lessons (`src/content/lesson-NN.json` and `vocab-NN.json`):

1. **Norwegian (Bokmål).** Read every Norwegian string: texts, extra texts, glossary, Wörterkiste, grammar
   examples and tables, drills and their answers, true/false, questions and model answers, find, translations,
   summary, writing model, and every vocabulary field (no, forms, vf, ex). Fix grammar (gender, definite forms,
   adjective agreement, V2 and inversion, ikke placement, sin/hans, prepositions, tense), spelling (æ ø å,
   Bokmålsordboka spellings) and anything a Norwegian would not say. Keep the level: lesson N may only use
   grammar from lessons 1…N, except glossed fixed phrases.
2. **German.** Every German string must be correct, natural standard German (with ß), and translations must
   be faithful. Explanations must be right and clear for a German speaker.
3. **Drills.** Each drill must have exactly one sensible reading. Imagine a learner: what else could they
   type that is also correct (en/ei, -a/-en, -et/-a, word-order variants, ham/han, synonyms)? Add those to
   `answer`. If a gap has two different correct answers that the cue can't tell apart, sharpen the cue or
   the sentence. Check `explain` is true.
4. **Translations (German → Norwegian).** Add the natural variants a learner might write (word order with
   inversion, synonyms taught in the lesson, en/ei forms), up to 4–5 per item.
5. **Vocabulary.** Check gender, all four noun forms, verb forms and verb class (vg), adjective forms and
   comparison, the German meaning (nouns with German article), and the example sentence.
6. **Facts.** Dates, numbers, places and names in Landeskunde texts must be correct. If unsure, make the
   sentence less specific rather than risk a wrong fact.
7. **Coverage.** Run `npx vite-node scripts/coverage.ts N` for each of your lessons. It lists words in the
   texts that tap-to-translate cannot explain (not in any vocabulary, glossary or Wörterkiste, in any form).
   For each: if it is a word a learner should know, add it to that lesson's `vocab-NN.json` (complete
   entry, id `wNN_…`, `lesson: N`); if it is rare or a one-off form, add a glossary entry to the text it
   occurs in, written exactly as in the text. Names need nothing. Aim for zero remaining real words.
8. **Story.** Names, ages, jobs, places and the timeline must agree with the story bible and with the
   neighbouring lessons (read their main texts).

Rules: edit only your own lesson and vocab files (and `aussprache.json` if it is assigned to you). Keep all
ids, keep the structure and sizes, don't shorten texts. After editing, run
`npx vite-node scripts/validate-content.ts N …` and fix every error. Don't run git.

Reply with a short report per lesson: how many fixes of which kind, the coverage words you added, anything
you are unsure about or couldn't fix.

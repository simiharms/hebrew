# Writing lesson content for Nordlys

Nordlys is a Norwegian course app for a German-speaking learner (a mother who studies Norwegian at
university with the textbook **»Et år i Norge – Norwegisch für Deutschsprachige«** by Randi Rosenvinge
Schirmer, Hempen Verlag). The app follows the book lesson by lesson: same 23 lessons, same titles, same
places, same grammar in the same order, levels A1 (L1–5), A2 (L6–10), B1 (L11–16), B2 (L17–23).

**Nothing may be copied from the book.** We don't have it. Every text, sentence and exercise is written
new for this app. Only the lesson titles, places and grammar topics follow the book (`src/lib/plan.ts`).

The learner reads the app in **German** (all explanations, translations, instructions) and learns
**Norwegian Bokmål**. Address the learner with **du** in German ("Du lernst …", "Achte auf …").

## Files

For lesson N (two digits, e.g. `03`):

- `src/content/lesson-NN.json`: one `Lesson` object (schema in `src/content/types.ts`).
- `src/content/vocab-NN.json`: an array of `Word` objects: the lesson's vocabulary.

Check your work with `cd /home/user/hebrew/norsk && npx vite-node scripts/validate-content.ts N` (several
lesson numbers allowed). Fix every error. Look at every warning too; most point at real mistakes.

## The plan

`src/lib/plan.ts` gives, per lesson: level, book title, place, month, the story of the text, the titles
of the extra (Landeskunde) texts, the Wörterkiste title and the grammar topics with ids and points to cover.
Use **exactly** those titles and grammar ids, in that order.

## Story bible (keep it consistent across lessons)

The year runs from August to June.

- **Susanne Becker** (24, f) from Freiburg im Breisgau; studies Skandinavistik; open, curious, a bit chaotic,
  loves baking and hiking. Language course in Oslo (Aug–Oct), rents a room (hybel) in the Nygårds' house in
  Sagene, Oslo; from November exchange semester at UiT in Tromsø, shares a flat with Inga.
- **Matthias Steiner** (26, m) from Bern, Switzerland; civil engineer; calm, punctual, dry humour, a bit
  pedantic. Language course in Oslo, then (from L10) an internship at a small engineering firm in Bergen;
  lives in an old wooden house in Sandviken. Quietly in love with Susanne; they become a couple in the end
  (L22–23), but keep the romance light.
- **Torunn Haugen** (f, ~45): the teacher of the language course in Oslo.
- **Elin Lindqvist** (f, 23, Swedish, Gothenburg) and **Mads Kjær** (m, 25, Danish, Aarhus): classmates.
- **Familien Nygård**, Sagene, Oslo: **Kari** (52, f, teacher at a lower secondary school), **Per** (55, m,
  works for Oslo kommune), **Anna** (25, f, medical student, Susanne's friend; birthday in L6; hospital
  internship in Trondheim in L19), **Ola** (16, m, school, football, gaming), **bestemor Ingrid** (80, f,
  Per's mother, from Lillehammer, tells troll stories), the dog **Bamse**. They have a **hytte** in
  Gudbrandsdalen (L20).
- **Jonas** (26, m): Anna's boyfriend, jealous in L7.
- **Onkel Arne** (60, m): Kari's brother from Ålesund, provocative dinner guest in L8.
- **Inga Eira** (23, f): Sámi from Kautokeino, studies biology in Tromsø, Susanne's flatmate (L16–23).
- **Erik Hansen** (28, m): from Svolvær, works on Hurtigruta; charming and fickle (L17, mentioned L19, L21).
- Fictional firms and people only (no real private persons). Public places, institutions and public
  figures (Ibsen, Munch, Vigeland, King Harald V and Queen Sonja) are fine; keep facts uncontroversial and
  correct, and avoid anything time-sensitive.

## Norwegian norms

- Bokmål, moderate and standard, as taught to foreigners. Feminine nouns with **ei** and **-a** in the definite
  singular (ei bok – boka, ei jente – jenta, ei hytte – hytta); in answer lists always also accept the en/-en form
  (`["boka", "boken"]`). Class-1 verbs in **-et** (snakket, kastet), accept -a in answers.
- Object pronoun **ham** (accept "han" in answers where it is the object). **de/dem** correctly.
- Write numbers in words in texts for A1–A2 when they are being taught (prices, times), digits otherwise.
- Use only grammar the learner has met (lesson N may use everything from lessons 1…N). Before lesson 6 the
  texts are in the **present tense** (plus modal verbs from lesson 4). Preteritum from L6, perfektum from
  L7, plusquamperfektum and future from L11, passive from L18. Rare exceptions only as fixed phrases that the
  glossary explains.
- Natural, idiomatic Norwegian that a Norwegian would actually say; vary sentence length by level.
- Punctuation: Norwegian quotation marks «…» in texts; dialogues as separate lines with speakers (no dashes).

## German norms

- Standard German (Germany/Switzerland both understand "ß"; use normal German spelling with ß). Clear,
  friendly, concise. Explain grammar **contrastively**: what is like German, what is different, typical
  mistakes of German speakers (verb never at the end of a subordinate clause, no case endings, "halv tre" =
  halb drei, false friends: rolig, fersk, bra, gift, glad, lur …).
- Translations in `de` fields are natural German, faithful to the Norwegian.

## What a lesson contains (sizes by level)

| | A1 (1–5) | A2 (6–10) | B1 (11–16) | B2 (17–23) |
| --- | --- | --- | --- | --- |
| main text, words | 120–220 | 220–350 | 350–500 | 450–650 |
| extra text(s), words | 80–150 | 120–220 | 200–300 | 250–400 |
| vocabulary (vocab-NN.json) | 70–100 | 90–110 | 100–120 | 100–120 |
| Wörterkiste phrases | 12–18 | 14–20 | 15–22 | 15–22 |
| drills per grammar topic | 8–10 | 8–10 | 8–12 | 10–12 |
| true/false, questions, find | 6, 4, 6 | 7, 5, 6–8 | 8, 5–6, 8 | 8, 6, 8 |
| translations, summary gaps | 6–8, 4–5 | 8, 5 | 8–10, 6 | 10, 6 |

### `text` (the lesson text) and `extra` (Landeskunde etc.)

- `id`: main text `"tNN"`, extras `"xNNa"`, `"xNNb"`.
- `kind`: `dialog` (with `speakers`, every line has `s`), `prose`, `letter`, `email`, `song`, `info`.
- `intro`: one or two German sentences setting the scene.
- `lines`: dialogue = one turn per line (keep turns under ~200 characters, they are read aloud one by one);
  prose = one paragraph per line (2–5 sentences). Every line has a faithful German translation `de`.
- `glossary`: 15–40 entries for words and phrases a learner at this point may not know, written **exactly as
  they appear in the text** (inflected forms, multi-word phrases), with the German meaning in context. The
  learner can tap any word; the glossary and the vocabulary together should cover the whole text.
- The extra text(s) carry the Landeskunde titles from the plan; facts must be correct.

### `wk` – the Wörterkiste

The book's Wörterkiste is a box of useful phrases on the lesson theme. `title` = plan's `wk`, `titleDe`
German, `phrases`: idiomatic phrases and short sentences (`no`, `de`, optional `note` in German).

### `grammar`

One `GrammarTopic` per plan topic, same ids, same order. `title` German (from the plan), `titleNo` optional
Norwegian term (e.g. "personlige pronomen"), `summary` one German line, `sections` 2–4 with `h` (heading),
`body` (German; Norwegian examples in **bold**; bullet lines start with "• "; blank line = new paragraph),
optional `table` (array of rows, first row = header, all rows equally long). Cover every point in the plan.
`drills`: gap-fill sentences, exactly one `___` per prompt; the cue in parentheses at the END of the prompt
when the learner needs one, e.g. `"Hun ___ i Oslo. (bo, presens)"`. `answer` lists every correct filler (first
is canonical); `de` is the German meaning of the full sentence; `hint` (German, optional); `explain` (German,
short: why). Drills only test the topic, are unambiguous, and use the lesson's vocabulary.

### Exercises on the main text

- `tf`: statements about the main text (mix of true and false; `why` in German quotes or paraphrases the text).
- `questions`: open questions in Norwegian, a short model `answer` in Norwegian (one sentence), German
  `qDe`/`answerDe`, `keywords`: 1–3 groups of key words, each group listing variants (inflected forms,
  synonyms) – **each group must occur in the model answer** (the validator checks).
- `find`: German meaning (`de`) → Norwegian word/phrase exactly as in the main text (`answer`).
- `translate`: German sentences (built from the lesson's words and grammar) → Norwegian; list 1–4 natural
  versions in `no` (word-order variants, en/ei forms). Optional German `hint`.
- `summary`: a short summary of the text as gap-fill drills (one gap each, in story order).
- `dictation`: 2–4 indexes of `text.lines` that are good for dictation (short, clear, under 160 characters).
- `writing`: German `prompt` (a realistic task: a message, an e-mail, a diary entry), `minWords` (A1 25–40,
  A2 50–70, B1 80–110, B2 120–160), `useWords` (3–6 Norwegian words), `checklist` (2–4 items: German label +
  Norwegian keywords that show the item is done; each must occur in the model), `model` (Norwegian model
  answer), `modelDe`.
- `goals`: 3–5 German lines "Du lernst …" / "Du kannst …".

### `vocab-NN.json`

All important new words of the lesson (from the texts, Wörterkiste, grammar), in learning order. Don't repeat
very basic words that earlier lessons surely introduced (in doubt, include it – duplicates are removed
later, keeping the first lesson). Fields:

- `id`: `"wNN_<ascii-word>"` unique (`"w03_brunost"`, `"w03_gaa"` for gå: æ→ae, ø→o, å→aa).
- `no`: dictionary form without article or å. `de`: main German meaning (short, as on a flash card: "das Auto",
  "sprechen", "groß"; nouns WITH German article). `deAlt`: other accepted German meanings (optional).
- `pos`: noun, verb, adj, adv, prep, conj, pron, num, phrase, interj, name.
- nouns: `gender` (m/f/n) and `forms` [indefinite sg, definite sg, indefinite pl, definite pl] without article,
  e.g. `["bil","bilen","biler","bilene"]`, `["bok","boka","bøker","bøkene"]`, `["hus","huset","hus","husa/husene"]`,
  uncountable: `["melk","melka"]`.
- verbs: `vf` [presens, preteritum, perfektum participle, imperativ], e.g. `["snakker","snakket","snakket","snakk"]`,
  `["går","gikk","gått","gå"]`, `["kan","kunne","kunnet",""]`; `vg`: `"1"` (-et), `"2"` (-te), `"3"` (-de),
  `"4"` (-dde), `"sterk"`, `"uregelm"` (irregular weak like selge, gjøre, si), `"modal"`. Reflexive and particle
  verbs keep their pronoun/particle: `no: "glede seg"`, `vf: ["gleder seg","gledet seg","gledet seg","gled deg"]`.
- adjectives: `forms` [m/f, n, pl/definite] and, from the lesson that teaches comparison on (L12), optionally
  comparative and superlative: `["stor","stort","store","større","størst"]`.
- `ex`: an example sentence (`no`, `de`) that uses the word – simple, natural, fitting the story where possible.
- `note` (German, optional): a short tip (false friend, irregular plural, pronunciation, usage).
- `wk: true` for words that belong to the Wörterkiste theme.
- `lesson`: N.

## Skeleton (shape only)

```json
{
  "n": 1, "level": "A1", "title": "På språkkurs i Oslo", "titleDe": "Im Sprachkurs in Oslo", "place": "Oslo, Blindern",
  "goals": ["Du kannst dich vorstellen: Name, Herkunft, Wohnort.", "…"],
  "text": { "id": "t01", "title": "På språkkurs i Oslo", "titleDe": "…", "kind": "dialog", "intro": "…",
    "speakers": { "t": { "name": "Torunn", "gender": "f" }, "s": { "name": "Susanne", "gender": "f" } },
    "lines": [{ "s": "t", "no": "Hei, og velkommen til kurset!", "de": "Hallo und willkommen zum Kurs!" }],
    "glossary": [{ "no": "velkommen", "de": "willkommen" }] },
  "extra": [{ "id": "x01a", "title": "Hva kan man gjøre i Norge?", "titleDe": "…", "kind": "info", "lines": [{ "no": "…", "de": "…" }], "glossary": [] }],
  "wk": { "title": "Hvem er du?", "titleDe": "Wer bist du?", "phrases": [{ "no": "Hva heter du?", "de": "Wie heißt du?" }] },
  "grammar": [{ "id": "g01_pronomen", "title": "Personalpronomen (Subjektform)", "titleNo": "personlige pronomen",
    "summary": "…", "sections": [{ "h": "…", "body": "…", "table": [["Norwegisch", "Deutsch"], ["**jeg**", "ich"]] }],
    "drills": [{ "prompt": "___ heter Matthias. (er)", "de": "Er heißt Matthias.", "answer": ["Han"], "explain": "…" }] }],
  "tf": [{ "s": "Susanne kommer fra Sveits.", "de": "Susanne kommt aus der Schweiz.", "a": false, "why": "Sie kommt aus Freiburg in Deutschland." }],
  "questions": [{ "q": "Hvor bor Susanne?", "qDe": "Wo wohnt Susanne?", "answer": "Hun bor på Sagene i Oslo.", "answerDe": "…", "keywords": [["Sagene"], ["bor", "bo"]] }],
  "find": [{ "de": "willkommen", "answer": ["velkommen"] }],
  "translate": [{ "de": "Ich komme aus der Schweiz.", "no": ["Jeg kommer fra Sveits."] }],
  "summary": [{ "prompt": "Susanne ___ fra Freiburg.", "de": "Susanne kommt aus Freiburg.", "answer": ["kommer"] }],
  "dictation": [1, 4],
  "writing": { "prompt": "…", "minWords": 30, "useWords": ["heter", "kommer fra"], "checklist": [{ "de": "Name", "keywords": ["heter"] }], "model": "…", "modelDe": "…" }
}
```

## Quality bar

Before you finish, reread every Norwegian sentence as a careful Norwegian teacher would (gender, definite forms,
adjective agreement, V2/inversion, ikke placement, sin/hans, prepositions, spelling of æ ø å) and every German
sentence as a German editor. Make sure every drill has one clear answer and every answer list is complete.

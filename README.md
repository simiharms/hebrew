# Shoresh — Hebrew from A1 to C1

A free Hebrew course that runs on your iPhone and your Mac. It goes from the alphabet to formal and literary
Hebrew, with every answer typed in Hebrew. There are card decks, a verbs-only mode for people who find verbs
hard, and reading and listening at every level.

It runs entirely on your device. There's no account, no subscription, no server and no AI service. Progress
stays on the device, and you can export a backup.

## What's inside

| | |
| --- | --- |
| **Course** | **36 units from A1 to C1**, in the order of a university course book such as Etzion's *Routledge Introductory Course in Modern Hebrew*: letters and sounds → pronouns → gender and plural → present tense → יש/אין/של → prepositions → numbers → infinitive → past → questions → future → imperative → comparison → feelings with ל → roots and binyanim → … → passive → formal syntax → pu'al and huf'al → hedging → idioms → argument. Each unit has a grammar lesson, a text, a scene, verbs, often a card deck and a writing task, then a unit check. |
| **Placement** | A skills check (about 10–15 minutes) rates vocabulary, verbs, grammar, listening, reading and writing from A1 to C1. It places you in the course and tailors the daily plan. Every exercise then keeps a live profile, including weak spots by grammar topic, binyan and tense. |
| **Reading** | **72 texts at all seven levels**: signs, menus, chats, emails, recipes, reviews, stories, articles, essays, a court ruling, an academic abstract and literary prose. Tap any word for its meaning, root, prefixes and dictionary form. Each text has **true/false**, **open questions answered in Hebrew**, **find the word in the text**, **complete the summary** and a **writing task**. |
| **Listening** | **About 57 scenes at all levels**: the ulpan, the shuk, the pharmacy, phone calls, meetings, a tour guide, radio interviews, a court hearing and a comedy podcast. Listen without the text, answer **true/false** and open questions, read the transcript, then do a dictation. **Listening practice** gives short sentences at any level: type what you hear, or pick what it means. |
| **Card decks** | Flip cards with spaced repetition (rate Again / Hard / Good / Easy, or press 1–4 on a Mac). Decks: **the alphabet**, words by topic (40+ topics), words by level (A1–C1), verbs by binyan, essential verbs, irregular verbs, verbs + preposition, plus your ⭐ starred cards and the cards you keep forgetting. Word decks can also be practised by typing. |
| **Verbs** | **217 verbs** with full present, past, future and imperative tables, transliteration, notes on what's tricky, and 3 example sentences each. Seven kinds of practice: **conjugate**, **use it in a sentence**, **recognise the form** (which tense and person is נכתוב?), **listen and type**, **back to the infinitive**, **which binyan?**, and the **table challenge** (fill in a whole tense). |
| **Verbs-only mode** | One switch on Today (or ⚙️ or the Verbs page) turns the daily plan into verb practice. You get reviews, new verbs as flash cards, sentences, recognition, listening, a table challenge on your weakest verb-tense, and the grammar lesson for your weakest binyan. |
| **Words** | About **1,500 words and phrases** from A1 to C1 (business, everyday life, news, academic, legal, idioms), with typed reviews. A root explorer groups word families. |
| **Grammar** | **41 lessons** with **570+ typed drills**, from the alphabet to pu'al and huf'al, hedging and rhetoric. |
| **Writing** | About 20 realistic tasks, from introducing yourself in the ulpan WhatsApp group to a formal complaint, with a live checklist and a model answer. |
| **Numbers** | Prices, phone numbers, times and years by ear, plus writing numbers with the right gender. |

All texts, scenes and exercises were written for this app; nothing is copied from a book. Speech uses the
device's built-in Hebrew voice.

## Put it on your iPhone (free)

An iPhone only installs web apps that come from an `https://` address. So the app is put on a free web
address once; then you add it to the Home Screen and it **runs on the phone, offline**. It needs no
internet after that and gets no updates unless you publish new code.

### 1. Merge the app into `main`

On GitHub, open the pull request from `claude/hebrew-learning-pwa` and click **Merge pull request** →
**Confirm merge**.

### 2. Publish it, choosing one option

**Option A: GitHub Pages (simplest; the repository must be public).** The repository only holds the app's
code and lessons, none of your data.

1. Repository **Settings → General → Danger Zone → Change repository visibility → Public**.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Actions → Build & deploy → Run workflow** (merging to `main` also starts it). About 2 minutes later
   the app is at `https://simiharms.github.io/hebrew/`.

**Option B: Cloudflare Pages (free; the repository stays private).**

1. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git** → pick
   `simiharms/hebrew`.
2. Production branch: `main`. Build command: `npm run build`. Output directory: `dist`. Under environment
   variables, set `NODE_VERSION` = `22`.
3. **Save and Deploy**. You get an address like `https://hebrew.pages.dev`.

### 3. On the iPhone

1. Open the address in **Safari** (only Safari can add web apps to the Home Screen).
2. Tap **Share** (the square with the arrow) → scroll down → **Add to Home Screen** → **Add**.
3. Open **Shoresh** from the Home Screen once while online, so it saves itself on the phone. From then on it
   works offline, even in flight mode.

### 4. One-time setup on the iPhone

- **Hebrew keyboard:** Settings → General → Keyboard → Keyboards → Add New Keyboard → Hebrew. Switch to it
  with the 🌐 key.
- **Better Hebrew voice:** Settings → Accessibility → Spoken Content → Voices → Hebrew → Carmit → download
  the **Enhanced** version.
- **First launch:** take the skills check, or pick your level. Then turn on **🎯 Verbs only** on Today
  whenever you want a verb day.
- **Backups:** progress lives only on the phone. Now and then use ⚙️ → Backup → Export backup and save it
  to Files or iCloud Drive. The same backup moves your progress between the Mac and the iPhone.

## Run it on your Mac (offline, no hosting)

Like a desktop program: unzip, double-click, practise. Nothing goes online.

1. Get the package: `npm run package` builds `release/Shoresh-mac-<date>.zip` (or use a zip you were sent).
2. Unzip it and double-click **start_shoresh.command**. A small Terminal window opens, and Shoresh opens in
   your browser at `http://localhost:8790/`. Keep that window open while you practise.
3. To stop, close the window, press Ctrl+C, or double-click **stop_shoresh.command**.

On a Mac, progress is saved in the browser and in the `progress` folder inside the Shoresh folder, with a
copy per day in `progress/backups`. Clearing the browser's data or switching browsers doesn't lose it.
`README.txt` in the zip covers the one-time macOS security prompt, the Hebrew keyboard and voice, and
updating.

## Develop

```bash
npm install
npm run dev          # local dev server
npm test             # unit tests (answer checking, verbs, decks, course, migration…)
npm run validate     # checks all content JSON (schema, answer keys, verb examples)
npm run build        # validate + typecheck + production build into dist/
npm run package      # Mac package (offline/ + the app) as release/Shoresh-mac-<date>.zip
npm run e2e          # drives the built app in headless Chromium (needs `vite preview` on :4173)
npm run e2e:package  # tests the Mac package end to end
```

Stack: Preact, TypeScript and Vite, with no backend. Scheduling uses FSRS. Speech uses the Web Speech API.

### Content

All learning content lives in `src/content/*.json`, typed by `src/content/types.ts`:

- `vocab-*.json`: words and phrases with root, gender, plural, binyan, preposition, level (A1–C1), topic
  (one of `src/lib/topics.ts`), example and usage note.
- `verbs-*.json`: full conjugation tables, three example sentences (`exs`, each naming the exact form it
  uses) and `rare` for tenses that exist on paper but aren't used (never drilled).
- `readings-*.json`: texts with glossary, open questions (keyword groups for grading), `tf`, `find`,
  `summary` and a writing task.
- `scenes-*.json`: dialogues with speakers, questions, `tf`, dictation lines and expressions.
- `grammar-*.json`: lessons with explanations, tables and fill-the-gap drills.
- `emails*.json`: writing tasks.

The course (which lesson, text, scene, verbs, deck and writing task belong to each unit) is in
`src/lib/course.ts`; card decks are in `src/lib/decks.ts`.

`npm run validate` rejects niqqud, malformed items and duplicate ids. It also rejects answer keys that don't
match their model answers, find-the-word answers that aren't in the text, and verb examples whose form isn't
in the table.

## Honest limitations

- Open answers are graded by key ideas: prefix- and inflection-aware keyword matching, plus optional
  on-device AI similarity on the web version. You make the final call against the model answer. It is not
  a teacher's correction.
- Speech quality depends on the device's Hebrew voice. Unvocalised text is sometimes mispronounced by any
  text-to-speech.
- The content was written and then proofread by AI editors for this app, with fictional people and
  companies. It was checked carefully, but it hasn't been reviewed by a human Hebrew teacher; if something
  sounds off, trust a native speaker. For authentic media, see *Practice → Real Hebrew, free*.

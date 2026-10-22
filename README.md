# Shoresh — Hebrew for work & life

A free Hebrew-learning app for iPhone (and any browser). It's built for people who got stuck around **A2**
on Duolingo and want Hebrew they can use at work and in daily life in Israel.

It's a Progressive Web App: open it in Safari, tap **Share → Add to Home Screen**, and it runs full-screen
and offline like a native app. There's no account, no subscription and no server. Your progress stays on
your phone, and you can export a backup.

## What it does differently from Duolingo

| Duolingo problem | What Shoresh does |
| --- | --- |
| Word banks and multiple choice (recognition, not recall) | **Every answer is typed in Hebrew.** Typos and missing final letters are tolerated and explained. You can say "I was right" to accept your own answer. |
| Almost no real reading | **24 graded articles** (A2+ → B2): emails, ads, news, interviews and business press. Tap any word to see its meaning, root, prefixes (ו ה ב כ ל מ ש) and dictionary form. Then answer questions **in your own Hebrew words**. |
| Robotic single sentences, no real listening | **18 TV-style scenes**: sitcom, office stand-up, customer-service call, news, job interview and podcast. They use real spoken Hebrew and slang, at adjustable speed. You listen first without the text, answer questions, then read the transcript and do dictation. |
| Roots and binyanim never explained | A **root explorer** groups the word families. There are **21 grammar lessons**: binyanim, weak roots, את/אותי, prepositions with endings, smichut, numbers and gender, conditionals, passive, and formal register. Each lesson has typed drills. |
| No verb tables | **64 verbs** with full present/past/future/imperative tables and transliteration. A spaced-repetition verb drill covers them. |
| Numbers are never practised | A numbers trainer covers prices, phone numbers, times, years and budgets **by ear**, plus writing numbers with correct gender (שלושה לקוחות, but שלוש שנים). |
| No business Hebrew | Business vocabulary and phrases, formal-register lessons, and **12 workplace writing tasks**: replying to a client, a supplier, a landlord or HR. A live checklist shows what your reply covers, and you can compare it with a model answer. |
| Streak-driven, shallow reviews | An FSRS spaced-repetition scheduler covers **about 700 words and phrases** (business, daily life, news) and the verbs. A **mistake bank** brings back every grammar, verb and number error. A daily plan mixes words, verbs, grammar, reading, listening, numbers and writing. |
| Can't use your own material | **"Your own text"**: paste any Hebrew (news, subtitles, WhatsApp) to get tap-to-translate, read-aloud and a fill-the-gap exercise. |
| Lessons in a random tree, no syllabus | A **17-unit course** in grammar order, from A2+ to B2. Its structure is inspired by university Hebrew textbooks such as Etzion's *Routledge Introductory Course in Modern Hebrew*. Each unit is one grammar point with a text, a scene, verbs and a writing task built around it, then a strict unit check. |
| One XP number, no idea what you're weak at | A **skills check** (about 10 min) gives you a level per skill: vocabulary, verb forms, grammar, listening, reading and writing. After that, every exercise updates a live profile, including weak spots by grammar topic, binyan and tense. The daily plan adds marked "focus" practice for your weakest skill. |
| Nothing current to read | **Easy news.** Short current-news articles rewritten in easy Hebrew (A2+/B1) with sources, a glossary and questions. Plus **today's real headlines**, fetched once a day from Hebrew news sites and ranked by how many of the words you already know. |

**Optional on-device AI grading.** You can turn this on in settings. It downloads a small multilingual
sentence-embedding neural network (~120 MB, once) that runs in the browser. It compares the *meaning* of
your free-text answers with the model answer, so a correct paraphrase gets credit. Nothing is sent to a
server.

## Run it on your Mac (offline, no hosting)

Like a desktop program: unzip, double-click, practise. Nothing goes online and nothing updates from outside.

1. Get the package: `npm run package` builds `release/Shoresh-mac-<date>.zip` (or use a zip you were sent).
2. Unzip it and double-click **start_shoresh.command**. A small Terminal window opens, and Shoresh opens in your
   browser at `http://localhost:8790/`. Keep that window open while you practise.
3. To stop, close the window, press Ctrl+C, or double-click **stop_shoresh.command**. Starting it again while it
   runs stops the old copy first.

Progress is saved in the browser and in the `progress` folder inside the Shoresh folder, with a copy per day in
`progress/backups`. Clearing the browser's data or switching browsers doesn't lose it: Shoresh restores it from the
folder. The package has everything except the features that need the internet (live headlines and the optional AI
grading). `README.txt` in the zip covers the one-time macOS security prompt, the Hebrew keyboard and voice, and
updating.

Why can't the iPhone run it the same way? iOS only runs programs from the App Store. Safari can't open a web app
saved in Files, and it only keeps an offline copy of a web app that comes from an `https://` address. So the iPhone
needs the hosted version below; once it's added to the Home Screen, it runs offline on the phone.

## Install on your iPhone (free)

The app is a static website. Host it for free once, then add it to your home screen.

### 1. Put the app on `main`

On GitHub: **Pull requests → New pull request → base: `main` ← compare: `claude/hebrew-learning-pwa` →
Create pull request → Merge**.

### 2. Host it, choosing one option

**Option A: GitHub Pages (simplest; the repository must be public).** Pages is not available for private
repositories on the free GitHub plan. The repo only holds the app's code and content.

1. Repository **Settings → General → Danger Zone → Change visibility → Public**.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Actions → Build & deploy → Run workflow** (merging to `main` also starts it). After about 2 minutes
   the app is live at `https://simiharms.github.io/hebrew/`.

**Option B: Cloudflare Pages (free; the repository stays private).**

1. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git** → pick
   `simiharms/hebrew`.
2. Production branch: `main`. Build command: `node scripts/fetch-news.mjs public/news.json; npm run build`.
   Output directory: `dist`. Under environment variables, set `NODE_VERSION` = `22`.
3. **Save and Deploy**. You get an address like `https://hebrew.pages.dev`. Headlines refresh on every
   rebuild, which happens at least weekly when the new easy-news issue is pushed.

### 3. On the iPhone

1. Open the app's address in **Safari** (not Chrome; only Safari can install web apps on iOS).
2. Tap **Share** (the square with the arrow) → scroll down → **Add to Home Screen** → **Add**.
3. Open **Shoresh** from the home screen. It runs full-screen and works offline.

### 4. One-time setup on the iPhone

- **Hebrew keyboard:** Settings → General → Keyboard → Keyboards → Add New Keyboard → Hebrew. In the app,
  switch to it with the 🌐 key.
- **Better Hebrew voice:** Settings → Accessibility → Spoken Content → Voices → Hebrew → Carmit → download
  the **Enhanced** version.
- **First launch:** take the 10-minute skills check. It places you in the course and tailors the daily
  plan.
- **Speaking practice:** the 🎤 key on the Hebrew keyboard lets you answer by voice.
- **Backups:** progress is stored only on the phone. Now and then use ⚙️ → Backup → Export backup and
  save it to Files or iCloud Drive.

### News

- **Daily headlines:** the deploy workflow also runs every morning (04:17 UTC). It fetches Hebrew RSS
  headlines into `news.json` and redeploys. GitHub pauses scheduled workflows after 60 days without
  repository activity; *Actions → Build & deploy → Run workflow* restarts it.
- **Weekly easy-news issue:** a scheduled Claude task ("Shoresh weekly easy news") runs every Friday
  morning. It writes 4–5 short easy-Hebrew articles with sources as
  `src/content/readings-news-YYYY-MM-DD.json`, validates them and pushes to `main`, which redeploys the
  app. You can also ask Claude Code any time to "write this week's easy news issue for Shoresh".

## Develop

```bash
npm install
npm run dev          # local dev server
npm test             # unit tests (answer checking, numbers, scheduler)
npm run validate     # checks all content JSON (schema + answer keys match model answers)
npm run build        # validate + typecheck + production build into dist/
npm run build:single # one self-contained HTML file in dist-single/ (no offline support)
npm run package      # Mac package (offline/ + the app) as release/Shoresh-mac-<date>.zip
npm run e2e:package  # tests that package end to end: server, progress folder, takeover, stop
```

Stack: Preact + TypeScript + Vite. There is no backend. Speech uses the device's built-in Hebrew voice (Web
Speech API).

### Content

All learning content lives in `src/content/*.json`, typed by `src/content/types.ts`:

- `vocab-*.json`: words and phrases with root, gender, plural, binyan, governed preposition, example and
  usage note.
- `verbs-*.json`: full conjugation tables.
- `readings-*.json`: graded texts with glossary, questions (with keyword groups for grading) and a
  writing task.
- `scenes-*.json`: dialogues with speakers, comprehension questions, dictation lines and expressions.
- `grammar-*.json`: lessons with explanations, tables and fill-the-gap drills.
- `emails.json`: workplace writing tasks.
- `readings-news-YYYY-MM-DD.json`: easy-news issues. These are readings with a `date` and `sources`.

The course structure (which lesson, text, scene, verbs and email belong to each unit) is in
`src/lib/course.ts`.

`npm run validate` rejects niqqud, malformed items and duplicate ids. It also rejects any question whose
answer keywords don't match its own model answer. To add content, add items to any of these files (or a
new file with the same prefix) and run the validator.

## Honest limitations

- Open answers are graded by key ideas: prefix- and inflection-aware keyword matching, plus optional AI
  similarity. You make the final call against the model answer. Grading is not a teacher's correction.
- Speech quality depends on the iPhone's Hebrew voice. Unvocalised text is occasionally mispronounced by
  any TTS.
- The texts and scenes were written for this app (fictional people and companies). For authentic media,
  see *Practice → Real Hebrew, free*.

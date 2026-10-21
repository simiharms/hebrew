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
| Streak-driven, shallow reviews | An FSRS spaced-repetition scheduler covers words and verbs. A **mistake bank** brings back every grammar, verb and number error. A daily plan mixes words, verbs, grammar, reading, listening, numbers and writing. |
| Can't use your own material | **"Your own text"**: paste any Hebrew (news, subtitles, WhatsApp) to get tap-to-translate, read-aloud and a fill-the-gap exercise. |

**Optional on-device AI grading.** You can turn this on in settings. It downloads a small multilingual
sentence-embedding neural network (~120 MB, once) that runs in the browser. It compares the *meaning* of
your free-text answers with the model answer, so a correct paraphrase gets credit. Nothing is sent to a
server.

## Install on your iPhone (free)

The app is a static website, so it needs free static hosting. Pick one:

1. **GitHub Pages.** This is free if the repository is **public**. Pages is not available for private
   repos on the free GitHub plan.
   - Settings → General → Change visibility → Public.
   - Settings → Pages → Source: **GitHub Actions**.
   - Push to `main`. The workflow in `.github/workflows/deploy.yml` tests, builds and deploys the app to
     `https://<user>.github.io/<repo>/`.
2. **Cloudflare Pages or Netlify (free tiers), keeping the repo private.** Connect the repository. Use
   build command `npm run build` and output directory `dist`.

Then, on the iPhone:

- Open the URL in **Safari** → Share → **Add to Home Screen**.
- Add the Hebrew keyboard: Settings → General → Keyboard → Keyboards → Add New Keyboard → Hebrew.
- For better speech: Settings → Accessibility → Spoken Content → Voices → Hebrew → download **Carmit
  (Enhanced)**.
- Tip: the 🎤 key on the Hebrew keyboard lets you dictate answers, which is free speaking practice.

## Develop

```bash
npm install
npm run dev          # local dev server
npm test             # unit tests (answer checking, numbers, scheduler)
npm run validate     # checks all content JSON (schema + answer keys match model answers)
npm run build        # validate + typecheck + production build into dist/
npm run build:single # one self-contained HTML file in dist-single/ (no offline support)
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

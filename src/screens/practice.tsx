import { Item, TopBar } from '../components/ui.tsx';
import { emails, grammar, verbs } from '../lib/content.ts';
import { go } from '../lib/router.ts';
import { dueVerbCount } from '../lib/session.ts';
import { useAppState } from '../lib/store.ts';

export function PracticeHub() {
  const s = useAppState();
  const gDone = grammar.filter((g) => s.done[g.id]).length;
  return (
    <>
      <TopBar title="Practice" />
      <main class="page">
        <div class="list">
          <Item emoji="🔁" title="Verb drill" sub={`${verbs.length} verbs · ${dueVerbCount()} due`} onClick={() => go('session/verbs')} />
          <Item emoji="📋" title="Conjugation tables" sub="Every form, with transliteration and audio" onClick={() => go('verbs')} />
          <Item emoji="🧩" title="Grammar" sub={`${gDone}/${grammar.length} lessons done`} onClick={() => go('grammar')} />
          <Item emoji="🔢" title="Numbers" sub="By ear and in writing — gender, prices, time" onClick={() => go('numbers')} />
          <Item emoji="✉️" title="Writing at work" sub={`${emails.length} realistic emails & messages to answer`} onClick={() => go('write')} />
          <Item emoji="🩹" title="Mistake bank" sub={`${s.mistakes.length} saved`} onClick={() => go('mistakes')} />
          <Item emoji="📋" title="Your own text" sub="Paste real Hebrew and study it" onClick={() => go('own')} />
          <Item emoji="🌍" title="Real Hebrew, free" sub="Podcasts, TV, news & dictionaries to use next" onClick={() => go('resources')} />
          <Item emoji="📈" title="Progress & settings" sub="Level, voice, backup" onClick={() => go('me')} />
        </div>
      </main>
    </>
  );
}

const RESOURCES: { group: string; items: { name: string; url: string; note: string }[] }[] = [
  {
    group: 'Dictionaries',
    items: [
      { name: 'Pealim', url: 'https://www.pealim.com/', note: 'Every verb and noun fully conjugated, with niqqud and audio.' },
      { name: 'Morfix', url: 'https://www.morfix.co.il/', note: 'The standard Hebrew–English dictionary Israelis use.' },
    ],
  },
  {
    group: 'Listening',
    items: [
      { name: 'Streetwise Hebrew (podcast)', url: 'https://www.youtube.com/results?search_query=streetwise+hebrew', note: 'Short episodes on slang and real spoken Hebrew.' },
      { name: 'Kan 11 on YouTube', url: 'https://www.youtube.com/results?search_query=%D7%9B%D7%90%D7%9F+11', note: 'Israeli public TV: series, satire, documentaries. Turn on Hebrew subtitles.' },
      { name: 'Kan Educational', url: 'https://www.youtube.com/results?search_query=%D7%9B%D7%90%D7%9F+%D7%97%D7%99%D7%A0%D7%95%D7%9B%D7%99%D7%AA', note: 'Clear, slower Hebrew for teens — perfect at B1.' },
      { name: 'Easy Hebrew news', url: 'https://www.youtube.com/results?search_query=%D7%97%D7%93%D7%A9%D7%95%D7%AA+%D7%91%D7%A2%D7%91%D7%A8%D7%99%D7%AA+%D7%A7%D7%9C%D7%94', note: 'Search “חדשות בעברית קלה” for simplified news bulletins.' },
    ],
  },
  {
    group: 'Reading (B1+ → business)',
    items: [
      { name: 'Ynet', url: 'https://www.ynet.co.il/', note: 'Largest news site — short items are great reading practice.' },
      { name: 'Globes', url: 'https://www.globes.co.il/', note: 'Business and markets.' },
      { name: 'Calcalist', url: 'https://www.calcalist.co.il/', note: 'Tech and economy.' },
    ],
  },
];

export function Resources() {
  return (
    <>
      <TopBar title="Real Hebrew, free" backTo="practice" />
      <main class="page">
        <div class="card primary small">
          <strong>A routine that works:</strong> watch 5 minutes with Hebrew subtitles → pause on a line you half-understand →
          paste it into <a href="#/own">Your own text</a> → tap the unknown words → add them to your deck.
        </div>
        {RESOURCES.map((g) => (
          <>
            <div class="section-title">{g.group}</div>
            <div class="list">
              {g.items.map((r) => (
                <a class="item" href={r.url} target="_blank" rel="noopener" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <span class="grow">
                    <div class="title">{r.name} ↗</div>
                    <div class="sub">{r.note}</div>
                  </span>
                </a>
              ))}
            </div>
          </>
        ))}
      </main>
    </>
  );
}

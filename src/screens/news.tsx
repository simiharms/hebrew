import { useEffect, useMemo, useState } from 'preact/hooks';
import { HeText } from '../components/hebrew.tsx';
import { Item, LevelBadge, Seg, SpeakBtn, TopBar, toast } from '../components/ui.tsx';
import { coverage, difficultyLabel, knownWords } from '../lib/coverage.ts';
import { newsItems } from '../lib/plan.ts';
import { go } from '../lib/router.ts';
import { setState, useAppState } from '../lib/store.ts';

declare const __SINGLE__: boolean;

interface Headline {
  title: string;
  summary: string;
  link: string;
  source: string;
  published: string | null;
}

function ago(iso: string | null): string {
  if (!iso) return '';
  const h = Math.round((Date.now() - Date.parse(iso)) / 3600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

function dateLabel(d: string): string {
  return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

export const EASY_NEWS_LINKS = [
  {
    name: 'Hadshon — easy Hebrew news (Ministry of Education)',
    url: 'https://pop.education.gov.il/tchumey_daat/ivrit_chinhch_leshony/yesodi/hadshon-ivrit',
    note: 'Weekly online newspaper in simplified Hebrew with partial niqqud, word explanations and audio for some articles.',
  },
  {
    name: 'News in easy Hebrew on YouTube',
    url: 'https://www.youtube.com/results?search_query=%D7%97%D7%93%D7%A9%D7%95%D7%AA+%D7%91%D7%A2%D7%91%D7%A8%D7%99%D7%AA+%D7%A7%D7%9C%D7%94',
    note: 'Search “חדשות בעברית קלה” for short bulletins read slowly.',
  },
  {
    name: 'Hebrew for new immigrants: learning materials',
    url: 'https://pop.education.gov.il/new-immigrants/hebrew-second-language/learning-teaching-materials/',
    note: 'Ministry of Education page with easy-Hebrew reading material.',
  },
];

export function NewsPage() {
  const s = useAppState();
  const issues = newsItems();
  const [headlines, setHeadlines] = useState<Headline[] | null>(null);
  const [updated, setUpdated] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<'easy' | 'new'>('easy');
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (__SINGLE__) {
      setError('single');
      return;
    }
    fetch('./news.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { updated: string | null; items: Headline[] }) => {
        setHeadlines(d.items ?? []);
        setUpdated(d.updated);
      })
      .catch(() => setError('missing'));
  }, []);

  const known = useMemo(() => knownWords(s), [s.cards]);
  const ranked = useMemo(() => {
    if (!headlines) return [];
    const withCov = headlines.map((h) => ({ h, cov: coverage(`${h.title} ${h.summary}`, known) }));
    if (sort === 'easy') withCov.sort((a, b) => b.cov.ratio - a.cov.ratio || a.cov.total - b.cov.total);
    return withCov;
  }, [headlines, known, sort]);

  const study = (h: Headline) => {
    const id = `t_${Date.now().toString(36)}`;
    setState((st) => {
      st.own.unshift({ id, title: h.title.slice(0, 60), text: [h.title, h.summary].filter(Boolean).join('\n'), at: Date.now() });
    });
    toast('Saved to Your own text');
    go(`own/${id}`);
  };

  return (
    <>
      <TopBar title="News" backTo="read" />
      <main class="page">
        <div class="section-title">This week, in easy Hebrew</div>
        {issues.length ? (
          <div class="list">
            {issues.map((r) => (
              <Item
                emoji="🗞️"
                title={<span class="he he-md">{r.title}</span>}
                sub={`${r.titleEn} · ${dateLabel(r.date!)}`}
                done={!!s.done[r.id]}
                right={s.done[r.id] ? <span class="badge good">{Math.round(s.done[r.id].score * 100)}%</span> : <LevelBadge level={r.level} />}
                onClick={() => go(`read/${r.id}`)}
              />
            ))}
          </div>
        ) : (
          <div class="card small muted">No easy-news issue installed yet.</div>
        )}

        <div class="section-title">Today's real headlines</div>
        {headlines && headlines.length > 0 && (
          <div class="mb">
            <Seg
              value={sort}
              options={[
                { v: 'easy', label: 'Easiest first' },
                { v: 'new', label: 'Newest first' },
              ]}
              onChange={setSort}
            />
          </div>
        )}
        {!headlines && !error && <div class="card small muted">Loading headlines…</div>}
        {error && (
          <div class="card small">
            {error === 'single'
              ? 'Live headlines appear in the installed app (they are fetched once a day on the server).'
              : 'No headlines yet. They are fetched once a day by the GitHub workflow when the app is deployed — see the README.'}
          </div>
        )}
        {headlines && headlines.length === 0 && <div class="card small muted">The last headline update found nothing. Try again tomorrow.</div>}
        {updated && (
          <p class="small muted">
            Updated {ago(updated)} · sorted by how many of the words you already know. Tap any word to look it up.
          </p>
        )}
        <div class="list">
          {ranked.map(({ h, cov }, i) => {
            const d = difficultyLabel(cov.ratio);
            const isOpen = open === i;
            return (
              <div class="card tight" style={{ margin: 0 }}>
                <div class="row small muted">
                  <span>{h.source}</span>
                  <span>· {ago(h.published)}</span>
                  <div class="spacer" />
                  <span class={`badge ${d.cls}`}>
                    {d.label} · {Math.round(cov.ratio * 100)}%
                  </span>
                </div>
                <div onClick={() => setOpen(isOpen ? null : i)}>
                  <HeText text={h.title} />
                </div>
                {isOpen && (
                  <>
                    {h.summary && (
                      <div class="mt">
                        <HeText text={h.summary} />
                      </div>
                    )}
                    {cov.unknown.length > 0 && (
                      <div class="small muted mt">
                        New for you: <span class="he">{cov.unknown.slice(0, 8).join(' · ')}</span>
                      </div>
                    )}
                    <div class="btn-row">
                      <SpeakBtn text={[h.title, h.summary].filter(Boolean).join('. ')} small />
                      <button class="btn small" onClick={() => study(h)}>
                        📋 Study it
                      </button>
                      {h.link && (
                        <a class="btn small" href={h.link} target="_blank" rel="noopener">
                          Full article ↗
                        </a>
                      )}
                    </div>
                  </>
                )}
                {!isOpen && (
                  <button class="btn small ghost" onClick={() => setOpen(i)}>
                    {h.summary ? 'Summary & tools' : 'Tools'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div class="section-title">More easy news (free)</div>
        <div class="list">
          {EASY_NEWS_LINKS.map((r) => (
            <a class="item" href={r.url} target="_blank" rel="noopener" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span class="grow">
                <div class="title">{r.name} ↗</div>
                <div class="sub">{r.note}</div>
              </span>
            </a>
          ))}
        </div>
      </main>
    </>
  );
}

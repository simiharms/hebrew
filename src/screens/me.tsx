import { useState } from 'preact/hooks';
import { ConfirmButton, Seg, TopBar, toast } from '../components/ui.tsx';
import type { Level } from '../content/types.ts';
import { LEVELS } from '../content/types.ts';
import { allVocab, grammar, readings, scenes, verbs } from '../lib/content.ts';
import { strength } from '../lib/fsrs.ts';
import { go } from '../lib/router.ts';
import { loadSemantic, semanticReady } from '../lib/semantic.ts';
import { exportState, type Focus, importState, resetState, setState, streak, useAppState } from '../lib/store.ts';
import { hebrewVoices, speak, ttsSupported } from '../lib/tts.ts';

declare const __SINGLE__: boolean;

function isStandalone(): boolean {
  return (navigator as { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;
}

export function InstallCard() {
  if (isStandalone() || __SINGLE__) return null;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return (
    <div class="card accent small">
      <strong>📲 Install on your iPhone</strong>
      <div class="mt">
        {ios ? (
          <>
            In Safari tap <strong>Share</strong> (□↑) → <strong>Add to Home Screen</strong>. It then opens full-screen, works
            offline and keeps your progress.
          </>
        ) : (
          <>Open this page in Safari on your iPhone, tap Share → Add to Home Screen.</>
        )}
      </div>
    </div>
  );
}

export function MePage() {
  const s = useAppState();
  const [semPct, setSemPct] = useState<number | null>(null);
  const [semErr, setSemErr] = useState('');
  const vocab = allVocab();
  const voices = hebrewVoices();

  const set = (fn: (st: typeof s) => void) => setState(fn);

  const perLevel = LEVELS.map((l) => {
    const rd = readings.filter((r) => r.level === l);
    const sc = scenes.filter((r) => r.level === l);
    const gr = grammar.filter((r) => r.level === l);
    return {
      l,
      read: `${rd.filter((r) => s.done[r.id]).length}/${rd.length}`,
      listen: `${sc.filter((r) => s.done[r.id]).length}/${sc.length}`,
      grammar: `${gr.filter((r) => s.done[r.id]).length}/${gr.length}`,
    };
  });
  const wordLevels = ['A2', 'B1', 'B2'].map((l) => {
    const items = vocab.filter((v) => v.level === l);
    const known = items.filter((v) => ['known', 'mature'].includes(strength(s.cards[`v:${v.id}`]))).length;
    return { l, known, total: items.length };
  });
  const verbSolid = verbs.filter((v) => ['present', 'past', 'future'].every((t) => ['known', 'mature'].includes(strength(s.cards[`c:${v.id}:${t}`])))).length;

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const log = s.days.find((x) => x.date === key);
    return { key, n: (log?.reviews ?? 0) + (log?.tasks.length ?? 0) * 5, day: d.toLocaleDateString(undefined, { weekday: 'narrow' }) };
  });
  const maxN = Math.max(10, ...last14.map((x) => x.n));
  const totalReviews = s.days.reduce((a, d) => a + d.reviews, 0);
  const totalCorrect = s.days.reduce((a, d) => a + d.correct, 0);

  const [exported, setExported] = useState<string | null>(null);
  const doExport = async () => {
    const data = exportState();
    if (__SINGLE__) {
      setExported(data);
      return;
    }
    const name = `shoresh-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([data], name, { type: 'application/json' });
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Shoresh backup' });
        return;
      } catch {
        // fall through to download
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const doImport = (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    f.text().then((t) => {
      try {
        importState(t);
        toast('Backup restored');
      } catch (err) {
        toast((err as Error).message);
      }
    });
  };

  const enableSemantic = async () => {
    setSemErr('');
    setSemPct(0);
    try {
      await loadSemantic((p) => setSemPct(p));
      set((st) => {
        st.settings.semantic = true;
      });
      setSemPct(100);
      toast('AI grading ready');
    } catch (err) {
      setSemPct(null);
      setSemErr(`Could not load the model: ${(err as Error).message}`);
    }
  };

  return (
    <>
      <TopBar title="Progress & settings" backTo="today" />
      <main class="page">
        <InstallCard />
        <div class="stats">
          <div class="stat">
            <div class="num">{streak(s)}🔥</div>
            <div class="lbl">streak</div>
          </div>
          <div class="stat">
            <div class="num">{totalReviews}</div>
            <div class="lbl">reviews</div>
          </div>
          <div class="stat">
            <div class="num">{totalReviews ? Math.round((totalCorrect / totalReviews) * 100) : 0}%</div>
            <div class="lbl">accuracy</div>
          </div>
        </div>

        <div class="card">
          <div class="small muted">Last 14 days</div>
          <div class="row" style={{ alignItems: 'flex-end', height: 70, gap: 4, marginTop: 8 }}>
            {last14.map((d) => (
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: `${Math.round((d.n / maxN) * 52)}px`, minHeight: d.n ? 3 : 1, background: d.n ? 'var(--primary)' : 'var(--line)', borderRadius: 3 }} />
                <div class="small muted">{d.day}</div>
              </div>
            ))}
          </div>
        </div>

        <div class="section-title">Progress</div>
        <div class="card">
          <table class="grid">
            <thead>
              <tr>
                <th>Words</th>
                <th>known</th>
              </tr>
            </thead>
            <tbody>
              {wordLevels.map((w) => (
                <tr>
                  <td>{w.l}</td>
                  <td>
                    {w.known} / {w.total}
                  </td>
                </tr>
              ))}
              <tr>
                <td>Verbs (all 3 tenses solid)</td>
                <td>
                  {verbSolid} / {verbs.length}
                </td>
              </tr>
            </tbody>
          </table>
          <table class="grid">
            <thead>
              <tr>
                <th>Level</th>
                <th>Read</th>
                <th>Listen</th>
                <th>Grammar</th>
              </tr>
            </thead>
            <tbody>
              {perLevel.filter((p) => p.read !== '0/0' || p.listen !== '0/0' || p.grammar !== '0/0').map((p) => (
                <tr style={p.l === s.level ? { background: 'var(--primary-soft)' } : undefined}>
                  <td>{p.l}</td>
                  <td>{p.read}</td>
                  <td>{p.listen}</td>
                  <td>{p.grammar}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div class="section-title">Learning</div>
        <div class="card">
          <div class="small muted">Your level</div>
          <Seg value={s.level} options={LEVELS.map((l) => ({ v: l, label: l }))} onChange={(v: Level) => set((st) => void (st.level = v))} />
          <div class="btn-row">
            <button class="btn small" onClick={() => go('placement')}>
              Retake placement test
            </button>
          </div>
          <div class="small muted mt">Focus</div>
          <Seg
            value={s.settings.focus}
            options={[
              { v: 'business', label: 'Business' },
              { v: 'both', label: 'Both' },
              { v: 'daily', label: 'Everyday' },
            ]}
            onChange={(v: Focus) => set((st) => void (st.settings.focus = v))}
          />
          <div class="small muted mt">New words per day</div>
          <Seg
            value={s.settings.newPerDay}
            options={[5, 8, 12, 15, 20].map((n) => ({ v: n, label: String(n) }))}
            onChange={(v: number) => set((st) => void (st.settings.newPerDay = v))}
          />
          <div class="small muted mt">Review target (higher = more reviews, better memory)</div>
          <Seg
            value={s.settings.retention}
            options={[
              { v: 0.85, label: '85%' },
              { v: 0.9, label: '90%' },
              { v: 0.95, label: '95%' },
            ]}
            onChange={(v: number) => set((st) => void (st.settings.retention = v))}
          />
          <label class="row mt">
            <input type="checkbox" checked={s.settings.showTr} onChange={(e) => set((st) => void (st.settings.showTr = (e.target as HTMLInputElement).checked))} />
            Show transliteration (turn off once you read fluently)
          </label>
        </div>

        <div class="section-title">Voice</div>
        <div class="card">
          {!ttsSupported() ? (
            <div class="small">Speech isn't available in this browser.</div>
          ) : (
            <>
              <div class="small muted">Speed</div>
              <Seg
                value={s.settings.rate}
                options={[
                  { v: 0.7, label: 'Slow' },
                  { v: 0.85, label: 'Relaxed' },
                  { v: 0.9, label: 'Normal' },
                  { v: 1.0, label: 'Native' },
                ]}
                onChange={(v: number) => set((st) => void (st.settings.rate = v))}
              />
              {voices.length > 1 && (
                <>
                  <div class="small muted mt">Main voice</div>
                  <select
                    class="select"
                    value={s.settings.voiceURI ?? voices[0].voiceURI}
                    onChange={(e) => set((st) => void (st.settings.voiceURI = (e.target as HTMLSelectElement).value))}
                  >
                    {voices.map((v) => (
                      <option value={v.voiceURI}>{v.name}</option>
                    ))}
                  </select>
                </>
              )}
              <div class="btn-row">
                <button class="btn small" onClick={() => speak('שלום! איך הולך? בוא נתחיל לעבוד.')}>
                  🔊 Test voice
                </button>
              </div>
              {voices.length === 0 && (
                <div class="small mt">
                  No Hebrew voice found. iPhone: Settings → Accessibility → Spoken Content → Voices → Hebrew → Carmit (choose
                  “Enhanced” for better quality).
                </div>
              )}
            </>
          )}
        </div>

        {!__SINGLE__ && <div class="section-title">Experimental: on-device AI grading</div>}
        {!__SINGLE__ && <div class="card small">
          <p>
            Downloads a small multilingual neural network (~120 MB, once) that runs <strong>on your phone</strong> and compares the
            meaning of your answers with the model answer — so a correct paraphrase gets credit even without the exact keywords.
            Free, no account, nothing leaves your device. Uses Wi-Fi data once; may be slow on older iPhones.
          </p>
          {s.settings.semantic ? (
            <div class="row">
              <span class="badge good">On{semanticReady() ? ' · loaded' : ''}</span>
              <button class="btn small" onClick={() => set((st) => void (st.settings.semantic = false))}>
                Turn off
              </button>
            </div>
          ) : (
            <button class="btn small primary" onClick={enableSemantic} disabled={semPct !== null && semPct < 100}>
              {semPct !== null && semPct < 100 ? `Downloading… ${semPct}%` : 'Download & turn on'}
            </button>
          )}
          {semErr && <div class="feedback bad">{semErr}</div>}
        </div>}

        <div class="section-title">Backup</div>
        <div class="card small">
          <p>Your progress lives only on this device. Export a backup now and then (e.g. to Files or iCloud Drive).</p>
          {exported !== null && (
            <>
              <textarea class="answer ltr" style={{ fontSize: 12, minHeight: 90 }} readOnly value={exported} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
              <button
                class="btn small"
                onClick={() =>
                  navigator.clipboard
                    ?.writeText(exported)
                    .then(() => toast('Copied — paste it into a note or file'))
                    .catch(() => toast('Select the text above and copy it'))
                }
              >
                Copy backup text
              </button>
            </>
          )}
          <div class="btn-row">
            <button class="btn small" onClick={doExport}>
              ⬇️ Export backup
            </button>
            <label class="btn small">
              ⬆️ Import
              <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={doImport} />
            </label>
          </div>
          <div class="mt">
            <ConfirmButton
              label="Reset everything"
              confirmLabel="Tap again: erase all progress"
              onConfirm={() => {
                resetState();
                go('onboarding');
              }}
            />
          </div>
        </div>
        <p class="small muted center">
          {vocab.length} words · {verbs.length} verbs · {readings.length} articles · {scenes.length} scenes · {grammar.length} grammar lessons
        </p>
      </main>
    </>
  );
}

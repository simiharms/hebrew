import { useEffect, useState } from 'preact/hooks';
import { ConfirmButton, Item, Seg, TopBar, toast } from '../components/ui.tsx';
import { go } from '../lib/router.ts';
import { PLAN } from '../lib/plan.ts';
import { exportState, importState, resetState, setState, useAppState } from '../lib/store.ts';
import { norwegianVoices, speak, ttsSupported } from '../lib/tts.ts';

export function SettingsPage() {
  const s = useAppState();
  const set = (f: (st: typeof s) => void) => setState(f);
  const [voices, setVoices] = useState(norwegianVoices());
  useEffect(() => {
    const t = setTimeout(() => setVoices(norwegianVoices()), 500);
    return () => clearTimeout(t);
  }, []);

  const doExport = async () => {
    const json = exportState();
    const name = `nordlys-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([json], name, { type: 'application/json' });
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: 'Nordlys-Sicherung' });
        return;
      } catch {
        // cancelled: fall back to a download
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const doImport = (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    f.text()
      .then((t) => {
        importState(t);
        toast('Sicherung geladen');
      })
      .catch((err: Error) => toast(err.message || 'Die Datei konnte nicht gelesen werden.'));
  };

  return (
    <>
      <TopBar title="Einstellungen" backTo="heute" />
      <main class="page">
        <div class="section-title">Lernen</div>
        <div class="card">
          <div class="small muted">Meine aktuelle Lektion</div>
          <select
            class="select mt"
            value={s.lesson}
            onChange={(e) =>
              set((st) => {
                st.lesson = Number((e.target as HTMLSelectElement).value);
              })
            }
          >
            {PLAN.map((p) => (
              <option value={p.n}>
                {p.n}. {p.title}
              </option>
            ))}
          </select>
          <div class="small muted mt">Neue Wörter pro Tag</div>
          <div class="mt">
            <Seg
              value={s.settings.newPerDay}
              options={[5, 8, 12, 20].map((v) => ({ v, label: String(v) }))}
              onChange={(v) =>
                set((st) => {
                  st.settings.newPerDay = v;
                })
              }
            />
          </div>
          <div class="small muted mt">Wörter wiederholen mit</div>
          <div class="mt">
            <Seg
              value={s.settings.reviewMode}
              options={[
                { v: 'flip', label: 'Karten umdrehen' },
                { v: 'type', label: 'Antwort tippen' },
              ]}
              onChange={(v) =>
                set((st) => {
                  st.settings.reviewMode = v;
                })
              }
            />
          </div>
          <div class="small muted mt">Abfragerichtung</div>
          <div class="mt">
            <Seg
              value={s.settings.direction}
              options={[
                { v: 'mixed', label: 'Gemischt' },
                { v: 'de2no', label: 'Deutsch → Norwegisch' },
                { v: 'no2de', label: 'Norwegisch → Deutsch' },
              ]}
              onChange={(v) =>
                set((st) => {
                  st.settings.direction = v;
                })
              }
            />
          </div>
        </div>

        <div class="section-title">Anzeige</div>
        <div class="card">
          <div class="small muted">Schriftgröße</div>
          <div class="mt">
            <Seg
              value={s.settings.fontScale}
              options={[
                { v: 1, label: 'Normal' },
                { v: 1.15, label: 'Groß' },
                { v: 1.3, label: 'Sehr groß' },
              ]}
              onChange={(v) =>
                set((st) => {
                  st.settings.fontScale = v;
                })
              }
            />
          </div>
          <div class="small muted mt">Hell oder dunkel</div>
          <div class="mt">
            <Seg
              value={s.settings.theme}
              options={[
                { v: 'auto', label: 'Automatisch' },
                { v: 'light', label: 'Hell' },
                { v: 'dark', label: 'Dunkel' },
              ]}
              onChange={(v) =>
                set((st) => {
                  st.settings.theme = v;
                })
              }
            />
          </div>
          <label class="row mt">
            <input
              type="checkbox"
              checked={s.settings.showDe}
              onChange={(e) =>
                set((st) => {
                  st.settings.showDe = (e.target as HTMLInputElement).checked;
                })
              }
            />
            <span>Deutsche Übersetzung unter den Texten immer zeigen</span>
          </label>
        </div>

        <div class="section-title">Stimme</div>
        <div class="card">
          {!ttsSupported() || voices.length === 0 ? (
            <p class="small">
              Keine norwegische Stimme gefunden. iPhone/iPad: <strong>Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Norwegisch</strong> (z. B.
              »Nora«, am besten die erweiterte Version). Mac: <strong>Systemeinstellungen → Bedienungshilfen → Gesprochene Inhalte</strong>. Danach die App neu öffnen.
            </p>
          ) : (
            <>
              <select
                class="select"
                value={s.settings.voiceURI ?? voices[0]?.voiceURI}
                onChange={(e) =>
                  set((st) => {
                    st.settings.voiceURI = (e.target as HTMLSelectElement).value;
                  })
                }
              >
                {voices.map((v) => (
                  <option value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
              <div class="small muted mt">Sprechtempo: {Math.round(s.settings.rate * 100)} %</div>
              <input
                type="range"
                min="0.5"
                max="1.2"
                step="0.05"
                value={s.settings.rate}
                onChange={(e) =>
                  set((st) => {
                    st.settings.rate = Number((e.target as HTMLInputElement).value);
                  })
                }
              />
              <button class="btn small mt" onClick={() => speak('Hei! Hvordan har du det i dag?')}>
                🔊 Probe hören
              </button>
            </>
          )}
        </div>

        <div class="section-title">Sicherung</div>
        <div class="card">
          <p class="small">
            Dein Fortschritt ist nur auf diesem Gerät gespeichert. Speichere ab und zu eine Sicherung (z. B. in »Dateien« oder iCloud Drive). Mit derselben Datei
            nimmst du deinen Fortschritt auf ein anderes Gerät mit.
          </p>
          <div class="btn-row">
            <button class="btn" onClick={doExport}>
              ⬇︎ Sicherung speichern
            </button>
            <label class="btn">
              ⬆︎ Sicherung laden
              <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={doImport} />
            </label>
          </div>
          <div class="mt">
            <ConfirmButton label="Alles zurücksetzen" confirmLabel="Wirklich allen Fortschritt löschen?" onConfirm={() => (resetState(), go('willkommen'))} />
          </div>
        </div>

        <div class="list mt">
          <Item emoji="ℹ️" title="Über Nordlys" sub="Zum Buch, zu den Inhalten, Hilfe" onClick={() => go('ueber')} />
        </div>
      </main>
    </>
  );
}

import { Item, TopBar } from '../components/ui.tsx';
import { aussprache, lessonByN } from '../lib/content.ts';
import { go } from '../lib/router.ts';
import { useAppState } from '../lib/store.ts';

export function PracticeHub() {
  const s = useAppState();
  const L = lessonByN.get(s.lesson);
  return (
    <>
      <TopBar title="Üben" />
      <main class="page">
        <div class="section-title">Nachschlagen und wiederholen</div>
        <div class="list">
          <Item emoji="🧩" title="Grammatik" sub="Alle Themen des Buches, nach Lektion" onClick={() => go('grammatik')} />
          {aussprache && <Item emoji="🗣️" title="Aussprache" sub="Vokale, kj/skj, stumme Buchstaben, Tonfall" onClick={() => go('aussprache')} />}
          <Item emoji="🩹" title="Fehler wiederholen" sub={s.mistakes.length ? `${s.mistakes.length} Aufgaben` : 'Keine offenen Fehler'} onClick={() => go('fehler')} />
          <Item emoji="★" title="Markierte Wörter" sub={`${s.starred.length} Karten`} onClick={() => go('lernen/markiert')} />
        </div>
        <div class="section-title">Training</div>
        <div class="list">
          <Item emoji="🔁" title="Verben" sub="Präsens, Präteritum, Perfekt, Imperativ" onClick={() => go('verben/training')} />
          <Item emoji="🎧" title="Hörtraining" sub="Sätze aus den Texten: hören und schreiben oder verstehen" onClick={() => go('hoertraining')} />
          <Item emoji="🔢" title="Zahlen, Uhrzeit und Datum" sub="tjueen, halv tre, syttende mai" onClick={() => go('zahlen')} />
        </div>
        {L && (
          <>
            <div class="section-title">Deine Lektion {s.lesson}</div>
            <div class="list">
              <Item emoji="✅" title="Lektionstest" sub={L.title} onClick={() => go(`lektion/${s.lesson}/test`)} />
              <Item emoji="✏️" title="Übungen zum Text" sub={L.text.title} onClick={() => go(`lektion/${s.lesson}/uebungen`)} />
              <Item emoji="📝" title="Schreiben" sub={L.writing.prompt} onClick={() => go(`lektion/${s.lesson}/schreiben`)} />
            </div>
          </>
        )}
      </main>
    </>
  );
}

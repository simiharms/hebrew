import { NoText } from '../components/text.tsx';
import { RichText, SpeakBtn, Table, TopBar } from '../components/ui.tsx';
import { aussprache, lessons, words } from '../lib/content.ts';

export function AboutPage() {
  const drills = lessons.reduce((a, L) => a + L.grammar.reduce((b, g) => b + g.drills.length, 0), 0);
  return (
    <>
      <TopBar title="Über Nordlys" backTo="einstellungen" />
      <main class="page">
        <div class="card">
          <h2>🌌 Nordlys</h2>
          <p>
            Eine Norwegisch-App zum Lehrbuch <strong>»Et år i Norge – Norwegisch für Deutschsprachige«</strong> von Randi Rosenvinge Schirmer (Hempen Verlag). Sie
            folgt dem Buch Lektion für Lektion: 23 Lektionen mit den Themen, Orten und der Grammatik des Buches, in seiner Reihenfolge, von A1 bis B2.
          </p>
          <p class="small muted">
            Die Texte, Übungen und Erklärungen sind neu für diese App geschrieben; nichts ist aus dem Buch kopiert. Die App ist eine Ergänzung zum Buch und zum
            Unterricht. Sie wurde mit KI erstellt und sorgfältig geprüft, aber nicht von einer Norwegischlehrerin – wenn dir etwas seltsam vorkommt, gilt, was im
            Buch steht oder was deine Lehrerin sagt.
          </p>
          <div class="stats mt">
            <div class="stat">
              <div class="num">{lessons.length}</div>
              <div class="lbl">Lektionen</div>
            </div>
            <div class="stat">
              <div class="num">{words.length}</div>
              <div class="lbl">Wörter</div>
            </div>
            <div class="stat">
              <div class="num">{drills}</div>
              <div class="lbl">Grammatik­übungen</div>
            </div>
          </div>
        </div>
        <div class="card">
          <h3>So lernst du mit der App</h3>
          <ul class="lesson-body">
            <li>Arbeite die Schritte deiner Lektion der Reihe nach durch – oder in jeder anderen Reihenfolge.</li>
            <li>Übe jeden Tag ein paar Minuten die Wörter (»Heute« → »Wörter üben«). Die App zeigt jede Karte genau dann wieder, wenn du sie sonst vergessen würdest.</li>
            <li>Tippe in jedem norwegischen Text auf ein Wort: Du hörst es und siehst die Übersetzung und die Formen.</li>
            <li>Im Lektionstest brauchst du 70 %. Dann wird die nächste Lektion deine aktuelle.</li>
            <li>Keine Internetverbindung nötig: Nach dem ersten Öffnen funktioniert die App auch offline. Es gibt kein Konto und keine Werbung.</li>
          </ul>
        </div>
        <div class="card small muted">Wörterbuch im Internet: ordbokene.no (Bokmålsordboka, kostenlos).</div>
      </main>
    </>
  );
}

export function AussprachePage() {
  if (!aussprache) return <TopBar title="Aussprache" backTo="ueben" />;
  return (
    <>
      <TopBar title="Aussprache" backTo="ueben" />
      <main class="page">
        <div class="card primary">
          <RichText text={aussprache.intro} />
        </div>
        {aussprache.sections.map((sec) => (
          <div class="card">
            <h3>{sec.h}</h3>
            <RichText text={sec.body} />
            {sec.table && <Table rows={sec.table} />}
            {sec.examples && sec.examples.length > 0 && (
              <div class="examples mt">
                {sec.examples.map((e) => (
                  <div class="row example-row">
                    <SpeakBtn text={e.no} small />
                    <div class="grow">
                      <NoText text={e.no} tap={false} />
                      <div class="de small">{e.de}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </main>
    </>
  );
}

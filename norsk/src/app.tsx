import { GlossSheet } from './components/text.tsx';
import { TabBar, ToastHost } from './components/ui.tsx';
import { useRoute } from './lib/router.ts';
import { useAppState } from './lib/store.ts';
import { AboutPage, AussprachePage } from './screens/about.tsx';
import { LessonCheck } from './screens/check.tsx';
import { ExercisesPage, ListenPage, WkPage, WritePage } from './screens/exercises.tsx';
import { GrammarOverview, GrammarTopicPage } from './screens/grammar.tsx';
import { LessonList, LessonPage } from './screens/lessons.tsx';
import { ListenTrainer } from './screens/listen-trainer.tsx';
import { MistakesPage } from './screens/mistakes.tsx';
import { NumbersPage } from './screens/numbers.tsx';
import { Onboarding } from './screens/onboarding.tsx';
import { PracticeHub } from './screens/practice.tsx';
import { TextReader } from './screens/reader.tsx';
import { WordSession } from './screens/session.tsx';
import { SettingsPage } from './screens/settings.tsx';
import { Today } from './screens/today.tsx';
import { VerbList, VerbPage, VerbTrainer } from './screens/verbs.tsx';
import { LessonWords, WordsHome } from './screens/words.tsx';

const TAB_OF: Record<string, string> = {
  heute: 'heute',
  einstellungen: 'heute',
  ueber: 'heute',
  lektionen: 'lektionen',
  lektion: 'lektionen',
  woerter: 'woerter',
  verben: 'verben',
  verb: 'verben',
  ueben: 'ueben',
  grammatik: 'ueben',
  fehler: 'ueben',
  zahlen: 'ueben',
  aussprache: 'ueben',
  hoertraining: 'ueben',
};

function lessonScreen(n: number, rest: string[]) {
  const [a, b] = rest;
  switch (a) {
    case 'text':
      return <TextReader n={n} id={`t${String(n).padStart(2, '0')}`} main />;
    case 'lesen':
      return <TextReader n={n} id={b ?? ''} />;
    case 'woerter':
      return <LessonWords n={n} />;
    case 'grammatik':
      return <GrammarTopicPage n={n} id={b ?? ''} />;
    case 'uebungen':
      return <ExercisesPage n={n} />;
    case 'woerterkiste':
      return <WkPage n={n} />;
    case 'hoeren':
      return <ListenPage n={n} />;
    case 'schreiben':
      return <WritePage n={n} />;
    case 'test':
      return <LessonCheck n={n} />;
    default:
      return <LessonPage n={n} />;
  }
}

function screen(route: string[]) {
  const [a = 'heute', b, c] = route;
  switch (a) {
    case 'willkommen':
      return <Onboarding />;
    case 'lektionen':
      return <LessonList />;
    case 'lektion':
      return lessonScreen(Number(b), route.slice(2));
    case 'lernen':
      if (b === 'lektion') return <WordSession mode={{ type: 'lesson', n: Number(c) }} />;
      if (b === 'wk') return <WordSession mode={{ type: 'wk', n: Number(c) }} />;
      if (b === 'markiert') return <WordSession mode={{ type: 'starred' }} />;
      return <WordSession mode={{ type: 'daily' }} />;
    case 'woerter':
      return b ? <LessonWords n={Number(b)} /> : <WordsHome />;
    case 'verben':
      if (b === 'training') return <VerbTrainer lesson={c ? Number(c) : undefined} />;
      return <VerbList />;
    case 'verb':
      return <VerbPage id={b ?? ''} />;
    case 'ueben':
      return <PracticeHub />;
    case 'grammatik':
      return <GrammarOverview />;
    case 'fehler':
      return <MistakesPage />;
    case 'zahlen':
      return <NumbersPage />;
    case 'aussprache':
      return <AussprachePage />;
    case 'hoertraining':
      return <ListenTrainer />;
    case 'einstellungen':
      return <SettingsPage />;
    case 'ueber':
      return <AboutPage />;
    default:
      return <Today />;
  }
}

export function App() {
  const route = useRoute();
  const s = useAppState();
  const first = route[0] ?? 'heute';
  const effective = !s.onboarded ? ['willkommen'] : route;
  const focusMode = ['lernen', 'willkommen'].includes(effective[0] ?? '') || (effective[0] === 'lektion' && effective[2] === 'test') || (effective[0] === 'verben' && effective[1] === 'training');
  return (
    <div class="app">
      <div key={effective.join('/')} style={{ display: 'contents' }}>
        {screen(effective)}
      </div>
      {!focusMode && <TabBar active={TAB_OF[first] ?? 'heute'} />}
      <GlossSheet />
      <ToastHost />
    </div>
  );
}

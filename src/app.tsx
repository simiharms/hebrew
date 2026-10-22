import { GlossSheet } from './components/hebrew.tsx';
import { TabBar, ToastHost } from './components/ui.tsx';
import { useRoute } from './lib/router.ts';
import { useAppState } from './lib/store.ts';
import { AssessmentPage } from './screens/assessment.tsx';
import { CoursePage, UnitCheck, UnitPage } from './screens/course.tsx';
import { GrammarLessonPage, GrammarList } from './screens/grammar.tsx';
import { ListenList, ScenePlayer } from './screens/listen.tsx';
import { MePage } from './screens/me.tsx';
import { MistakesPage } from './screens/mistakes.tsx';
import { NewsPage } from './screens/news.tsx';
import { NumbersPage } from './screens/numbers.tsx';
import { Onboarding } from './screens/onboarding.tsx';
import { OwnList, OwnText } from './screens/own.tsx';
import { PracticeHub, Resources } from './screens/practice.tsx';
import { ReadList, Reader } from './screens/read.tsx';
import { WordSession } from './screens/session-words.tsx';
import { Today } from './screens/today.tsx';
import { VerbList, VerbPage, VerbSession } from './screens/verbs.tsx';
import { RootPage, TopicPage, WordsHome } from './screens/words.tsx';
import { WriteList, WriteTask } from './screens/write.tsx';

const TAB_OF: Record<string, string> = {
  today: 'today',
  me: 'today',
  course: 'today',
  unit: 'today',
  words: 'words',
  verbs: 'practice',
  verb: 'words',
  read: 'read',
  own: 'read',
  news: 'read',
  listen: 'listen',
  numbers: 'practice',
  practice: 'practice',
  grammar: 'practice',
  write: 'practice',
  mistakes: 'practice',
  resources: 'practice',
};

function screen(route: string[]) {
  const [a = 'today', b, c] = route;
  switch (a) {
    case 'onboarding':
      return <Onboarding />;
    case 'placement':
    case 'assessment':
      return <AssessmentPage />;
    case 'course':
      return <CoursePage />;
    case 'unit':
      if (c === 'check') return <UnitCheck n={Number(b)} />;
      return <UnitPage n={Number(b)} />;
    case 'words':
      if (b === 'topic' && c) return <TopicPage topic={c} />;
      if (b === 'root' && c) return <RootPage root={c} />;
      return <WordsHome />;
    case 'session':
      if (b === 'verbs') return <VerbSession only={c} />;
      if (b === 'unit') return <VerbSession unit={Number(c)} />;
      return <WordSession />;
    case 'verbs':
      return <VerbList />;
    case 'verb':
      return <VerbPage id={b ?? ''} />;
    case 'read':
      return b ? <Reader id={b} /> : <ReadList />;
    case 'news':
      return <NewsPage />;
    case 'listen':
      return b ? <ScenePlayer id={b} /> : <ListenList />;
    case 'practice':
      return <PracticeHub />;
    case 'grammar':
      return b ? <GrammarLessonPage id={b} /> : <GrammarList />;
    case 'numbers':
      return <NumbersPage />;
    case 'write':
      return b ? <WriteTask id={b} /> : <WriteList />;
    case 'mistakes':
      return <MistakesPage />;
    case 'own':
      return b ? <OwnText id={b} /> : <OwnList />;
    case 'resources':
      return <Resources />;
    case 'me':
      return <MePage />;
    default:
      return <Today />;
  }
}

export function App() {
  const route = useRoute();
  const s = useAppState();
  const first = route[0] ?? 'today';
  const effective = !s.onboarded && first !== 'placement' && first !== 'assessment' ? ['onboarding'] : route;
  const focusMode = ['session', 'onboarding', 'placement', 'assessment'].includes(effective[0] ?? '') || (effective[0] === 'unit' && effective[2] === 'check');
  return (
    <div class="app">
      <div key={effective.join('/')} style={{ display: 'contents' }}>
        {screen(effective)}
      </div>
      {!focusMode && <TabBar active={TAB_OF[first] ?? 'today'} />}
      <GlossSheet />
      <ToastHost />
    </div>
  );
}

import { render } from 'preact';
import { App } from './app.tsx';
import { toast } from './components/ui.tsx';
import { startFolderSave } from './lib/localsave.ts';
import { unlockSpeech } from './lib/tts.ts';
import '@fontsource/rubik/hebrew-400.css';
import '@fontsource/rubik/hebrew-500.css';
import '@fontsource/rubik/hebrew-700.css';
import './styles.css';

declare const __SINGLE__: boolean;
declare const __HOSTED__: boolean;

if (__SINGLE__) document.documentElement.classList.add('in-artifact');

// The Mac package also keeps progress in the Shoresh folder; take that copy
// first if it is newer (see lib/localsave.ts).
const ready = __HOSTED__ || __SINGLE__ ? Promise.resolve(false) : startFolderSave();
ready.then((restored) => {
  render(<App />, document.getElementById('app')!);
  if (restored) setTimeout(() => toast('Progress restored from the Shoresh folder'), 300);
});

// iOS needs a first user gesture before speech works.
const unlock = () => {
  unlockSpeech();
  document.removeEventListener('touchend', unlock);
  document.removeEventListener('click', unlock);
};
document.addEventListener('touchend', unlock);
document.addEventListener('click', unlock);

// Ask the browser not to evict saved progress.
navigator.storage?.persist?.().catch(() => {});

const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
if (!__SINGLE__ && 'serviceWorker' in navigator && (location.protocol === 'https:' || local) && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // offline support is optional
    });
  });
}

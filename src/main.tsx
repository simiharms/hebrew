import { render } from 'preact';
import { App } from './app.tsx';
import { unlockSpeech } from './lib/tts.ts';
import './styles.css';

declare const __SINGLE__: boolean;

render(<App />, document.getElementById('app')!);

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

import { render } from 'preact';
import { App } from './app.tsx';
import { getState, subscribe } from './lib/store.ts';
import { unlockSpeech } from './lib/tts.ts';
import './styles.css';

// Text size and light/dark follow the settings.
function applyLook() {
  const { fontScale, theme } = getState().settings;
  document.documentElement.style.setProperty('--scale', String(fontScale));
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}
applyLook();
subscribe(applyLook);

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
if ('serviceWorker' in navigator && (location.protocol === 'https:' || local) && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // offline support is optional
    });
  });
}

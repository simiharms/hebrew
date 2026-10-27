import { useEffect, useState } from 'preact/hooks';

declare const __SINGLE__: boolean;

// The installed app routes with the URL hash (#/read/r_b1_x). The single-file
// build runs inside a host frame where hash changes don't reach the address
// bar and history.back() could leave the page, so it keeps an in-memory stack.
const memory: string[][] = [[]];
const listeners = new Set<() => void>();

function parse(): string[] {
  if (__SINGLE__) return memory[memory.length - 1];
  return location.hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);
}

export function useRoute(): string[] {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const f = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    if (__SINGLE__) {
      listeners.add(f);
      return () => {
        listeners.delete(f);
      };
    }
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return route;
}

export function go(path: string): void {
  if (__SINGLE__) {
    memory.push(path.split('/').filter(Boolean));
    if (memory.length > 50) memory.splice(1, memory.length - 50);
    listeners.forEach((l) => l());
    return;
  }
  location.hash = '#/' + path.split('/').map(encodeURIComponent).join('/');
}

export function back(fallback = 'today'): void {
  if (__SINGLE__) {
    if (memory.length > 1) {
      memory.pop();
      listeners.forEach((l) => l());
    } else go(fallback);
    return;
  }
  if (history.length > 1) history.back();
  else go(fallback);
}

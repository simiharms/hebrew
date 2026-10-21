import { useEffect, useState } from 'preact/hooks';

function parse(): string[] {
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
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return route;
}

export function go(path: string): void {
  location.hash = '#/' + path.split('/').map(encodeURIComponent).join('/');
}

export function back(fallback = 'today'): void {
  if (history.length > 1) history.back();
  else go(fallback);
}

// The Mac package runs Shoresh from a small server on the Mac itself
// (offline/serve.py). Progress is also saved into the Shoresh folder through
// it, so clearing the browser's website data or switching browsers doesn't
// lose it. When the app starts, the newer of the two copies wins.
import { exportState, getState, isAppState, restoreState, subscribe } from './store.ts';

const ENDPOINT = './__shoresh/progress';
const HEADERS = { 'X-Shoresh': '1' };
// Browsers refuse keepalive requests with bodies over 64 KB.
const KEEPALIVE_MAX = 60_000;

export interface FolderStatus {
  running: boolean; // false while the local server can't be reached
  savedAt: number | null;
}

let status: FolderStatus = { running: false, savedAt: null };
const watchers = new Set<() => void>();

export function folderStatus(): FolderStatus {
  return status;
}

export function watchFolderStatus(l: () => void): () => void {
  watchers.add(l);
  return () => {
    watchers.delete(l);
  };
}

function setStatus(next: FolderStatus): void {
  status = next;
  watchers.forEach((l) => l());
}

async function save(leaving = false): Promise<void> {
  const body = exportState();
  try {
    const res = await fetch(ENDPOINT, {
      method: 'PUT',
      headers: { ...HEADERS, 'Content-Type': 'application/json' },
      body,
      keepalive: leaving && body.length < KEEPALIVE_MAX,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setStatus({ running: true, savedAt: Date.now() });
  } catch {
    setStatus({ running: false, savedAt: status.savedAt });
  }
}

/**
 * Takes the folder copy if it is newer than the browser's, then keeps the
 * folder copy up to date. Resolves to true when progress was restored.
 */
export async function startFolderSave(): Promise<boolean> {
  let restored = false;
  let folderUpdatedAt = -1; // -1: no copy in the folder yet
  try {
    const res = await fetch(ENDPOINT, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout?.(2000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (res.status === 200) {
      const saved = (await res.json())?.state;
      if (isAppState(saved)) {
        folderUpdatedAt = saved.updatedAt ?? 0;
        if (folderUpdatedAt > (getState().updatedAt ?? 0)) {
          restoreState(saved);
          restored = true;
        }
      }
    }
    setStatus({ running: true, savedAt: null });
  } catch {
    setStatus({ running: false, savedAt: null });
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void save();
    }, 800);
  });
  const flush = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    void save(true);
  };
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  window.addEventListener('pagehide', flush);

  if (status.running && !restored && (getState().updatedAt ?? 0) > folderUpdatedAt) void save();
  return restored;
}

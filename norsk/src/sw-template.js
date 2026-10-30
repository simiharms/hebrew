// Service worker template; vite.config.ts fills in the version and file list.
const CACHE = 'nordlys-__VERSION__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('nordlys-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Network first so updates arrive, but never wait long and never show an
    // error page (404, captive Wi-Fi login) instead of the app. The cached shell
    // is only ever written at install, together with its assets, so it can't
    // end up pointing at scripts that aren't cached.
    event.respondWith(
      new Promise((resolve) => {
        let settled = false;
        const fallback = () =>
          caches.match('./', { ignoreSearch: true }).then((hit) => {
            if (settled) return;
            if (hit) {
              settled = true;
              resolve(hit);
            }
          });
        const timer = setTimeout(fallback, 3500);
        fetch(req)
          .then((res) => {
            if (settled) return;
            if (res.ok && res.type === 'basic') {
              settled = true;
              clearTimeout(timer);
              resolve(res);
            } else {
              clearTimeout(timer);
              caches.match('./', { ignoreSearch: true }).then((hit) => {
                if (settled) return;
                settled = true;
                resolve(hit || res);
              });
            }
          })
          .catch(() => {
            clearTimeout(timer);
            caches.match('./', { ignoreSearch: true }).then((hit) => {
              if (settled) return;
              settled = true;
              resolve(hit || Response.error());
            });
          });
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

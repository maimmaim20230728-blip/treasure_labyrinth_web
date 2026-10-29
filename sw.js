/* 宝の迷宮 SW - 完全オフラインキャッシュ */
const CACHE = 'tlab-v22';
const ASSETS = [
  './', './index.html', './style.css', './i18n.js', './logic.js', './audio.js', './game.js',
  './manifest.json', './icons/icon-192.png', './icons/icon-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // ignoreSearch: X の「?from=x」付きURLでもキャッシュに当たるように。
  // 通信も失敗したとき(オフライン)は、画面の読み込みなら index.html を返す(ブラウザのオフライン画面にしない)
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const cp = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, cp));
      }
      return res;
    })).catch(() => e.request.mode === 'navigate'
      ? caches.match('./index.html').then(hit => hit || Response.error())
      : Response.error())
  );
});

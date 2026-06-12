// 三国·烽火天下 离线缓存
// 策略：HTML 联网优先（在线即更新，离线用缓存）；静态资源缓存优先
const CACHE = 'sgbh-v6';
const ASSETS = ['./', './index.html', './manifest.json', './icon.png',
  './css/style.css',
  './js/data.js', './js/core.js', './js/map.js', './js/ui.js', './js/ai.js', './js/main.js'];

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
  const isHTML = e.request.mode === 'navigate' ||
    (e.request.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    // 联网优先：拿到新版立即更新缓存；断网（机上模式）回退缓存
    e.respondWith(
      fetch(e.request).then(resp => {
        const cp = resp.clone();
        caches.open(CACHE).then(c => c.put('./index.html', cp));
        return resp;
      }).catch(() => caches.match('./index.html'))
    );
  } else {
    // 静态资源：缓存优先
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(hit => hit ||
        fetch(e.request).then(resp => {
          const cp = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, cp));
          return resp;
        })
      )
    );
  }
});

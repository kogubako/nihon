// 日本工具箱 Service Worker：預先快取頁面，離線也能開
// 改了頁面內容不用動這支；只有要強制所有人清掉舊快取時才改 VERSION
const VERSION = 'v1';
const CACHE = 'japan-toolbox-' + VERSION;
const FONT_CACHE = 'japan-toolbox-fonts';

// 首頁用到的頁面（其中一個不存在也不會讓安裝失敗）
const PRECACHE = [
  './',
  'index.html',
  'travel-plan.html',
  'travel-list.html',
  'venues.json',
  'receipt.html',
  'product-check.html',
  'coupon.html',
  'creditcard.html',
  'jpyrate.html',
  'kakeibo2.html',
  'manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(PRECACHE.map(url => cache.add(new Request(url, { cache: 'reload' }))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith('japan-toolbox-') && k !== CACHE && k !== FONT_CACHE)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts：用過一次就存起來（先給快取，背景更新）
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(async cache => {
        const cached = await cache.match(req);
        const fresh = fetch(req).then(res => { cache.put(req, res.clone()); return res; }).catch(() => cached);
        return cached || fresh;
      })
    );
    return;
  }

  // 其他網站（Claude API、Google 試算表、匯率 API…）一律不攔截，照常連網
  if (url.origin !== self.location.origin) return;

  // 自己網站的檔案：有網路抓最新並更新快取，沒網路才用快取
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then(hit =>
          hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())
        )
      )
  );
});
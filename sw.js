const CACHE_PREFIX = 'tokyo-trip-2026-';
const CACHE_NAME = CACHE_PREFIX + 'mobile-v16';
const BASE = new URL('./', self.location.href);
const INDEX = new URL('index.html', BASE).href;
const APP_FILES = ['index.html','trip-app.js','trip-app.css','trip-weather.js','trip-money.js','manifest.webmanifest',
  'trip-icon.svg','trip-icon-180.png','trip-icon-192.png','trip-icon-512.png','stay-tokyo.jpg','stay-nikko.jpg','stay-narita.jpg','site-one/index.html','restaurant-guide/index.html'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_FILES.map(path => new Request(new URL(path, BASE), {cache:'reload'})));
    const html = await (await cache.match(INDEX)).text();
    const images = [...new Set(html.match(/trip-image-[a-f0-9]{20}\.(?:png|jpg|webp)/g) || [])];
    await cache.addAll(images.map(path => new URL(path, BASE).href));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // GitHub Pages projects share an origin. Never delete another project's cache.
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  const isHome = url.pathname === BASE.pathname || url.pathname === new URL(INDEX).pathname;
  const key = isHome ? INDEX : request;
  const immutableImage = /^trip-image-[a-f0-9]{20}\./.test(url.pathname.slice(BASE.pathname.length));
  if (immutableImage) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(key);
      if(cached) return cached;
      const response=await fetch(request);
      if(response.ok && response.type==='basic') await cache.put(key,response.clone());
      return response;
    })());
    return;
  }
  const network = (async () => {
    const response = await fetch(request);
    if(response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(key,response.clone());
    }
    if(!response.ok && response.status >= 500) throw new Error('server unavailable');
    return response;
  })();
  event.waitUntil(network.catch(() => {}));
  event.respondWith((async () => {
    let timer;
    try {
      const timeout = new Promise((_,reject) => { timer=setTimeout(()=>reject(new Error('network timeout')),4000); });
      return await Promise.race([network,timeout]);
    } catch {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(key);
      if(cached) return cached;
      if(request.mode === 'navigate') return new Response(
        '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>目前離線｜楓葉之旅</title><body style="font:18px/1.8 sans-serif;padding:32px;background:#faf7f2;color:#293b38"><h1>這一頁尚未儲存</h1><p>目前沒有網路，請連線後再開啟這份補充資料。</p><a href="'+BASE.pathname+'">回到可離線閱讀的每日行程</a></body></html>',
        {status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
      return Response.error();
    } finally { clearTimeout(timer); }
  })());
});

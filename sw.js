// キャッシュは最小限。オフラインでもフォームが開く程度に留める。
const CACHE = "asset-tray-pwa-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./auth.js",
  "./config.js",
  "./drive.js",
  "./queue.js",
  "./ulid.js",
  "./manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Google APIとGISは絶対にキャッシュしない
  if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("google.com")) return;

  // 自分のオリジンだけ network-first(更新が滞らないように)
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match("./index.html")))
  );
});

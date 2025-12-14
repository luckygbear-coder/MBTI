// sw.js — MBTI熊（安全版）
// 重點：
// 1) HTML/CSS/JS/Icon 可快取，加速離線
// 2) data/mbti.json 永遠 Network-First（避免人格資料被卡舊）
// 3) 版本號一改就會更新整包

const CACHE_VERSION = "mbti-bear-v20251214-1";
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./styles.css",
  "./manifest.webmanifest",
  "./images/bear.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// 安裝：快取 shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// 啟用：清舊快取
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => {
        if (k.startsWith("app-shell-") && k !== APP_SHELL_CACHE) return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

// 抓取策略
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // ✅ 重要：人格資料永遠走網路（避免舊資料）
  if (url.pathname.endsWith("/data/mbti.json")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 其他檔案：Cache First（離線也能開）
  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(APP_SHELL_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;

  const fresh = await fetch(req);
  // 只快取 GET 且同源資源
  if (req.method === "GET" && fresh.ok) cache.put(req, fresh.clone());
  return fresh;
}

async function networkFirst(req) {
  const cache = await caches.open(APP_SHELL_CACHE);
  try {
    const fresh = await fetch(req, { cache: "no-store" });
    if (fresh && fresh.ok) {
      // 這裡不 put，確保每次都能拿最新
      return fresh;
    }
    const cached = await cache.match(req);
    return cached || fresh;
  } catch (e) {
    const cached = await cache.match(req);
    return cached || new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}
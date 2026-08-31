/*
 * Service Worker بسيط لوضع Offline:
 *  - GET: بيخزّن آخر رد ناجح (Network falling back to Cache).
 *  - صفحات التنقل (navigation): بنعرض آخر نسخة كاش لو فيه، بدل صفحة خطأ.
 *  - POST/PATCH مش بتتخزن (بتتنفّذ من الـ app نفسه وهو بيتعامل مع طابور الإعادة).
 */
const CACHE = "clinic-saas-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(["/login"]).catch(() => undefined)
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // طلبات API: نت أولاً، الكاش احتياطي للقراءة فقط
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || new Response(JSON.stringify({ data: [] }), {
          headers: { "Content-Type": "application/json" },
        })))
    );
    return;
  }

  // تنقل الصفحات: كاش أولاً للشيل، مع تحديث بالخلفية
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/login")))
    );
  }
});

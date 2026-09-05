/* 做装模拟器 Service Worker —— 静态资源缓存优先 + 后台更新（stale-while-revalidate）
 * 二次访问秒开、可离线使用；部署新版后下次访问自动换新。
 * 数据包结构变更时请递增 CACHE 版本号强制全量刷新。 */
const CACHE = "poe2-craft-v3";
const CORE = [
  "index.html", "style.css",
  "data.js", "data_pools.js", "augments.js", "assets.js",
  "i18n_mods.js", "engine.js", "stats.js", "app.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.allSettled(CORE.map((f) => c.add(f)))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const refresh = fetch(e.request).then((res) => {
        /* <img> 等以 no-cors 方式加载，响应是 opaque（status=0、ok=false），必须放行才能缓存图标；
         * clone() 必须在 respondWith 开始消费响应体之前同步执行，否则抛 "body already used" */
        if (res && (res.ok || res.type === "opaque")) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => hit || Response.error());
      return hit || refresh;
    })
  );
});

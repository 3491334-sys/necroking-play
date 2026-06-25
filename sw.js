// NecroKing — Service Worker (PWA)
// COMBO 11 H3 → COMBO 14 hotfix → Fase 18 (PWA completo):
// Estratégia: NETWORK-FIRST — sempre tenta rede primeiro (pra dev pegar updates),
// cai no cache se offline ou rede falhou.
// Bump version quando index.html ou recursos pré-cacheados mudam significativamente.

const CACHE_NAME = "necroking-v97-2026-06-24-mobile-joystick-config-viewport-fix";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icon.png",  // legado 256×256 — mantido pra compat
  "./assets/music.mp3",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Fase 18: tolerante a falhas — cacha o que conseguir, não aborta tudo se 1 asset falhar
      Promise.all(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) =>
            console.warn(`[SW] Falhou pré-cache de ${url}:`, err)
          )
        )
      )
    )
  );
  self.skipWaiting();
});

// Fase 18: aceita mensagem do app pra forçar update imediato
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // Não interfere em archive.org (música) — sempre rede direta
  if (e.request.url.includes("archive.org")) return;

  // 2026-06-15 FIX: para HTML/navegação (index.html), busca SEM o HTTP cache do
  // browser (cache:"no-store"). Antes o network-first ainda recebia o index.html
  // ANTIGO do cache HTTP do browser → updates de dev não apareciam até hard-refresh.
  // Agora a página sempre vem fresca quando online; o resto segue network-first normal.
  const isDoc = e.request.mode === "navigate"
             || e.request.destination === "document"
             || e.request.url.endsWith("/")
             || e.request.url.endsWith("/index.html");
  const netReq = isDoc ? new Request(e.request.url, { cache: "no-store" }) : e.request;

  // NETWORK-FIRST: tenta rede, cacheia resposta nova, cai no cache se offline.
  e.respondWith(
    fetch(netReq)
      .then((response) => {
        // Cacheia apenas same-origin GET 200 OK
        if (e.request.method === "GET" && response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // Offline ou rede falhou → tenta cache
        return caches.match(e.request);
      })
  );
});

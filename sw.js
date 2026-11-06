/* =========================================================================
   Digit Impact Studio — « service worker » de la version téléphone
   - garde l'application en mémoire : elle s'ouvre vite, même avec une connexion faible
   - reçoit les notifications envoyées par le serveur (même téléphone verrouillé)
   Les données (Supabase) ne sont jamais mises en cache ici : elles restent toujours à jour.
   ========================================================================= */
const CACHE = "digit-impact-v1.32.0";
const APP_FILES = [
  "./", "./index.html", "./ui-polish.css", "./mobile.css", "./sb-sync.js", "./ui-polish.js", "./mobile.js",
  "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",
  "./vendor/chart.umd.min.js", "./vendor/html2pdf.bundle.min.js", "./vendor/qrcode.min.js", "./vendor/supabase.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fichiers de l'application : on essaie d'abord le réseau (dernière version), sinon la copie gardée en mémoire
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
  );
});

// Notification reçue du serveur (voir le guide d'activation des notifications)
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Digit Impact Studio";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "Vous avez une nouvelle notification.",
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    tag: data.tag || ("dis-" + Date.now()),   // une notification par message (comme WhatsApp)
    renotify: true,
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
    data: { url: data.url || "./index.html" }
  }));
});

// Toucher la notification ouvre (ou ramène) l'application
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "./index.html";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      return self.clients.openWindow(target);
    })
  );
});

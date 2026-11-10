// Minimal service worker: gör appen installerbar. Cachar medvetet ingenting —
// träningsdata och inloggning ska alltid komma färskt från servern.
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()))
self.addEventListener("fetch", () => {})

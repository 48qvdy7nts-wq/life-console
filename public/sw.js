const CACHE_NAME = "life-console-v3";
const PRECACHE = [
  "./",
  "./index.html",
  "./setup/",
  "./setup/index.html",
  "./today/",
  "./today/index.html",
  "./calendar/",
  "./calendar/index.html",
  "./commitments/",
  "./commitments/index.html",
  "./search/",
  "./search/index.html",
  "./areas/",
  "./areas/index.html",
  "./systems/",
  "./systems/index.html",
  "./projects/",
  "./projects/index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/maskable.svg",
  "./generated/apple-sync.json",
  "./generated/local-scan.json",
  "./generated/project-sync.json",
  "./templates/life-console-items-template.csv",
  "./templates/google-calendar-import-template.csv",
  "./templates/notion-deadlines-template.csv",
  "./templates/life-console-calendar-template.ics",
  "./templates/life-console-snapshot-template.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }

        if (request.mode === "navigate") {
          return caches.match(request.url) || caches.match("./index.html");
        }

        throw new Error("Offline and no cache entry available.");
      })
  );
});

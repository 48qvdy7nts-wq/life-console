const PAGE_SEGMENTS = new Set([
  "setup",
  "account",
  "today",
  "calendar",
  "commitments",
  "search",
  "areas",
  "systems",
  "projects",
]);

function resolveBasePathFromLocation() {
  if (typeof window === "undefined") {
    return "/";
  }

  const segments = String(window.location.pathname || "/")
    .split("/")
    .filter(Boolean);

  if (segments[segments.length - 1] === "index.html") {
    segments.pop();
  }

  if (PAGE_SEGMENTS.has(segments[segments.length - 1])) {
    segments.pop();
  }

  return segments.length ? `/${segments.join("/")}/` : "/";
}

export async function registerPwaServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(
      `${resolveBasePathFromLocation()}sw.js`
    );
    return registration;
  } catch {
    return null;
  }
}

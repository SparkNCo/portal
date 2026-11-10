// "Log in, then come back here": a page that needs a signed-in user remembers
// where the visitor was going (AuthGate) and sends them to the login page
// (`/`); after they log in, the login page takes them back there instead of
// their home page (app/login/Login.tsx). So a link someone was sent (e.g.
// `/{slug}/build?issueId=…`) still opens after they log in. Whether they may
// see that page is decided after login, by the page's own access check.
//
// The page is kept in this tab's sessionStorage, not in the URL, so the login
// page stays a clean `/`. It's read once, and expires after a while so an old
// visit doesn't hijack a later login.

const STORAGE_KEY = "portal.loginRedirect";
const MAX_AGE_MS = 30 * 60 * 1000;

// Only paths inside this site: "/something", never "//evil.com" or
// "/\evil.com" (both of which a browser treats as another host), and never a
// full URL — so it can't be used to send someone elsewhere after login.
export function safeRedirect(value: string | null | undefined): string | null {
  if (!value?.startsWith("/")) {
    return null;
  }
  if (value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  return value;
}

// What gets stored for `path`, or null when there's nothing worth coming back
// to (the login page itself, or an unsafe path).
export function storedRedirect(path: string, now: number): string | null {
  const target = safeRedirect(path);
  if (!target || target === "/") {
    return null;
  }
  return JSON.stringify({ path: target, at: now });
}

// The stored page, if it's still safe and recent enough.
export function readStoredRedirect(raw: string | null, now: number): string | null {
  if (!raw) {
    return null;
  }
  try {
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof path !== "string" || typeof at !== "number" || now - at > MAX_AGE_MS || at > now) {
      return null;
    }
    return safeRedirect(path);
  } catch {
    return null;
  }
}

// sessionStorage can throw (private mode, blocked storage): then there's
// simply no redirect and login goes to the home page as usual.
export function rememberLoginRedirect(path: string): void {
  try {
    const value = storedRedirect(path, Date.now());
    if (value) {
      sessionStorage.setItem(STORAGE_KEY, value);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage unavailable: no redirect.
  }
}

// Forgets any stored page (e.g. on logout), so the next login goes home.
export function clearLoginRedirect(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: nothing stored either.
  }
}

// Read once: the stored page is removed as it's taken.
export function takeLoginRedirect(): string | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    return readStoredRedirect(raw, Date.now());
  } catch {
    return null;
  }
}

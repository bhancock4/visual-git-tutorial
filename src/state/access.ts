/**
 * Freemium access gating.
 *
 * Free scenarios: order 0–4 (What is Git → Remotes).
 * Paid scenarios: order 5–9 (Merge Conflicts, Gitignore, Stash, Oh Shit, Sandbox).
 *
 * There is no backend. Unlock state lives in localStorage and can be flipped on
 * by an unlock token in the URL. This lets us wire Gumroad later without a
 * server: point the Gumroad "content"/redirect URL at
 *
 *     https://<host>/#/tutorial?unlock=<TOKEN>
 *
 * where <TOKEN> matches UNLOCK_TOKEN below (override with VITE_UNLOCK_TOKEN at
 * build time). On first load the token is consumed, unlock is persisted to
 * localStorage, and the token is stripped from the URL so it isn't shared by
 * accident. For demos/testing, `?unlock=reset` clears the unlock again.
 */

/** Highest scenario `order` available for free. */
export const FREE_MAX_ORDER = 4;

const UNLOCK_STORAGE_KEY = 'gitvisual:unlocked';

/**
 * Token that unlocks paid content when present in the URL as `?unlock=<TOKEN>`.
 * Not a security measure — this is a client-only learning tool, so the token
 * just needs to be non-guessable enough to avoid casual sharing. Override via
 * VITE_UNLOCK_TOKEN so the real value can differ from what's in source.
 */
const UNLOCK_TOKEN = import.meta.env.VITE_UNLOCK_TOKEN || 'ai-cobuilder';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode, etc.) — unlock just won't persist */
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Whether the learner has unlocked the paid scenarios. */
export function isUnlocked(): boolean {
  return safeGet(UNLOCK_STORAGE_KEY) === 'true';
}

export function setUnlocked(unlocked: boolean): void {
  if (unlocked) {
    safeSet(UNLOCK_STORAGE_KEY, 'true');
  } else {
    safeRemove(UNLOCK_STORAGE_KEY);
  }
}

/** A scenario is locked when it's a paid scenario and the user hasn't unlocked. */
export function isScenarioLocked(order: number, unlocked: boolean): boolean {
  return !unlocked && order > FREE_MAX_ORDER;
}

/**
 * Reads an `unlock` param from either the query string or the hash (the app
 * uses hash routing, so tokens may arrive as `#/tutorial?unlock=...`). Returns
 * the value and a URL cleaned of the param so we can strip it after consuming.
 */
function readUnlockParam(): { value: string | null; cleaned: string } {
  const url = new URL(window.location.href);

  let value: string | null = url.searchParams.get('unlock');
  if (value !== null) {
    url.searchParams.delete('unlock');
  }

  // Also support the token living inside the hash, e.g. "#/tutorial?unlock=x".
  const hash = url.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex !== -1) {
    const hashParams = new URLSearchParams(hash.slice(qIndex + 1));
    const hashValue = hashParams.get('unlock');
    if (hashValue !== null) {
      if (value === null) value = hashValue;
      hashParams.delete('unlock');
      const rest = hashParams.toString();
      url.hash = hash.slice(0, qIndex) + (rest ? `?${rest}` : '');
    }
  }

  return { value, cleaned: url.pathname + url.search + url.hash };
}

/**
 * Consume an unlock token from the URL (if present), persist the result, and
 * strip the token from the address bar. Returns the current unlock state.
 * Call once on app mount.
 */
export function consumeUnlockFromUrl(): boolean {
  const { value, cleaned } = readUnlockParam();

  if (value !== null) {
    if (value === UNLOCK_TOKEN) {
      setUnlocked(true);
    } else if (value === 'reset' || value === '0') {
      // Demo/testing helper to re-lock content.
      setUnlocked(false);
    }
    // Remove the token from the URL regardless, so it isn't shared accidentally.
    try {
      window.history.replaceState(null, '', cleaned);
    } catch {
      /* ignore */
    }
  }

  return isUnlocked();
}

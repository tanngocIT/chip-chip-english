// New versions of the app. The installed app keeps running from its offline cache, so without
// this a child's tablet could stay on an old version for weeks. A new version is picked up in
// the background and switched to as soon as no game is in progress. It never reloads in the
// middle of a game.
//
// What made updates slow to arrive on an installed Android app (reported by the owner), and
// what is done about each:
//  - the host keeps serving the old service worker file for up to ten minutes after a deploy,
//    and the app only asked when it was opened: now it asks again every two minutes while open;
//  - a ready version waited for the start screen or for the app to be hidden, and a reload of a
//    hidden app is not something Android can be relied on to run: now it switches on any screen
//    that is not a game (home, a topic's list of games, the sticker book), and when the app
//    comes back to the front;
//  - nothing showed that a version was on its way: the start screen now says so.

import { registerSW } from 'virtual:pwa-register';

declare const __BUILD_TIME__: string;

/** When this copy of the app was built (ISO date). */
export const BUILD_TIME: string = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '';

export type UpdateState = 'none' | 'downloading' | 'ready';

let state: UpdateState = 'none';
let applying = false;
let apply: ((reload?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | undefined;
let onChange: (() => void) | null = null;
let safe: () => boolean = () => false;
/** the new worker is in control and this page only has to load again */
let reloadDue = false;

const ASK_EVERY_MS = 2 * 60 * 1000;

const setState = (s: UpdateState) => {
  if (state === s) return;
  state = s;
  onChange?.();
};

const look = () => {
  if (document.visibilityState !== 'visible') return;
  void registration?.update().catch(() => {
    /* offline: try again later */
  });
};

/** Follow a new service worker while it downloads the new files. */
function watch(r: ServiceWorkerRegistration) {
  const follow = () => {
    const sw = r.installing;
    // the very first install is not an update: there is no older version to replace
    if (!sw || !navigator.serviceWorker.controller) return;
    setState('downloading');
    sw.addEventListener('statechange', () => {
      if (sw.state === 'redundant' && state === 'downloading') setState('none');
    });
  };
  r.addEventListener('updatefound', follow);
  follow();
}

// A switch that does not take (a worker that will not activate) must not reload the app over
// and over: at most three automatic switches in ten minutes.
const TRIES_KEY = 'chip-update-tries';
function mayAutoApply(): boolean {
  try {
    const now = Date.now();
    const tries = (JSON.parse(sessionStorage.getItem(TRIES_KEY) ?? '[]') as number[]).filter((t) => now - t < 10 * 60 * 1000);
    if (tries.length >= 3) return false;
    sessionStorage.setItem(TRIES_KEY, JSON.stringify([...tries, now]));
  } catch {
    /* no session storage: go ahead */
  }
  return true;
}

/** Switch now if a version is ready and nothing would be interrupted. */
export function tryApply() {
  const quiet = document.visibilityState === 'hidden' || safe();
  if (reloadDue) {
    if (quiet) location.reload();
    return;
  }
  if (state !== 'ready' || applying) return;
  if (quiet && mayAutoApply()) void applyUpdate();
}

/** `isSafe` says whether reloading right now would interrupt anything. `root` is where screens are shown. */
export function initUpdate(isSafe: () => boolean, root?: HTMLElement) {
  if (!('serviceWorker' in navigator)) return;
  safe = isSafe;
  apply = registerSW({
    immediate: true,
    onNeedRefresh() {
      setState('ready');
      tryApply();
    },
    // The new worker has taken control. The browser can take half a minute over that (it lets
    // the old worker finish first), long enough for a child to have started a game: the reload
    // then waits for the game to end, like the switch itself.
    onNeedReload() {
      reloadDue = true;
      tryApply();
    },
    onRegisteredSW(_url, r) {
      registration = r;
      if (r) watch(r);
      // the browser asks once when the page loads; ask again shortly, in case that was too early
      setTimeout(look, 8000);
    },
  });
  // leaving for the home screen and coming back are both good moments
  document.addEventListener('visibilitychange', () => {
    tryApply();
    look();
  });
  // every change of screen: the moment a game ends, the waiting version can come in
  if (root) new MutationObserver(() => tryApply()).observe(root, { childList: true });
  setInterval(look, ASK_EVERY_MS);
}

export const updateReady = () => state === 'ready';
export const updateState = () => state;

/** Ask the server now. Resolves after a moment with whether a new version is waiting. */
export async function checkForUpdate(): Promise<boolean> {
  try {
    await registration?.update();
  } catch {
    /* offline */
  }
  // a version being downloaded counts: wait for it a little longer
  for (let i = 0; i < 20 && (i < 5 || state === 'downloading'); i++) {
    if (state === 'ready') break;
    await new Promise((r) => setTimeout(r, 500));
  }
  return state === 'ready';
}

/** Switch to the new version (reloads the page). */
export function applyUpdate() {
  if (applying) return Promise.resolve();
  applying = true;
  // The page reloads when the new service worker has taken control of it (the plugin does that).
  // Never before: a reload while the old worker still answers gets the old page, and by the time
  // that page asks for its scripts the new worker has deleted them. The result was a blank
  // screen until the app was closed and opened again (the owner's installed Android app, where
  // clearing two thousand cached files takes longer than the three seconds this used to wait).
  if (!navigator.serviceWorker.controller) {
    // A page no worker controls yet (the very first visit) never gets that signal, and has no
    // old worker to answer wrongly: reload once the new one has had time to activate.
    setTimeout(() => location.reload(), 3000);
  } else {
    // if the worker never takes over, give up quietly so a later try can be made
    setTimeout(() => {
      applying = false;
    }, 60_000);
  }
  return apply?.(true) ?? Promise.resolve();
}

/** Called when the update state changes (one listener; null removes it). */
export const onUpdateChange = (fn: (() => void) | null) => {
  onChange = fn;
};

/** "18/11 14:05": when this copy was built, for a grown-up to see which version is running. */
export function buildLabel(): string {
  if (!BUILD_TIME) return '';
  const d = new Date(BUILD_TIME);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()}/${d.getMonth() + 1} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

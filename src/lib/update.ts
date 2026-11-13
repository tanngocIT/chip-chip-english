// New versions of the app. The installed app keeps running from its offline cache, so without
// this a child's tablet could stay on an old version for weeks. A new version is picked up in
// the background and switched to at a moment that interrupts nobody: while the app is hidden,
// or on the start screen. It never reloads in the middle of a game.

import { registerSW } from 'virtual:pwa-register';

declare const __BUILD_TIME__: string;

/** When this copy of the app was built (ISO date). */
export const BUILD_TIME: string = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '';

let ready = false;
let applying = false;
let apply: ((reload?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | undefined;
let onChange: (() => void) | null = null;

const look = () => {
  void registration?.update().catch(() => {
    /* offline: try again later */
  });
};

/** `isSafe` says whether reloading right now would interrupt anything. */
export function initUpdate(isSafe: () => boolean) {
  if (!('serviceWorker' in navigator)) return;
  apply = registerSW({
    immediate: true,
    onNeedRefresh() {
      ready = true;
      onChange?.();
      if (isSafe() || document.visibilityState === 'hidden') void applyUpdate();
    },
    onRegisteredSW(_url, r) {
      registration = r;
    },
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (ready) void applyUpdate();
    } else {
      look();
    }
  });
  // an app left open all day still finds out
  setInterval(look, 30 * 60 * 1000);
}

export const updateReady = () => ready;

/** Ask the server now. Resolves after a moment with whether a new version is waiting. */
export async function checkForUpdate(): Promise<boolean> {
  try {
    await registration?.update();
  } catch {
    /* offline */
  }
  await new Promise((r) => setTimeout(r, 2500));
  return ready;
}

/** Switch to the new version (reloads the page). */
export function applyUpdate() {
  if (applying) return Promise.resolve();
  applying = true;
  // The reload normally comes when the new service worker takes control of this page. A page
  // that no service worker controls yet (the very first visit) never gets that signal, so
  // reload anyway once the new worker has had time to activate.
  setTimeout(() => location.reload(), 3000);
  return apply?.(true) ?? Promise.resolve();
}

/** Called when a new version becomes ready (one listener; null removes it). */
export const onUpdateChange = (fn: (() => void) | null) => {
  onChange = fn;
};

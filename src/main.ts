import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import './style.css';

import { topicById } from './lib/content';
import { addMinutes, overLimit } from './lib/progress';
import { app, P, inParentArea, persist } from './screens/core';
import { splash, rest } from './screens/home';
import { initKeys } from './screens/keys';
import { challenge } from './screens/challenge';
import { initUpdate, BUILD_TIME } from './lib/update';

// ---------- play-time counter ----------

setInterval(() => {
  if (document.visibilityState !== 'visible' || inParentArea) return;
  if (app.querySelector('.splash')) return;
  addMinutes(P, 1);
  persist();
  // A game in progress and its result screen are never cut off: the child finishes, then rests.
  if (overLimit(P) && !app.querySelector('.lesson, .result, .rest')) rest();
}, 60_000);

// for the automated playthrough (scripts/screenshots.mjs) and for looking at things by hand
(window as any).__app = { P, topicById, build: BUILD_TIME, challenge: (id: string) => challenge(topicById(id)!) };

initKeys(app);
// A new version may come in whenever no game is on and no grown-up is in the settings: the
// start screen, the home screen, a topic's list of games, the sticker book, the word book.
initUpdate(() => !inParentArea && !app.querySelector('.lesson, .result, .grown, .scene-screen'), app);
splash();
// the app is up: the page's self-repair (index.html) may count from zero again
try {
  sessionStorage.removeItem('chip-heal');
} catch {
  /* no session storage */
}

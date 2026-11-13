// Shared state and navigation for every screen: the saved progress, show(), the today session.

import { h, pulse } from '../lib/dom';
import { type Topic } from '../lib/content';
import { load, save, overLimit, type Activity } from '../lib/progress';
import { initVoice, say, stopSpeaking, setRate, closeMic, stopClip } from '../lib/voice';
import { sfx } from '../lib/sfx';
import { initInstall } from '../lib/install';
import { icon, roundBtn, progressDots, setChipLook } from '../ui';
import { home, rest } from './home';
import { topicScreen } from './topic';
import { learn } from './learn';
import { quiz } from './quiz';
import { findIt } from './find';
import { singAlong } from './sing';
import { sayIt } from './say';
import { memory } from './memory';
import { oddOneOut } from './odd';
import { challenge } from './challenge';

export const app = document.getElementById('app')!;
export const P = load();
setRate(P.settings.rate);
initVoice();
initInstall();
setChipLook(P.look);

let cleanup: (() => void) | null = null;
let lastKind = '';
export let inParentArea = false;

/** Each navigation bumps this so that stale async steps of an old screen stop. */
export let screenId = 0;
export const alive = (id: number) => id === screenId;

export function show(node: HTMLElement, onLeave?: () => void) {
  cleanup?.();
  cleanup = onLeave ?? null;
  stopSpeaking();
  stopClip();
  if (!node.classList.contains('sayit')) closeMic();
  screenId++;
  if (node.className !== lastKind) node.classList.add('enter');
  lastKind = node.className.replace(' enter', '');
  app.replaceChildren(node);
  window.scrollTo(0, 0);
}

export const persist = () => save(P);

/**
 * The one-tap "today" session: a fixed run of games in one topic. While it is on, each
 * result screen leads to the next game and Back leaves to the home screen.
 */
export const SESSION_STEPS: Activity[] = ['learn', 'listen', 'find', 'sing'];
export let session: { topic: Topic; i: number } | null = null;

export function startToday(t: Topic) {
  if (overLimit(P)) return rest();
  session = { topic: t, i: 0 };
  startActivity(t, SESSION_STEPS[0]);
}

export function nextStep() {
  const s = session;
  if (!s) return home();
  // the session ends away from the screen: Chip gives one thing to do in the room
  if (++s.i >= SESSION_STEPS.length) return P.settings.challenges ? challenge(s.topic) : home();
  startActivity(s.topic, SESSION_STEPS[s.i]);
}

/** Say a short line while the button wiggles, then go. Extra taps meanwhile are ignored. */
let announcing = false;
export async function announce(btn: HTMLElement, line: string, go: () => void) {
  if (announcing) return;
  announcing = true;
  const id = screenId;
  pulse(btn, 'wiggle');
  await say(line);
  announcing = false;
  if (alive(id)) go();
}

export function endSession() {
  session = null;
}

export function setInParentArea(v: boolean) {
  inParentArea = v;
}

/** Back button inside a game. */
export const leave = (t: Topic) => (session ? home() : topicScreen(t));

export function startActivity(t: Topic, a: Activity) {
  if (overLimit(P)) return rest();
  if (a === 'learn') return learn(t);
  if (a === 'listen') return quiz(t, 'listen');
  if (a === 'match') return quiz(t, 'match');
  if (a === 'find') return findIt(t);
  if (a === 'sing') return singAlong(t);
  if (a === 'memory') return memory(t);
  if (a === 'odd') return oddOneOut(t);
  return sayIt(t);
}

export function lessonBar(back: () => void, total: number, done: number, extra?: HTMLElement) {
  return h(
    'header',
    { class: 'bar' },
    roundBtn(icon.back(), 'Back', () => {
      sfx.tap();
      back();
    }),
    progressDots(total, done),
    extra ?? h('span', { class: 'spacer' }),
  );
}

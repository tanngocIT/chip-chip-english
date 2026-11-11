// Sing along: a chant over a tune.

import { h, wait } from '../lib/dom';
import { wordsIn, describe, type Topic } from '../lib/content';
import { levelConfig, recordSeen, recordStars, pickLearnSet } from '../lib/progress';
import { say } from '../lib/voice';
import { sfx, playNotes } from '../lib/sfx';
import { icon, picture, roundBtn, progressDots } from '../ui';
import { P, screenId, alive, show, persist, leave } from './core';
import { result } from './result';

// ---------- sing along ----------

/** "Twinkle, twinkle" (dân gian, thuộc phạm vi công cộng): bốn ô nhịp, mỗi nốt một phách. */
const TUNE = [
  ['C', 'C', 'G', 'G'],
  ['A', 'A', 'G', '-'],
  ['F', 'F', 'E', 'E'],
  ['D', 'D', 'C', '-'],
];
const BEAT = 0.5; // giây

/**
 * A short chant over a tune: for each word the picture bounces on the beat while Chip says
 * "cat, cat, it's a cat." Speech sets the pace: each line waits for the next bar line, so slow
 * reading speeds or slow devices never get cut off.
 */
export function singAlong(t: Topic) {
  const list = pickLearnSet(wordsIn(t.id), levelConfig(P.settings.age).singCount, P);
  let stopNotes: (() => void) | null = null;
  const dots = h('div', { class: 'dots-wrap' }, progressDots(list.length, 0));
  const stage = h('section', { class: 'stage' });

  show(
    h(
      'main',
      { class: 'screen lesson sing', style: `--tint:${t.color}` },
      h(
        'header',
        { class: 'bar' },
        roundBtn(icon.back(), 'Back', () => {
          sfx.tap();
          leave(t);
        }),
        dots,
        h('span', { class: 'spacer' }),
      ),
      stage,
    ),
    () => stopNotes?.(),
  );
  const id = screenId;

  /** One bar: start its notes, say the line, then wait for the bar line (a later one if speech ran long). */
  const bar = async (notes: string[], line: string) => {
    const start = performance.now();
    stopNotes = playNotes(notes, BEAT);
    if (line) await say(line);
    const barMs = notes.length * BEAT * 1000;
    const spent = performance.now() - start;
    const bars = Math.max(1, Math.ceil((spent - 80) / barMs));
    await wait(Math.max(0, bars * barMs - spent));
    return alive(id);
  };

  void (async () => {
    await wait(350);
    for (let i = 0; i < list.length && alive(id); i++) {
      const w = list[i];
      recordSeen(P, w.id);
      persist();
      dots.replaceChildren(progressDots(list.length, i));
      stage.replaceChildren(
        h('div', { class: 'card flash pop-in' }, h('div', { class: 'beat' }, picture(w, 'lg')), h('span', { class: 'word' }, w.word)),
      );
      const half = (i % 2) * 2;
      if (!(await bar(TUNE[half], w.word))) return;
      if (!(await bar(TUNE[half + 1], w.word))) return;
      // the sentence gets the same two bars again
      if (!(await bar(TUNE[half], describe(w)))) return;
      if (!(await bar(TUNE[half + 1], ''))) return;
    }
    if (!alive(id)) return;
    recordStars(P, t.id, 'sing', 3);
    persist();
    result(t, 'sing', 3, null);
  })();
}

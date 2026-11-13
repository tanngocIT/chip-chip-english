// My words: every word the child has met, topic by topic. Tap one to hear it again.

import { h, pulse } from '../lib/dom';
import { topics, words, wordsIn, wordById } from '../lib/content';
import { stat } from '../lib/progress';
import { say } from '../lib/voice';
import { sfx } from '../lib/sfx';
import { icon, picture, roundBtn } from '../ui';
import { P, show } from './core';
import { home } from './home';

/** How many words the child has met so far. */
export const metCount = () => words.filter((w) => stat(P, w.id).seen > 0).length;

export function wordBook() {
  const sections = topics.map((t) => {
    const list = wordsIn(t.id);
    const met = list.filter((w) => stat(P, w.id).seen > 0);
    const head = h('h3', { class: 'wb-head' }, picture(wordById(t.icon)!, 'xs'), h('span', {}, t.en), h('span', { class: 'wb-count' }, `${met.length} / ${list.length}`));
    // a topic not started yet is one line, so the page is as long as what the child knows
    if (!met.length) return h('section', { class: 'wb-topic empty', style: `--tint:${t.color}` }, head);
    const cells = list.map((w) => {
      const s = stat(P, w.id);
      // a word still to come keeps its place, like an empty slot in the sticker book
      if (!s.seen) return h('div', { class: 'wb-word todo' }, '?');
      return h(
        'button',
        {
          class: `wb-word ${s.box >= 3 ? 'known' : ''}`,
          'aria-label': w.word,
          onclick: (e: Event) => {
            pulse(e.currentTarget as Element, 'wiggle');
            void say(w.word);
          },
        },
        picture(w),
        h('span', { class: 'name' }, w.example ?? w.word),
        s.box >= 3 && h('span', { class: 'wb-star' }, icon.star()),
      );
    });
    return h('section', { class: 'wb-topic', style: `--tint:${t.color}` }, head, h('div', { class: 'wb-grid' }, cells));
  });

  show(
    h(
      'main',
      { class: 'screen wordbook' },
      h(
        'header',
        { class: 'bar' },
        roundBtn(icon.home(), 'Home', () => {
          sfx.tap();
          home();
        }),
        h('h2', {}, `${metCount()} / ${words.length}`),
        h('span', { class: 'spacer' }),
      ),
      sections,
    ),
  );
}

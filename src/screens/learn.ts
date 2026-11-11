// Look and listen: flashcards.

import { h, pulse } from '../lib/dom';
import { wordsIn, stickers, describe, type Topic } from '../lib/content';
import { levelConfig, recordSeen, recordStars, awardSticker, pickLearnSet } from '../lib/progress';
import { say, hasVietnameseVoice } from '../lib/voice';
import { sfx } from '../lib/sfx';
import { icon, picture, roundBtn } from '../ui';
import { P, screenId, alive, show, persist, leave, lessonBar } from './core';
import { result } from './result';

// ---------- learn (flashcards) ----------

export function learn(t: Topic) {
  const list = pickLearnSet(wordsIn(t.id), levelConfig(P.settings.age).learnCount, P);
  let i = 0;
  const firstTime = !(P.best[`${t.id}:learn`] > 0);

  const render = () => {
    const id = screenId + 1;
    const w = list[i];
    recordSeen(P, w.id);
    persist();
    const speak = () => {
      const lines = [w.word, describe(w)];
      void say(lines).then(() => {
        if (alive(id) && P.settings.vietnamese && hasVietnameseVoice()) void say(w.vi, { lang: 'vi' });
      });
    };
    const card = h(
      'button',
      {
        class: 'card flash pop-in',
        'aria-label': w.word,
        onclick: () => {
          pulse(card, 'wiggle');
          speak();
        },
      },
      picture(w, 'lg'),
      h('span', { class: 'word' }, w.word),
    );
    const prev = roundBtn(icon.back(), 'Previous', () => {
      if (i > 0) {
        sfx.flip();
        i--;
        render();
      }
    }, 'big soft');
    prev.disabled = i === 0;
    const next = roundBtn(icon.next(), 'Next', () => {
      sfx.flip();
      if (i < list.length - 1) {
        i++;
        render();
      } else {
        recordStars(P, t.id, 'learn', 3);
        const sticker = firstTime ? awardSticker(P, stickers.map((s) => s.id)) : null;
        persist();
        result(t, 'learn', 3, sticker);
      }
    }, 'big go');
    show(
      h(
        'main',
        { class: 'screen lesson', style: `--tint:${t.color}` },
        lessonBar(() => leave(t), list.length, i),
        h('section', { class: 'stage' }, card),
        h('nav', { class: 'pager' }, prev, next),
      ),
    );
    // show() bumped screenId, so id === screenId now
    setTimeout(speak, 250);
  };
  render();
}

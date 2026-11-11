// Memory: turn over two cards at a time to find the pairs. Each card says its word.

import { h, wait, confetti } from '../lib/dom';
import { wordsIn, stickers, imgUrl, type Topic, type Word } from '../lib/content';
import { levelConfig, memoryStars, pickScene, shuffle, recordSeen, recordStars, awardSticker } from '../lib/progress';
import { say } from '../lib/voice';
import { sfx } from '../lib/sfx';
import { icon, picture, roundBtn, progressDots } from '../ui';
import { P, screenId, alive, show, persist, leave } from './core';
import { result } from './result';

export function memory(t: Topic) {
  const pairs = levelConfig(P.settings.age).pairs;
  // words the child knows least, like the other games
  const chosen = pickScene(wordsIn(t.id), pairs, pairs, P).targets;
  const deck = shuffle([...chosen, ...chosen]);
  let open: { btn: HTMLElement; w: Word }[] = [];
  let found = 0;
  let tries = 0;
  let busy = false;
  const dots = h('div', { class: 'dots-wrap' }, progressDots(chosen.length, 0));

  const cards = deck.map((w) => {
    const btn = h(
      'button',
      { class: 'flip', 'aria-label': 'Card' },
      h('span', { class: 'flip-in' }, h('span', { class: 'back' }, h('img', { src: imgUrl('mascot'), alt: '', draggable: false })), h('span', { class: 'front' }, picture(w))),
    );
    btn.addEventListener('click', () => void turn(btn, w));
    return btn;
  });

  const turn = async (btn: HTMLElement, w: Word) => {
    if (busy || btn.classList.contains('up')) return;
    const id = screenId;
    sfx.flip();
    btn.classList.add('up');
    btn.setAttribute('aria-label', w.word);
    open.push({ btn, w });
    if (open.length < 2) {
      void say(w.word);
      return;
    }
    busy = true;
    tries++;
    const [a, b] = open;
    open = [];
    if (a.w.id === b.w.id) {
      found++;
      recordSeen(P, w.id);
      persist();
      dots.replaceChildren(progressDots(chosen.length, found));
      await wait(250);
      if (!alive(id)) return;
      sfx.right();
      a.btn.classList.add('matched');
      b.btn.classList.add('matched');
      confetti(btn);
      await say([w.word, 'Yes!']);
      if (!alive(id)) return;
      if (found === chosen.length) {
        await wait(400);
        if (!alive(id)) return;
        const stars = memoryStars(tries, chosen.length);
        recordStars(P, t.id, 'memory', stars);
        const sticker = stars >= 2 ? awardSticker(P, stickers.map((s) => s.id)) : null;
        persist();
        return result(t, 'memory', stars, sticker);
      }
    } else {
      // no "wrong" here: the card just says its word and both turn back over
      await say(w.word);
      await wait(500);
      if (!alive(id)) return;
      for (const c of [a, b]) {
        c.btn.classList.remove('up');
        c.btn.setAttribute('aria-label', 'Card');
      }
    }
    busy = false;
  };

  show(
    h(
      'main',
      { class: 'screen lesson memory', style: `--tint:${t.color}` },
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
      h('section', { class: `scene deck s${deck.length}` }, cards),
    ),
  );
}

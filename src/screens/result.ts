// Stars and sticker after a game.

import { h, wait, confetti, confettiRain } from '../lib/dom';
import { imgUrl, stickers, type Topic } from '../lib/content';
import { markDay, overLimit, type Activity } from '../lib/progress';
import { say } from '../lib/voice';
import { sfx } from '../lib/sfx';
import { icon, starsRow, mascot, roundBtn, progressDots } from '../ui';
import { P, screenId, alive, show, SESSION_STEPS, session, nextStep, startActivity, persist } from './core';
import { rest } from './home';
import { topicScreen } from './topic';

// ---------- result ----------

/** Result of a game in a topic. In a today session it leads to the next game instead. */
export function result(t: Topic, a: Activity, stars: number, sticker: string | null) {
  if (session) {
    return resultScreen({ tint: t.color, stars, sticker, done: nextStep, steps: [SESSION_STEPS.length, session.i + 1] });
  }
  resultScreen({ tint: t.color, stars, sticker, again: () => startActivity(t, a), done: () => topicScreen(t) });
}

export interface ResultSpec {
  tint: string;
  stars: number;
  sticker: string | null;
  again?: () => void;
  done: () => void;
  /** [total, finished] games of a today session */
  steps?: [number, number];
}

export function resultScreen({ tint, stars, sticker, again, done, steps }: ResultSpec) {
  if (markDay(P)) persist();
  const row = starsRow(0, 3, 'big');
  const stickerImg = sticker ? stickers.find((s) => s.id === sticker)!.img : null;
  const prize = h('div', { class: 'prize' });
  // Play time may have run out during the game: the child still gets this screen, then rests.
  const go = (fn: () => void) => () => {
    sfx.tap();
    if (overLimit(P)) return rest();
    fn();
  };
  show(
    h(
      'main',
      { class: 'screen result', style: `--tint:${tint}` },
      mascot('hero bob'),
      row,
      prize,
      steps && progressDots(steps[0], steps[1]),
      h(
        'nav',
        { class: 'pager' },
        again && roundBtn(icon.again(), 'Play again', go(again), 'big soft'),
        roundBtn(icon.next(), steps ? 'Next' : 'Done', go(done), 'big go'),
      ),
    ),
  );
  const id = screenId;
  void (async () => {
    for (let i = 0; i < stars; i++) {
      await wait(380);
      if (!alive(id)) return;
      row.children[i].className = 'on pop-in';
      sfx.star(i);
    }
    await say(stars === 3 ? 'Great job!' : stars === 2 ? 'Well done!' : 'Good try! Let’s play again!');
    if (!alive(id)) return;
    if (stars === 3) confettiRain();
    if (!stickerImg) return;
    // The new sticker comes in a gift box. The child taps to open it; it opens by itself after a
    // moment so a child who does not tap still gets the sticker.
    const name = stickers.find((s) => s.id === sticker)!.name;
    let opened = false;
    const open = () => {
      if (opened || !alive(id)) return;
      opened = true;
      prize.replaceChildren(
        h('img', { class: 'sticker pop-in', src: stickerImg, alt: 'New sticker' }),
        h('span', { class: 'sticker-name pop-in' }, name),
      );
      sfx.sticker();
      confetti(prize, 24);
      void say(name);
    };
    const gift = h('button', { class: 'gift pop-in', 'aria-label': 'Open the gift', onclick: open }, h('img', { src: imgUrl('gift'), alt: '', draggable: false }));
    prize.replaceChildren(gift);
    sfx.star(2);
    await say('A new sticker for you!');
    await wait(2200);
    open();
  })();
}

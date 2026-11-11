// Stars and sticker after a game.

import { h, wait, confetti } from '../lib/dom';
import { stickers, type Topic } from '../lib/content';
import { overLimit, type Activity } from '../lib/progress';
import { say } from '../lib/voice';
import { sfx } from '../lib/sfx';
import { icon, starsRow, mascot, roundBtn, progressDots } from '../ui';
import { P, screenId, alive, show, SESSION_STEPS, session, nextStep, startActivity } from './core';
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
    if (stickerImg && alive(id)) {
      prize.replaceChildren(h('img', { class: 'sticker pop-in', src: stickerImg, alt: 'New sticker' }));
      sfx.sticker();
      confetti(prize, 20);
      void say(['A new sticker for you!', stickers.find((s) => s.id === sticker)!.name]);
    }
  })();
}

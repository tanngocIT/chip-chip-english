// The off-screen challenge that ends a Play session: Chip asks for something to do in the room.

import { h, wait, confettiRain } from '../lib/dom';
import { wordById, type Topic } from '../lib/content';
import { pickChallenge } from '../lib/challenges';
import { say } from '../lib/voice';
import { sfx } from '../lib/sfx';
import { icon, picture, mascot, roundBtn } from '../ui';
import { P, screenId, alive, show, endSession } from './core';
import { home } from './home';

/** the last challenge given, so the next one is a different one */
let last = '';

export function challenge(t: Topic) {
  endSession();
  const c = pickChallenge(t.id, P, last);
  if (!c) return home();
  last = c.text;
  let finished = false;

  const hear = (slow: boolean) => () => {
    sfx.tap();
    void say(c.text, { slow });
  };

  const done = roundBtn(icon.check(), 'I did it', async () => {
    if (finished) return;
    finished = true;
    const id = screenId;
    sfx.sticker();
    confettiRain();
    await say('Great job!');
    await wait(500);
    if (alive(id)) home();
  }, 'big go');

  show(
    h(
      'main',
      { class: 'screen lesson challenge', style: `--tint:${t.color}` },
      h(
        'header',
        { class: 'bar' },
        roundBtn(icon.home(), 'Home', () => {
          sfx.tap();
          home();
        }),
        h('span', { class: 'spacer' }),
        roundBtn(icon.speaker(), 'Hear again', hear(true), 'soft'),
      ),
      h('section', { class: 'stage mission' }, mascot('bob'), picture(c.word ?? wordById(t.icon)!, 'lg')),
      h('section', { class: 'prompt' }, h('button', { class: 'target-word pop-in', 'aria-label': `Hear: ${c.text}`, onclick: hear(true) }, c.text)),
      h('p', { class: 'mission-vi' }, c.vi),
      h('nav', { class: 'pager' }, done),
    ),
  );
  const id = screenId;
  setTimeout(() => alive(id) && void say(['Now it is your turn!', c.text]), 300);
}

// Odd one out: tap the picture that does not belong with the others.

import { h, wait, pulse, confetti } from '../lib/dom';
import { type Topic } from '../lib/content';
import { levelConfig } from '../lib/progress';
import { pickOddRounds } from '../lib/odd';
import { say } from '../lib/voice';
import { sfx } from '../lib/sfx';
import { icon, picture, roundBtn, chipCheer } from '../ui';
import { P, screenId, alive, show, leave, lessonBar } from './core';
import { finishQuiz } from './quiz';

const ASK = 'Which one is different?';

export function oddOneOut(t: Topic) {
  const cfg = levelConfig(P.settings.age);
  const rounds = pickOddRounds(t.id, cfg.oddRounds, cfg.oddChoices);
  if (!rounds.length) return leave(t);
  let round = 0;
  let firstTry = 0;

  const play = () => {
    const { options, odd } = rounds[round];
    let missed = false;
    let locked = false;

    const replay = roundBtn(icon.speaker(), 'Hear again', () => {
      sfx.tap();
      void say(ASK, { slow: true });
    }, 'soft');

    const ask = h(
      'button',
      {
        class: 'target-word pop-in',
        'aria-label': `Hear: ${ASK}`,
        onclick: () => {
          sfx.tap();
          void say(ASK, { slow: true });
        },
      },
      ASK,
    );

    const answered = async (btn: HTMLElement, id: string) => {
      if (locked) return;
      if (id !== odd.id) {
        missed = true;
        sfx.oops();
        pulse(btn, 'shake');
        btn.classList.add('dim');
        void say(['Try again.', ASK]);
        return;
      }
      locked = true;
      const sid = screenId;
      sfx.right();
      chipCheer();
      btn.classList.add('right');
      confetti(btn);
      if (!missed) firstTry++;
      // only the name of the picture just chosen, like the other games
      await say(odd.word);
      await wait(300);
      if (!alive(sid)) return;
      round++;
      if (round < rounds.length) play();
      else finishQuiz(t, 'odd', firstTry, rounds.length);
    };

    const optEls = options.map((o) => {
      const b = h('button', { class: 'card option', 'aria-label': o.word }, picture(o));
      b.addEventListener('click', () => void answered(b, o.id));
      return b;
    });

    show(
      h(
        'main',
        { class: 'screen lesson quiz listen odd', style: `--tint:${t.color}` },
        lessonBar(() => leave(t), rounds.length, round, replay),
        h('section', { class: 'prompt' }, ask),
        h('section', { class: `options n${options.length}` }, optEls),
      ),
    );
    // the question is the same every time: say it at the start, then let the child look
    if (round === 0) setTimeout(() => void say(ASK), 300);
  };
  play();
}

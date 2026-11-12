// Find it: many pictures in one scene.

import { h, wait, pulse, confetti } from '../lib/dom';
import { wordsIn, question, type Topic, type Word } from '../lib/content';
import { levelConfig, recordAnswer, pickScene } from '../lib/progress';
import { say } from '../lib/voice';
import { sfx } from '../lib/sfx';
import { icon, picture, roundBtn, progressDots, chipCheer } from '../ui';
import { P, screenId, alive, show, persist, leave } from './core';
import { finishQuiz } from './quiz';

// ---------- find it in the picture ----------

export function findIt(t: Topic) {
  const cfg = levelConfig(P.settings.age);
  const { items, targets } = pickScene(wordsIn(t.id), cfg.sceneItems, cfg.finds, P);
  let round = 0;
  let firstTry = 0;
  let missed = false;
  let locked = false;
  const found = new Set<string>();
  const dots = h('div', { class: 'dots-wrap' }, progressDots(targets.length, 0));

  const ask = (slow = false) => say(question(targets[round]), { slow });

  const replay = roundBtn(icon.speaker(), 'Hear again', () => {
    sfx.tap();
    if (!locked) void ask(true);
  }, 'soft');

  const tapped = async (btn: HTMLElement, o: Word) => {
    if (locked || found.has(o.id)) return;
    const w = targets[round];
    const id = screenId;
    if (o.id !== w.id) {
      missed = true;
      sfx.oops();
      pulse(btn, 'shake');
      void say(['Try again.', question(w)]);
      return;
    }
    locked = true;
    found.add(w.id);
    sfx.right();
    chipCheer();
    confetti(btn);
    btn.classList.add('found');
    recordAnswer(P, w.id, !missed);
    if (!missed) firstTry++;
    persist();
    round++;
    dots.replaceChildren(progressDots(targets.length, round));
    await say(w.word);
    await wait(300);
    if (!alive(id)) return;
    if (round >= targets.length) return finishQuiz(t, 'find', firstTry, targets.length);
    missed = false;
    locked = false;
    void ask();
  };

  const tilt = [-5, 4, -2, 6, -6, 3, 5, -3];
  const spots = items.map((o, i) => {
    const b = h(
      'button',
      { class: 'spot', 'aria-label': o.word, style: `--tilt:${tilt[i % tilt.length]}deg` },
      picture(o),
    );
    b.addEventListener('click', () => void tapped(b, o));
    return b;
  });

  show(
    h(
      'main',
      { class: 'screen lesson find', style: `--tint:${t.color}` },
      h(
        'header',
        { class: 'bar' },
        roundBtn(icon.back(), 'Back', () => {
          sfx.tap();
          leave(t);
        }),
        dots,
        replay,
      ),
      h('section', { class: `scene s${items.length}` }, spots),
    ),
  );
  setTimeout(() => void ask(), 400);
}

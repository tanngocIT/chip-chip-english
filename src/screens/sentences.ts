// Sentences: hear and read a short sentence, then tap the picture that shows it.

import { h, wait, pulse, confetti } from '../lib/dom';
import { stickers } from '../lib/content';
import { levelConfig, starsFor, awardSticker, overLimit } from '../lib/progress';
import { pickSentences, sentenceOptions, type Sentence } from '../lib/sentences';
import { say } from '../lib/voice';
import { sfx } from '../lib/sfx';
import { icon, picture, roundBtn, chipCheer } from '../ui';
import { P, screenId, alive, show, persist, lessonBar } from './core';
import { home, rest } from './home';
import { resultScreen } from './result';

const TINT = '#FFE9C4';

/** The picture for a sentence: the same thing several times, two things, or one thing big or small. */
function sceneView(s: Sentence) {
  const total = s.parts.reduce((n, p) => n + p.n, 0);
  return h(
    'div',
    { class: `mini ${s.kind} m${total}`, role: 'img', 'aria-label': s.text },
    s.parts.flatMap((p) => Array.from({ length: p.n }, () => picture(p.word, p.size ?? ''))),
  );
}

export function sentences() {
  if (overLimit(P)) return rest();
  const cfg = levelConfig(P.settings.age);
  const targets = pickSentences(cfg.sentenceRounds);
  if (!targets.length) return home();
  let round = 0;
  let firstTry = 0;

  const play = () => {
    const s = targets[round];
    const opts = sentenceOptions(s, cfg.sentenceChoices);
    let missed = false;
    let locked = false;

    const replay = roundBtn(icon.speaker(), 'Hear again', () => {
      sfx.tap();
      void say(s.text, { slow: true });
    }, 'soft');

    const text = h(
      'button',
      {
        class: 'target-word pop-in',
        'aria-label': `Hear: ${s.text}`,
        onclick: () => {
          sfx.tap();
          void say(s.text, { slow: true });
        },
      },
      s.text,
    );

    const answered = async (btn: HTMLElement, o: Sentence) => {
      if (locked) return;
      if (o.text !== s.text) {
        missed = true;
        sfx.oops();
        pulse(btn, 'shake');
        btn.classList.add('dim');
        void say(['Try again.', s.text]);
        return;
      }
      locked = true;
      const id = screenId;
      sfx.right();
      chipCheer();
      btn.classList.add('right');
      confetti(btn);
      if (!missed) firstTry++;
      // the sentence was just heard: the tick is enough
      await wait(900);
      if (!alive(id)) return;
      round++;
      if (round < targets.length) return play();
      const stars = starsFor(firstTry, targets.length);
      const sticker = stars >= 2 ? awardSticker(P, stickers.map((x) => x.id)) : null;
      persist();
      resultScreen({ tint: TINT, stars, sticker, again: sentences, done: home });
    };

    const optEls = opts.map((o) => {
      const b = h('button', { class: 'card option', 'aria-label': o.text }, sceneView(o));
      b.addEventListener('click', () => void answered(b, o));
      return b;
    });

    show(
      h(
        'main',
        { class: 'screen lesson quiz listen sentences', style: `--tint:${TINT}` },
        lessonBar(home, targets.length, round, replay),
        h('section', { class: 'prompt' }, text),
        h('section', { class: `options n${opts.length}` }, optEls),
      ),
    );
    setTimeout(() => void say(s.text), 300);
  };
  play();
}

// Listen and tap, Find the shadow and Review share one quiz.

import { h, wait, pulse, confetti } from '../lib/dom';
import { words, wordsIn, topicById, stickers, question, type Topic, type Word } from '../lib/content';
import { levelConfig, starsFor, recordAnswer, recordStars, awardSticker, pickTargets, pickReviewSet, REVIEW_MIN, overLimit, choicesFor, type Activity } from '../lib/progress';
import { say } from '../lib/voice';
import { sfx } from '../lib/sfx';
import { icon, picture, roundBtn, chipCheer } from '../ui';
import { P, screenId, alive, show, persist, leave, lessonBar } from './core';
import { home, rest } from './home';
import { result, resultScreen } from './result';

// ---------- listen & tap / shadow match ----------

export function quiz(t: Topic, mode: 'listen' | 'match') {
  const pool = wordsIn(t.id);
  runQuiz({
    mode,
    targets: pickTargets(pool, levelConfig(P.settings.age).rounds, P),
    poolFor: () => pool,
    tintFor: () => t.color,
    back: () => leave(t),
    done: (firstTry, rounds) => finishQuiz(t, mode, firstTry, rounds),
  });
}

/** Review: Listen and tap over the words the child finds hard, from every topic. */
export function review() {
  if (overLimit(P)) return rest();
  const targets = pickReviewSet(words, levelConfig(P.settings.age).rounds, P);
  if (targets.length < REVIEW_MIN) return home();
  const tint = (w: Word) => topicById(w.topic)?.color ?? '#ffe3b8';
  runQuiz({
    mode: 'listen',
    targets,
    // other pictures come from the word's own topic, so the question still makes sense
    poolFor: (w) => wordsIn(w.topic),
    tintFor: tint,
    back: home,
    done: (firstTry, rounds) => {
      const stars = starsFor(firstTry, rounds);
      const sticker = stars >= 2 ? awardSticker(P, stickers.map((s) => s.id)) : null;
      persist();
      resultScreen({ tint: tint(targets[targets.length - 1]), stars, sticker, again: review, done: home });
    },
  });
}

export interface QuizSpec {
  mode: 'listen' | 'match';
  targets: Word[];
  poolFor: (w: Word) => Word[];
  tintFor: (w: Word) => string;
  back: () => void;
  done: (firstTry: number, rounds: number) => void;
}

export function runQuiz(q: QuizSpec) {
  const { mode, targets } = q;
  const { choices } = levelConfig(P.settings.age);
  let round = 0;
  let firstTry = 0;

  const play = () => {
    const w = targets[round];
    const pool = q.poolFor(w);
    const opts = choicesFor(w, pool, Math.min(choices, pool.length));
    let missed = false;
    let locked = false;
    const prompt = () => say(mode === 'listen' ? question(w) : 'Which one fits the shadow?');

    const replay = roundBtn(icon.speaker(), 'Hear again', () => {
      sfx.tap();
      void (mode === 'listen' ? say(question(w), { slow: true }) : say(['Which one fits the shadow?']));
    }, 'soft');

    // The word appears under the shadow only after the right picture is in place,
    // so the game stays about shapes but still ends on the written word.
    const shadowWord = h('span', { class: 'word' }, w.word);
    const drop = mode === 'match' ? h('div', { class: 'drop' }, picture(w, 'lg shadow'), shadowWord) : null;

    // The word being asked, written big so the child links the sound to the letters.
    const wordTag =
      mode === 'listen'
        ? h(
            'button',
            {
              class: 'target-word pop-in',
              'aria-label': `Hear ${w.word}`,
              onclick: () => {
                sfx.tap();
                void say(w.word, { slow: true });
              },
            },
            w.word,
          )
        : null;

    const answered = async (btn: HTMLElement, o: Word) => {
      if (locked) return;
      if (o.id === w.id) {
        locked = true;
        const id = screenId;
        sfx.right();
        chipCheer();
        btn.classList.add('right');
        confetti(btn);
        if (drop) {
          drop.replaceChildren(picture(w, 'lg pop-in'), shadowWord);
          drop.classList.add('filled');
          btn.classList.add('gone');
        }
        recordAnswer(P, w.id, !missed);
        if (!missed) firstTry++;
        persist();
        await say(w.word);
        await wait(300);
        if (!alive(id)) return;
        round++;
        if (round < targets.length) play();
        else q.done(firstTry, targets.length);
      } else {
        missed = true;
        sfx.oops();
        pulse(btn, 'shake');
        btn.classList.add('dim');
        void say(mode === 'listen' ? ['Try again.', question(w)] : ['Try again.']);
      }
    };

    const optEls = opts.map((o) => {
      const b = h('button', { class: 'card option', 'aria-label': o.word }, picture(o));
      b.addEventListener('click', () => void answered(b, o));
      if (mode === 'match') enableDrag(b, () => drop!, () => void answered(b, o));
      return b;
    });

    show(
      h(
        'main',
        { class: `screen lesson quiz ${mode}`, style: `--tint:${q.tintFor(w)}` },
        lessonBar(q.back, targets.length, round, replay),
        drop && h('section', { class: 'stage' }, drop),
        wordTag && h('section', { class: 'prompt' }, wordTag),
        h('section', { class: `options n${opts.length}` }, optEls),
      ),
    );
    setTimeout(() => void prompt(), 300);
  };
  play();
}

/** Drag an option onto the drop zone; a drop counts as a tap. Small moves stay a normal tap. */
function enableDrag(el: HTMLElement, zone: () => HTMLElement, onDrop: () => void) {
  let sx = 0,
    sy = 0,
    dragging = false,
    id = -1;
  el.addEventListener('pointerdown', (e) => {
    id = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
    dragging = false;
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - sx,
      dy = e.clientY - sy;
    if (!dragging && Math.hypot(dx, dy) > 12) {
      dragging = true;
      el.setPointerCapture(id);
      el.classList.add('dragging');
    }
    if (dragging) el.style.transform = `translate(${dx}px, ${dy}px) scale(1.06)`;
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = -1;
    if (!dragging) return;
    el.classList.remove('dragging');
    el.style.transform = '';
    const z = zone().getBoundingClientRect();
    const inside = e.clientX > z.left && e.clientX < z.right && e.clientY > z.top && e.clientY < z.bottom;
    // swallow the click that follows a drag
    el.addEventListener('click', (c) => c.stopImmediatePropagation(), { capture: true, once: true });
    if (inside) onDrop();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

export function finishQuiz(t: Topic, a: Activity, firstTry: number, rounds: number) {
  const stars = starsFor(firstTry, rounds);
  recordStars(P, t.id, a, stars);
  const sticker = stars >= 2 ? awardSticker(P, stickers.map((s) => s.id)) : null;
  persist();
  result(t, a, stars, sticker);
}

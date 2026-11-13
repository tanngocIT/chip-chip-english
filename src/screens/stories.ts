// Stories: pick a picture story, read its four pages, then answer two questions about it.

import { h, wait, pulse, confetti } from '../lib/dom';
import { stickers } from '../lib/content';
import { levelConfig, starsFor, awardSticker, overLimit } from '../lib/progress';
import { stories, spokenTitle, questionOptions, type Story } from '../lib/stories';
import { say } from '../lib/voice';
import { sfx } from '../lib/sfx';
import { icon, picture, roundBtn, chipCheer } from '../ui';
import { P, screenId, alive, show, persist, announce, lessonBar } from './core';
import { home, rest } from './home';
import { resultScreen } from './result';

const TINT = '#E4DBFF';

export function storyList() {
  if (overLimit(P)) return rest();
  const tiles = stories.map((s, i) => {
    const read = P.stories.includes(s.id);
    return h(
      'button',
      {
        class: 'topic story-tile',
        style: `--tint:${TINT}; --i:${i}`,
        'aria-label': s.title,
        onclick: (e: Event) => {
          sfx.tap();
          void announce(e.currentTarget as HTMLElement, spokenTitle(s), () => readStory(s));
        },
      },
      picture(s.cover, 'sm'),
      h('span', { class: 'label' }, s.title),
      read && h('span', { class: 'mini-stars' }, icon.star()),
    );
  });
  show(
    h(
      'main',
      { class: 'screen stories' },
      h(
        'header',
        { class: 'bar' },
        roundBtn(icon.home(), 'Home', () => {
          sfx.tap();
          home();
        }),
        h('h2', {}, 'Stories'),
        h('span', { class: 'spacer' }),
      ),
      h('section', { class: 'topics' }, tiles),
    ),
  );
}

export function readStory(s: Story) {
  if (overLimit(P)) return rest();
  const total = s.pages.length + s.questions.length;
  let firstTry = 0;

  const page = (i: number) => {
    const p = s.pages[i];
    const hear = (slow: boolean) => () => {
      sfx.tap();
      void say(p.text, { slow });
    };
    const prev = roundBtn(icon.back(), 'Previous', () => {
      sfx.flip();
      page(i - 1);
    }, 'big soft');
    prev.disabled = i === 0;
    const next = roundBtn(icon.next(), 'Next', () => {
      sfx.flip();
      if (i < s.pages.length - 1) page(i + 1);
      else question(0);
    }, 'big go');
    show(
      h(
        'main',
        { class: 'screen lesson story', style: `--tint:${TINT}` },
        lessonBar(storyList, total, i, roundBtn(icon.speaker(), 'Hear again', hear(true), 'soft')),
        h('section', { class: 'stage' }, h('div', { class: `card panel-pics p${p.pics.length} pop-in`, role: 'img', 'aria-label': p.text }, p.pics.map((w) => picture(w)))),
        h('section', { class: 'prompt' }, h('button', { class: 'target-word', 'aria-label': `Hear: ${p.text}`, onclick: hear(true) }, p.text)),
        h('nav', { class: 'pager' }, prev, next),
      ),
    );
    const id = screenId;
    setTimeout(() => alive(id) && void say(p.text), 300);
  };

  const question = (n: number) => {
    const q = s.questions[n];
    const opts = questionOptions(q, levelConfig(P.settings.age).sentenceChoices);
    let missed = false;
    let locked = false;
    const hear = () => {
      sfx.tap();
      void say(q.text, { slow: true });
    };

    const answered = async (btn: HTMLElement, id: string) => {
      if (locked) return;
      if (id !== q.answer.id) {
        missed = true;
        sfx.oops();
        pulse(btn, 'shake');
        btn.classList.add('dim');
        void say(['Try again.', q.text]);
        return;
      }
      locked = true;
      const sid = screenId;
      sfx.right();
      chipCheer();
      btn.classList.add('right');
      confetti(btn);
      if (!missed) firstTry++;
      await say(q.answer.word);
      await wait(300);
      if (!alive(sid)) return;
      if (n < s.questions.length - 1) return question(n + 1);
      // a sticker only the first time a story is finished, so re-reading is for the story's sake
      const stars = starsFor(firstTry, s.questions.length);
      const firstTime = !P.stories.includes(s.id);
      if (firstTime) P.stories.push(s.id);
      const sticker = firstTime ? awardSticker(P, stickers.map((x) => x.id)) : null;
      persist();
      resultScreen({ tint: TINT, stars, sticker, again: () => readStory(s), done: storyList });
    };

    const optEls = opts.map((o) => {
      const b = h('button', { class: 'card option', 'aria-label': o.word }, picture(o));
      b.addEventListener('click', () => void answered(b, o.id));
      return b;
    });
    show(
      h(
        'main',
        { class: 'screen lesson quiz listen story-q', style: `--tint:${TINT}` },
        lessonBar(storyList, total, s.pages.length + n, roundBtn(icon.speaker(), 'Hear again', hear, 'soft')),
        h('section', { class: 'prompt' }, h('button', { class: 'target-word pop-in', 'aria-label': `Hear: ${q.text}`, onclick: hear }, q.text)),
        h('section', { class: `options n${opts.length}` }, optEls),
      ),
    );
    const id = screenId;
    setTimeout(() => alive(id) && void say(q.text), 300);
  };

  page(0);
}

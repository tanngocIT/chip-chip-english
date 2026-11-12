// Splash, home, sticker book and the rest screen.

import { h, pulse } from '../lib/dom';
import { topics, words, wordsIn, wordById, stickers } from '../lib/content';
import { levelConfig, topicStars, pickReviewSet, pickTodayTopic, REVIEW_MIN, overLimit } from '../lib/progress';
import { say, canSpeak } from '../lib/voice';
import { sfx, unlockAudio } from '../lib/sfx';
import { icon, picture, mascot, roundBtn } from '../ui';
import { P, show, startToday, announce, endSession } from './core';
import { topicScreen } from './topic';
import { sentences } from './sentences';
import { review } from './quiz';
import { parentGate } from './parents';

// ---------- splash ----------

export function splash() {
  const btn = h(
    'button',
    {
      class: 'play-big',
      'aria-label': 'Play',
      onclick: () => {
        unlockAudio();
        sfx.tap();
        void say("Hi! I'm Chip. Let's play!");
        home();
      },
    },
    h('span', { class: 'tri' }),
  );
  show(
    h(
      'main',
      { class: 'screen splash' },
      mascot('hero bob'),
      h('h1', { class: 'brand' }, 'Chip Chip', h('span', {}, 'English')),
      btn,
      !canSpeak() && h('p', { class: 'note' }, 'Trình duyệt này không có giọng đọc. Hãy dùng Chrome hoặc Safari.'),
    ),
  );
}

// ---------- home ----------

let shownTotal: number | null = null;

export function home() {
  endSession();
  if (overLimit(P)) return rest();

  // One tap starts today's session, so a small child does not have to choose anything.
  const todayTopic = pickTodayTopic(topics, (t) => wordsIn(t.id).map((w) => w.id), P);
  const today = h(
    'button',
    {
      class: 'quick today',
      style: `--tint:${todayTopic.color}`,
      'aria-label': `Play: ${todayTopic.en}`,
      onclick: () => {
        sfx.tap();
        void announce(today, "Let's play!", () => startToday(todayTopic));
      },
    },
    picture(wordById(todayTopic.icon)!, 'sm'),
    h('span', { class: 'label' }, 'Play'),
    h('span', { class: 'go-mark' }, h('span', { class: 'tri' })),
  );

  // Review: words from every topic that the child has met but does not know yet.
  const reviewWords = pickReviewSet(words, levelConfig(P.settings.age).rounds, P);
  const reviewBtn =
    reviewWords.length >= REVIEW_MIN &&
    h(
      'button',
      {
        class: 'quick small review',
        'aria-label': 'Review',
        onclick: (e: Event) => {
          sfx.tap();
          void announce(e.currentTarget as HTMLElement, "Let's play again!", review);
        },
      },
      h('span', { class: 'pile' }, reviewWords.slice(0, 3).map((w) => picture(w, 'sm'))),
      h('span', { class: 'label' }, 'Review'),
    );

  // Sentences: only for the older children (the youngest group has no rounds).
  const sentenceBtn =
    levelConfig(P.settings.age).sentenceRounds > 0 &&
    h(
      'button',
      {
        class: 'quick small sentences-btn',
        'aria-label': 'Sentences',
        onclick: (e: Event) => {
          sfx.tap();
          void announce(e.currentTarget as HTMLElement, "Let's play!", sentences);
        },
      },
      h('span', { class: 'pile' }, ['cat', 'dog'].map((id) => picture(wordById(id)!, 'sm'))),
      h('span', { class: 'label' }, 'Sentences'),
    );

  const total = topics.reduce((s, t) => s + topicStars(P, t.id), 0);
  // New stars since the child last saw this screen are counted up one by one.
  const from = Math.min(shownTotal ?? total, total);
  shownTotal = total;
  const count = h('b', {}, from);
  const totalEl = h('div', { class: 'total' }, icon.star(), count);
  if (total > from) {
    let n = from;
    const step = Math.max(1, Math.ceil((total - from) / 12));
    const tick = () => {
      if (!count.isConnected) return;
      n = Math.min(total, n + step);
      count.textContent = String(n);
      pulse(totalEl, 'bump');
      sfx.star(1);
      if (n < total) setTimeout(tick, 140);
    };
    setTimeout(tick, 500);
  }
  const tiles = topics.map((t, i) => {
    const iconWord = wordById(t.icon)!;
    const stars = topicStars(P, t.id);
    return h(
      'button',
      {
        class: 'topic',
        style: `--tint:${t.color}; --i:${i}`,
        onclick: () => {
          sfx.tap();
          void say(t.en);
          topicScreen(t);
        },
      },
      picture(iconWord, 'sm'),
      h('span', { class: 'label' }, t.en),
      stars > 0 && h('span', { class: 'mini-stars' }, icon.star(), stars),
    );
  });

  const parentBtn = holdButton(() => parentGate());

  show(
    h(
      'main',
      { class: 'screen home' },
      h(
        'header',
        { class: 'top' },
        h(
          'button',
          {
            class: 'mascot-btn',
            'aria-label': 'Chip',
            onclick: (e: Event) => {
              pulse(e.currentTarget as Element, 'wiggle');
              void say(['Hello!', 'Pick a picture!']);
            },
          },
          mascot(),
        ),
        totalEl,
      ),
      h('section', { class: 'quicks' }, today, reviewBtn, sentenceBtn),
      h('section', { class: 'topics' }, tiles),
      h(
        'footer',
        { class: 'bottom' },
        h(
          'button',
          {
            class: 'book-btn',
            'aria-label': 'Stickers',
            onclick: () => {
              sfx.tap();
              void say('My stickers');
              stickerBook();
            },
          },
          h('img', { src: stickers[0].img, alt: '' }),
          h('b', {}, `${P.stickers.length}`),
        ),
        parentBtn,
      ),
    ),
  );
}

/** Grown-ups button: needs a 1.5 s press so little fingers don't open it by accident. */
export function holdButton(onDone: () => void) {
  let t: number | undefined;
  const btn = h('button', { class: 'grownup', 'aria-label': 'Dành cho bố mẹ (giữ để mở)' }, icon.gear(), h('i', { class: 'fill' }));
  const start = (e: Event) => {
    e.preventDefault();
    btn.classList.add('holding');
    t = window.setTimeout(() => {
      btn.classList.remove('holding');
      onDone();
    }, 1500);
  };
  const end = () => {
    btn.classList.remove('holding');
    clearTimeout(t);
  };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', end);
  btn.addEventListener('pointerleave', end);
  btn.addEventListener('pointercancel', end);
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') onDone();
  });
  return btn;
}

// ---------- stickers ----------

export function stickerBook() {
  const items = stickers.map((s) => {
    const have = P.stickers.includes(s.id);
    if (!have) return h('div', { class: 'slot' }, h('img', { src: s.img, alt: '', draggable: false }));
    // a sticker the child owns says its name
    return h(
      'button',
      {
        class: 'slot have',
        'aria-label': s.name,
        onclick: (e: Event) => {
          pulse(e.currentTarget as Element, 'wiggle');
          void say(s.name);
        },
      },
      h('img', { src: s.img, alt: '', draggable: false }),
      h('span', { class: 'name' }, s.name),
    );
  });
  show(
    h(
      'main',
      { class: 'screen book' },
      h(
        'header',
        { class: 'bar' },
        roundBtn(icon.home(), 'Home', () => {
          sfx.tap();
          home();
        }),
        h('h2', {}, `${P.stickers.length} / ${stickers.length}`),
        h('span', { class: 'spacer' }),
      ),
      h('section', { class: 'slots' }, items),
    ),
  );
}

// ---------- rest (daily limit) ----------

export function rest() {
  endSession();
  show(
    h(
      'main',
      { class: 'screen splash rest' },
      mascot('hero sleepy'),
      h('h1', { class: 'brand small' }, 'Time to rest'),
      h('p', { class: 'note' }, 'Hôm nay bé đã chơi đủ giờ rồi. Bố mẹ giữ nút bánh răng để mở thêm.'),
      holdButton(() => parentGate()),
    ),
  );
  void say(['Time to rest.', 'See you later!']);
}

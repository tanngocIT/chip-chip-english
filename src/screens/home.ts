// Splash, home, sticker book and the rest screen.

import { h, pulse } from '../lib/dom';
import { topics, words, wordsIn, wordById, stickers, imgUrl } from '../lib/content';
import { levelConfig, topicStars, pickReviewSet, pickTodayTopic, REVIEW_MIN, overLimit, currentStreak, unlockedLooks, LOOKS } from '../lib/progress';
import { say, canSpeak } from '../lib/voice';
import { sfx, unlockAudio } from '../lib/sfx';
import { icon, picture, mascot, roundBtn, chip, setChipLook } from '../ui';
import { P, show, persist, startToday, announce, endSession } from './core';
import { topicScreen } from './topic';
import { sentences } from './sentences';
import { review } from './quiz';
import { parentGate } from './parents';
import { storyList } from './stories';
import { wordBook, metCount } from './wordbook';
import { stickerScene } from './scene';
import { updateState, onUpdateChange, buildLabel } from '../lib/update';

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
  // For the grown-up: which version this is, and whether a new one is on its way. The switch
  // itself happens by itself (lib/update.ts); this only says why the screen is about to reload.
  const version = h('p', { class: 'version', 'aria-live': 'polite' });
  const tell = () => {
    if (!version.isConnected) return onUpdateChange(null);
    const s = updateState();
    version.textContent = s === 'downloading' ? 'Đang tải bản mới…' : s === 'ready' ? 'Đang chuyển sang bản mới…' : buildLabel() ? `Bản ${buildLabel()}` : '';
    version.classList.toggle('busy', s !== 'none');
  };
  show(
    h(
      'main',
      { class: 'screen splash' },
      mascot('hero bob'),
      h('h1', { class: 'brand' }, 'Chip Chip', h('span', {}, 'English')),
      btn,
      !canSpeak() && h('p', { class: 'note' }, 'Trình duyệt này không có giọng đọc. Hãy dùng Chrome hoặc Safari.'),
      version,
    ),
  );
  onUpdateChange(tell);
  tell();
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

  // Stories: for the same older children as Sentences.
  const storyBtn =
    levelConfig(P.settings.age).sentenceRounds > 0 &&
    h(
      'button',
      {
        class: 'quick small stories-btn',
        'aria-label': 'Stories',
        onclick: (e: Event) => {
          sfx.tap();
          void announce(e.currentTarget as HTMLElement, "Let's read a story!", storyList);
        },
      },
      h('span', { class: 'pile' }, ['bear', 'moon'].map((id) => picture(wordById(id)!, 'sm'))),
      h('span', { class: 'label' }, 'Stories'),
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

  // days in a row with a finished game
  const days = currentStreak(P);
  const streakEl =
    days > 0 && h('div', { class: 'streak', 'aria-label': `${days} days in a row` }, h('img', { src: imgUrl('fire'), alt: '' }), h('b', {}, days));
  // a dot on the sticker book when a new thing for Chip to wear is waiting there
  const newLook = unlockedLooks(P.stickers.length).length > P.looksSeen;

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
        h('div', { class: 'counters' }, streakEl, totalEl),
      ),
      h('section', { class: 'quicks' }, today, reviewBtn, sentenceBtn, storyBtn),
      h('section', { class: 'topics' }, tiles),
      h(
        'footer',
        { class: 'bottom' },
        h(
          'div',
          { class: 'books' },
          h(
            'button',
            {
              class: `book-btn ${newLook ? 'new' : ''}`,
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
          // every word the child has met, to look through and hear again
          h(
            'button',
            {
              class: 'book-btn words-btn',
              'aria-label': 'My words',
              onclick: () => {
                sfx.tap();
                void say('My words');
                wordBook();
              },
            },
            h('img', { src: wordById('book')!.img, alt: '' }),
            h('b', {}, `${metCount()}`),
          ),
        ),
        parentBtn,
      ),
    ),
  );
}

export const HOLD_MS = 1500;

/**
 * Grown-ups button: needs a 1.5 s press so little fingers don't open it by accident.
 *
 * A real finger is not a test click, so the press is followed in the most forgiving way:
 *  - a finger is tracked with touch events. On phones a long press makes the browser think of
 *    its own long-press menu, and it then cancels the pointer events half-way through the hold;
 *    touch events whose default was prevented are left alone.
 *  - the press only ends when the finger or mouse button lifts, or strays far from the button.
 *    Rolling a thumb a few pixels off a small round button must not start the wait again.
 *  - a short tap gets a hint, because nothing on the button says it has to be held.
 */
export function holdButton(onDone: () => void) {
  let timer: number | undefined;
  let startedAt = 0;
  let origin: [number, number] | null = null;
  const btn = h('button', { class: 'grownup', 'aria-label': 'Dành cho bố mẹ (giữ để mở)' }, icon.gear(), h('i', { class: 'fill' }));

  const start = (x: number, y: number) => {
    clearTimeout(timer);
    document.querySelector('.hold-hint')?.remove();
    origin = [x, y];
    startedAt = Date.now();
    btn.classList.add('holding');
    timer = window.setTimeout(() => {
      origin = null;
      btn.classList.remove('holding');
      onDone();
    }, HOLD_MS);
  };
  const end = (hint: boolean) => {
    if (!origin) return;
    origin = null;
    btn.classList.remove('holding');
    clearTimeout(timer);
    if (hint && btn.isConnected && Date.now() - startedAt < HOLD_MS) showHoldHint(btn);
  };
  /** Far from where the press began: the finger has left for good. */
  const strayed = (x: number, y: number) => !!origin && Math.hypot(x - origin[0], y - origin[1]) > 70;

  const hasTouch = 'ontouchstart' in window;
  if (hasTouch) {
    btn.addEventListener(
      'touchstart',
      (e) => {
        // no long-press menu, no text selection, no made-up mouse events after the touch
        e.preventDefault();
        const t = e.changedTouches[0];
        start(t.clientX, t.clientY);
      },
      { passive: false },
    );
    btn.addEventListener('touchmove', (e) => {
      const t = e.changedTouches[0];
      if (strayed(t.clientX, t.clientY)) end(false);
    });
    btn.addEventListener('touchend', () => end(true));
    btn.addEventListener('touchcancel', () => end(false));
  }
  btn.addEventListener('pointerdown', (e) => {
    if (hasTouch && e.pointerType === 'touch') return; // followed by the touch events above
    e.preventDefault();
    try {
      // keep getting the moves and the release even when the pointer slips off the button
      btn.setPointerCapture(e.pointerId);
    } catch {
      /* not a live pointer */
    }
    start(e.clientX, e.clientY);
  });
  btn.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch' && strayed(e.clientX, e.clientY)) end(false);
  });
  btn.addEventListener('pointerup', (e) => {
    if (!(hasTouch && e.pointerType === 'touch')) end(true);
  });
  btn.addEventListener('pointercancel', (e) => {
    if (!(hasTouch && e.pointerType === 'touch')) end(false);
  });
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') onDone();
  });
  return btn;
}

/** Tell a grown-up who only tapped that the button has to be held. Gone after a moment. */
function showHoldHint(btn: HTMLElement) {
  document.querySelector('.hold-hint')?.remove();
  const r = btn.getBoundingClientRect();
  const hint = h('div', { class: 'hold-hint', role: 'status' }, 'Bố mẹ giữ nút này 2 giây');
  hint.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
  hint.style.bottom = `${window.innerHeight - r.top + 10}px`;
  document.body.appendChild(hint);
  setTimeout(() => hint.remove(), 2600);
}

// ---------- stickers ----------

export function stickerBook() {
  // Things Chip can wear. Each one unlocks at a number of stickers; tapping one puts it on or takes it off.
  const have = P.stickers.length;
  const open = unlockedLooks(have).length;
  if (P.looksSeen !== open) {
    P.looksSeen = open;
    persist();
  }
  const lookBtns = LOOKS.map((l) => {
    const ok = have >= l.need;
    return h(
      'button',
      {
        class: `look ${ok ? '' : 'locked'} ${P.look === l.id ? 'sel' : ''}`,
        'aria-label': ok ? l.name : `${l.need} stickers`,
        onclick: (e: Event) => {
          if (!ok) {
            sfx.oops();
            pulse(e.currentTarget as Element, 'shake');
            return;
          }
          sfx.tap();
          const on = P.look !== l.id;
          P.look = on ? l.id : null;
          persist();
          setChipLook(P.look);
          stickerBook();
          if (on) void say(l.name);
        },
      },
      h('img', { src: imgUrl(`look-${l.id}`), alt: '', draggable: false }),
      !ok && h('span', { class: 'need' }, h('img', { src: stickers[0].img, alt: '' }), l.need),
    );
  });
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
        // the child's own picture, made with the stickers they have
        have > 0
          ? roundBtn(icon.picture(), 'My picture', () => {
              sfx.tap();
              void say('My picture');
              stickerScene();
            }, 'soft scene-btn')
          : h('span', { class: 'spacer' }),
      ),
      h('section', { class: 'wardrobe' }, chip('model bob'), h('div', { class: 'looks' }, lookBtns)),
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

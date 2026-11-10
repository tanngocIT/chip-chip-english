import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import './style.css';

import { h, wait, pulse, confetti } from './lib/dom';
import {
  topics,
  wordsIn,
  wordById,
  topicById,
  stickers,
  describe,
  question,
  type Topic,
  type Word,
  imgUrl,
} from './lib/content';
import {
  load,
  save,
  levelConfig,
  starsFor,
  recordAnswer,
  recordSeen,
  recordStars,
  awardSticker,
  topicStars,
  learnedCount,
  pickTargets,
  pickLearnSet,
  choicesFor,
  addMinutes,
  overLimit,
  emptyProgress,
  type Activity,
  type AgeLevel,
} from './lib/progress';
import {
  initVoice,
  say,
  stopSpeaking,
  setRate,
  canListen,
  listen,
  hasVietnameseVoice,
  canSpeak,
  canRecord,
  openMic,
  closeMic,
  startRecording,
  playClip,
  stopClip,
  markRecordingClash,
} from './lib/voice';
import { passes } from './lib/match';
import { viNumber } from './lib/vi';
import { sfx, unlockAudio } from './lib/sfx';
import { icon, picture, starsRow, mascot, roundBtn, progressDots } from './ui';

const app = document.getElementById('app')!;
const P = load();
setRate(P.settings.rate);
initVoice();

let cleanup: (() => void) | null = null;
let inParentArea = false;

/** Each navigation bumps this so that stale async steps of an old screen stop. */
let screenId = 0;
const alive = (id: number) => id === screenId;

function show(node: HTMLElement, onLeave?: () => void) {
  cleanup?.();
  cleanup = onLeave ?? null;
  stopSpeaking();
  stopClip();
  if (!node.classList.contains('sayit')) closeMic();
  screenId++;
  app.replaceChildren(node);
  window.scrollTo(0, 0);
}

const persist = () => save(P);

// ---------- splash ----------

function splash() {
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

function home() {
  if (overLimit(P)) return rest();
  const total = topics.reduce((s, t) => s + topicStars(P, t.id), 0);
  const tiles = topics.map((t) => {
    const iconWord = wordById(t.icon)!;
    const stars = topicStars(P, t.id);
    return h(
      'button',
      {
        class: 'topic',
        style: `--tint:${t.color}`,
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
        h('div', { class: 'total' }, icon.star(), h('b', {}, total)),
      ),
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
function holdButton(onDone: () => void) {
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

// ---------- topic ----------

const ACTIVITIES: { id: Activity; name: string; img: string; silhouette?: boolean }[] = [
  { id: 'learn', name: 'Look and listen', img: imgUrl('eye') },
  { id: 'listen', name: 'Listen and tap', img: imgUrl('ear') },
  { id: 'match', name: 'Find the shadow', img: '', silhouette: true },
  { id: 'say', name: 'Say it', img: imgUrl('mouth') },
];

function topicScreen(t: Topic) {
  const iconWord = wordById(t.icon)!;
  const acts = ACTIVITIES.filter((a) => a.id !== 'say' || canListen()).map((a) => {
    const best = P.best[`${t.id}:${a.id}`] ?? 0;
    const art = a.silhouette ? picture(iconWord, 'shadow') : h('div', { class: 'pic' }, h('img', { src: a.img, alt: '' }));
    return h(
      'button',
      {
        class: `activity act-${a.id}`,
        onclick: () => {
          sfx.tap();
          startActivity(t, a.id);
        },
      },
      art,
      h('span', { class: 'label' }, a.name),
      starsRow(best, 3, 'sm'),
    );
  });

  show(
    h(
      'main',
      { class: 'screen topic-screen', style: `--tint:${t.color}` },
      h(
        'header',
        { class: 'bar' },
        roundBtn(icon.home(), 'Home', () => {
          sfx.tap();
          home();
        }),
        h('h2', {}, picture(iconWord, 'xs'), t.en),
        h('span', { class: 'spacer' }),
      ),
      h('section', { class: 'activities' }, acts),
    ),
  );
}

function startActivity(t: Topic, a: Activity) {
  if (overLimit(P)) return rest();
  if (a === 'learn') return learn(t);
  if (a === 'listen') return quiz(t, 'listen');
  if (a === 'match') return quiz(t, 'match');
  return sayIt(t);
}

function lessonBar(t: Topic, total: number, done: number, extra?: HTMLElement) {
  return h(
    'header',
    { class: 'bar' },
    roundBtn(icon.back(), 'Back', () => {
      sfx.tap();
      topicScreen(t);
    }),
    progressDots(total, done),
    extra ?? h('span', { class: 'spacer' }),
  );
}

// ---------- learn (flashcards) ----------

function learn(t: Topic) {
  const list = pickLearnSet(wordsIn(t.id), levelConfig(P.settings.age).learnCount, P);
  let i = 0;
  const firstTime = !(P.best[`${t.id}:learn`] > 0);

  const render = () => {
    const id = screenId + 1;
    const w = list[i];
    recordSeen(P, w.id);
    persist();
    const speak = () => {
      const lines = [w.word, describe(w)];
      void say(lines).then(() => {
        if (alive(id) && P.settings.vietnamese && hasVietnameseVoice()) void say(w.vi, { lang: 'vi' });
      });
    };
    const card = h(
      'button',
      {
        class: 'card flash pop-in',
        'aria-label': w.word,
        onclick: () => {
          pulse(card, 'wiggle');
          speak();
        },
      },
      picture(w, 'lg'),
      h('span', { class: 'word' }, w.word),
    );
    const prev = roundBtn(icon.back(), 'Previous', () => {
      if (i > 0) {
        sfx.flip();
        i--;
        render();
      }
    }, 'big soft');
    prev.disabled = i === 0;
    const next = roundBtn(icon.next(), 'Next', () => {
      sfx.flip();
      if (i < list.length - 1) {
        i++;
        render();
      } else {
        recordStars(P, t.id, 'learn', 3);
        const sticker = firstTime ? awardSticker(P, stickers.map((s) => s.id)) : null;
        persist();
        result(t, 'learn', 3, sticker);
      }
    }, 'big go');
    show(
      h(
        'main',
        { class: 'screen lesson', style: `--tint:${t.color}` },
        lessonBar(t, list.length, i),
        h('section', { class: 'stage' }, card),
        h('nav', { class: 'pager' }, prev, next),
      ),
    );
    // show() bumped screenId, so id === screenId now
    setTimeout(speak, 250);
  };
  render();
}

// ---------- listen & tap / shadow match ----------

function quiz(t: Topic, mode: 'listen' | 'match') {
  const pool = wordsIn(t.id);
  const { choices, rounds } = levelConfig(P.settings.age);
  const targets = pickTargets(pool, rounds, P);
  let round = 0;
  let firstTry = 0;

  const play = () => {
    const w = targets[round];
    const opts = choicesFor(w, pool, Math.min(choices, pool.length));
    let missed = false;
    let locked = false;
    const prompt = () => say(mode === 'listen' ? question(w) : 'Which one fits the shadow?');

    const replay = roundBtn(icon.speaker(), 'Hear again', () => {
      sfx.tap();
      void (mode === 'listen' ? say(question(w), { slow: true }) : say(['Which one fits the shadow?']));
    }, 'soft');

    const drop = mode === 'match' ? h('div', { class: 'drop' }, picture(w, 'lg shadow')) : null;

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
        btn.classList.add('right');
        confetti(btn);
        if (drop) {
          drop.replaceChildren(picture(w, 'lg pop-in'));
          drop.classList.add('filled');
          btn.classList.add('gone');
        }
        recordAnswer(P, w.id, !missed);
        if (!missed) firstTry++;
        persist();
        await say([w.word, missed ? 'Yes!' : pick(['Great!', 'Yes!', 'Super!', 'Well done!'])]);
        await wait(300);
        if (!alive(id)) return;
        round++;
        if (round < targets.length) play();
        else finishQuiz(t, mode, firstTry, targets.length);
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
        { class: `screen lesson quiz ${mode}`, style: `--tint:${t.color}` },
        lessonBar(t, targets.length, round, replay),
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

function finishQuiz(t: Topic, a: Activity, firstTry: number, rounds: number) {
  const stars = starsFor(firstTry, rounds);
  recordStars(P, t.id, a, stars);
  const sticker = stars >= 2 ? awardSticker(P, stickers.map((s) => s.id)) : null;
  persist();
  result(t, a, stars, sticker);
}

// ---------- say it ----------

function sayIt(t: Topic) {
  const pool = wordsIn(t.id);
  const rounds = levelConfig(P.settings.age).sayRounds;
  const targets = pickTargets(pool, rounds, P);
  let round = 0;
  let firstTry = 0;

  const play = () => {
    const w = targets[round];
    let tries = 0;
    let busy = false;

    const status = h('p', { class: 'heard', 'aria-live': 'polite' }, '');
    const card = h('div', { class: 'card flash pop-in' }, picture(w, 'lg'), h('span', { class: 'word' }, w.word));
    const hear = roundBtn(icon.speaker(), 'Hear the word', () => {
      sfx.tap();
      void say(w.word, { slow: true });
    }, 'soft big');

    const mic = h('button', { class: 'mic', 'aria-label': 'Say it' }, icon.mic(), h('i', { class: 'ring' }));

    // The child's own voice from the last try, so they can compare it with the model.
    let clip: Blob | null = null;
    const mine = roundBtn(icon.voice(), 'Hear my voice', () => {
      if (!clip || busy) return;
      sfx.tap();
      stopSpeaking();
      void playClip(clip);
    }, 'soft big mine');
    mine.disabled = true;
    const playBack = P.settings.playback;
    if (!playBack || !canRecord()) mine.hidden = true;

    const next = async (ok: boolean) => {
      const id = screenId;
      recordAnswer(P, w.id, ok && tries === 1);
      if (ok && tries === 1) firstTry++;
      persist();
      await wait(400);
      if (!alive(id)) return;
      round++;
      if (round < targets.length) play();
      else finishQuiz(t, 'say', firstTry, targets.length);
    };

    /** Play back what the child said, then the model word. */
    const echo = async (heardSomething: boolean) => {
      if (playBack && clip && heardSomething) {
        await playClip(clip);
        await wait(150);
      }
    };

    mic.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      const id = screenId;
      stopSpeaking();
      stopClip();
      const recording = playBack && (await openMic());
      if (!alive(id)) return;
      sfx.listen();
      mic.classList.add('on');
      status.textContent = '';
      await wait(250);
      const recorder = recording ? startRecording() : null;
      let r = await listen(5000).result;
      clip = recorder ? await recorder.stop() : null;
      if (recorder && r.error === 'audio-capture') {
        // This device can't share the microphone: stop recording and listen again.
        markRecordingClash();
        mine.hidden = true;
        clip = null;
        r = await listen(5000).result;
      }
      if (!alive(id)) return;
      mic.classList.remove('on');
      if (clip) mine.disabled = false;
      tries++;
      if (r.error === 'not-allowed' || r.error === 'service-not-allowed') {
        status.textContent = 'Cần cho phép micro trong trình duyệt.';
        tries--;
        busy = false;
        return;
      }
      const heard = r.alternatives.length > 0;
      if (r.alternatives[0]) status.textContent = `“${r.alternatives[0]}”`;
      if (passes(w.word, r.alternatives)) {
        sfx.right();
        confetti(card);
        pulse(card, 'wiggle');
        await say(pick(['Great job!', 'Yes!', 'Super!', 'Wonderful!']));
        await echo(heard);
        if (!alive(id)) return;
        await say(w.word);
        void next(true);
      } else if (tries < 2) {
        sfx.oops();
        await echo(heard);
        if (!alive(id)) return;
        await say(['Try again.', w.word], { slow: true });
        busy = false;
      } else {
        // Never leave the child stuck: praise the effort, model the word, move on.
        sfx.star();
        await echo(heard);
        if (!alive(id)) return;
        await say(['Good try!', w.word]);
        void next(false);
      }
    });

    show(
      h(
        'main',
        { class: 'screen lesson sayit', style: `--tint:${t.color}` },
        lessonBar(t, targets.length, round),
        h('section', { class: 'stage' }, card),
        h('nav', { class: 'pager' }, hear, mic, mine),
        status,
      ),
    );
    setTimeout(() => void say(['Can you say', w.word]), 300);
  };
  play();
}

// ---------- result ----------

function result(t: Topic, a: Activity, stars: number, sticker: string | null) {
  const row = starsRow(0, 3, 'big');
  const stickerImg = sticker ? stickers.find((s) => s.id === sticker)!.img : null;
  const prize = h('div', { class: 'prize' });
  show(
    h(
      'main',
      { class: 'screen result', style: `--tint:${t.color}` },
      mascot('hero bob'),
      row,
      prize,
      h(
        'nav',
        { class: 'pager' },
        roundBtn(icon.again(), 'Play again', () => {
          sfx.tap();
          startActivity(t, a);
        }, 'big soft'),
        roundBtn(icon.next(), 'Done', () => {
          sfx.tap();
          topicScreen(t);
        }, 'big go'),
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
      void say('A new sticker for you!');
    }
  })();
}

// ---------- stickers ----------

function stickerBook() {
  const items = stickers.map((s) => {
    const have = P.stickers.includes(s.id);
    return h(
      'div',
      { class: `slot ${have ? 'have' : ''}` },
      h('img', { src: s.img, alt: have ? s.id : '', draggable: false }),
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

function rest() {
  show(
    h(
      'main',
      { class: 'screen splash rest' },
      mascot('hero sleepy'),
      h('h1', { class: 'brand small' }, 'Time to rest'),
      h('p', { class: 'note' }, 'Hôm nay bé đã chơi đủ giờ rồi. Bố mẹ giữ nút khóa để mở thêm.'),
      holdButton(() => parentGate()),
    ),
  );
  void say(['Time to rest.', 'See you later!']);
}

// ---------- grown-ups ----------

function parentGate() {
  inParentArea = true;
  const target = 21 + Math.floor(Math.random() * 78);
  const set = new Set([target]);
  while (set.size < 4) set.add(21 + Math.floor(Math.random() * 78));
  const nums = [...set].sort(() => Math.random() - 0.5);
  show(
    h(
      'main',
      { class: 'screen grown gate' },
      h(
        'header',
        { class: 'bar' },
        roundBtn(icon.home(), 'Về trang chính', () => {
          inParentArea = false;
          home();
        }),
        h('h2', {}, 'Dành cho bố mẹ'),
        h('span', { class: 'spacer' }),
      ),
      h('p', { class: 'ask' }, 'Chạm vào số ', h('b', {}, viNumber(target))),
      h(
        'div',
        { class: 'numpad' },
        nums.map((n) =>
          h('button', { onclick: () => (n === target ? parentArea() : (inParentArea = false, home())) }, String(n)),
        ),
      ),
    ),
    () => {},
  );
}

function parentArea() {
  inParentArea = true;
  const s = P.settings;
  const field = (label: string, control: HTMLElement, hint?: string) =>
    h('label', { class: 'field' }, h('span', { class: 'flabel' }, label), control, hint && h('small', {}, hint));

  const age = h(
    'div',
    { class: 'seg', role: 'radiogroup' },
    (
      [
        ['small', '2–3 tuổi'],
        ['middle', '4–5 tuổi'],
        ['big', '6 tuổi'],
      ] as [AgeLevel, string][]
    ).map(([v, l]) =>
      h(
        'button',
        {
          role: 'radio',
          'aria-checked': String(s.age === v),
          class: s.age === v ? 'sel' : '',
          onclick: () => {
            s.age = v;
            persist();
            parentArea();
          },
        },
        l,
      ),
    ),
  );

  const rate = h('input', { type: 'range', min: '0.6', max: '1.1', step: '0.05', value: String(s.rate) }) as HTMLInputElement;
  rate.addEventListener('change', () => {
    s.rate = Number(rate.value);
    setRate(s.rate);
    persist();
    void say(['Hello!', 'Where is the cat?']);
  });

  const vi = h('input', { type: 'checkbox', checked: s.vietnamese, disabled: !hasVietnameseVoice() }) as HTMLInputElement;
  vi.addEventListener('change', () => {
    s.vietnamese = vi.checked;
    persist();
  });

  const playback = h('input', { type: 'checkbox', checked: s.playback, disabled: !canRecord() }) as HTMLInputElement;
  playback.addEventListener('change', () => {
    s.playback = playback.checked;
    persist();
  });

  const limit = h(
    'select',
    {},
    [0, 10, 15, 20, 30, 45, 60].map((m) =>
      h('option', { value: String(m), selected: s.limitMinutes === m }, m === 0 ? 'Không giới hạn' : `${m} phút`),
    ),
  ) as HTMLSelectElement;
  limit.addEventListener('change', () => {
    s.limitMinutes = Number(limit.value);
    persist();
  });

  const extra = h('button', {
    class: 'ghost',
    onclick: () => {
      P.minutesToday.minutes = 0;
      persist();
      parentArea();
    },
  }, 'Cho chơi thêm hôm nay');

  const rows = topics.map((t) => {
    const ids = wordsIn(t.id).map((w) => w.id);
    return h(
      'tr',
      {},
      h('td', {}, t.vi),
      h('td', {}, `${learnedCount(P, ids)} / ${ids.length}`),
      h('td', {}, `${topicStars(P, t.id)}`),
    );
  });

  const weak = Object.entries(P.words)
    .filter(([, st]) => st.wrong > 0 && st.box < 2)
    .sort((a, b) => b[1].wrong - a[1].wrong)
    .slice(0, 8)
    .map(([id]) => wordById(id))
    .filter(Boolean) as Word[];

  const reset = h('button', {
    class: 'danger',
    onclick: () => {
      if (confirm('Xóa toàn bộ tiến độ, sao và sticker của bé?')) {
        const keep = P.settings;
        Object.assign(P, emptyProgress(), { settings: keep });
        persist();
        parentArea();
      }
    },
  }, 'Xóa tiến độ');

  show(
    h(
      'main',
      { class: 'screen grown' },
      h(
        'header',
        { class: 'bar' },
        roundBtn(icon.home(), 'Về trang chính', () => {
          inParentArea = false;
          home();
        }),
        h('h2', {}, 'Cài đặt cho bố mẹ'),
        h('span', { class: 'spacer' }),
      ),
      h(
        'section',
        { class: 'panel' },
        field('Độ tuổi của bé', age, '2–3 tuổi: 2 hình, 8 câu, 10 thẻ từ; 4–5 tuổi: 3 hình, 10 câu, 12 thẻ từ; 6 tuổi: 4 hình, 12 câu, 15 thẻ từ. Bài Say it ít hơn 2 câu.'),
        field('Tốc độ đọc', rate, 'Kéo xong sẽ đọc thử.'),
        field(
          'Đọc thêm nghĩa tiếng Việt ở thẻ từ',
          vi,
          hasVietnameseVoice() ? undefined : 'Máy này chưa có giọng đọc tiếng Việt.',
        ),
        field(
          'Phát lại giọng bé ở bài Say it',
          playback,
          canRecord()
            ? 'Bé nghe lại mình vừa nói rồi nghe giọng mẫu để so sánh. Tiếng chỉ giữ tạm trong lúc chơi, không lưu và không gửi đi.'
            : 'Máy này không ghi âm được cùng lúc với nhận giọng nói.',
        ),
        field('Giới hạn mỗi ngày', limit, `Hôm nay đã chơi ${P.minutesToday.date === todayStr() ? P.minutesToday.minutes : 0} phút.`),
        extra,
      ),
      h(
        'section',
        { class: 'panel' },
        h('h3', {}, 'Tiến độ'),
        h(
          'table',
          {},
          h('thead', {}, h('tr', {}, h('th', {}, 'Chủ đề'), h('th', {}, 'Đã thuộc'), h('th', {}, 'Sao'))),
          h('tbody', {}, rows),
        ),
        h('p', {}, `Sticker: ${P.stickers.length} / ${stickers.length}`),
        weak.length > 0 &&
          h('p', {}, 'Từ bé hay nhầm: ', h('b', {}, weak.map((w) => `${w.word} (${w.vi})`).join(', '))),
      ),
      h(
        'section',
        { class: 'panel' },
        h('h3', {}, 'Thiết bị'),
        h('p', {}, canSpeak() ? 'Giọng đọc tiếng Anh: có.' : 'Không có giọng đọc. Hãy dùng Chrome hoặc Safari.'),
        h('p', {}, canListen() ? 'Nhận giọng nói (bài “Say it”): có.' : 'Trình duyệt này không nhận giọng nói nên bài “Say it” bị ẩn. Dùng Chrome để bật.'),
        reset,
        h('p', { class: 'credit' }, 'Hình minh họa: Fluent Emoji của Microsoft (giấy phép MIT).'),
      ),
    ),
  );
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// ---------- play-time counter ----------

setInterval(() => {
  if (document.visibilityState !== 'visible' || inParentArea) return;
  if (app.querySelector('.splash')) return;
  addMinutes(P, 1);
  persist();
  if (overLimit(P) && app.querySelector('.lesson') === null && !app.querySelector('.rest')) rest();
}, 60_000);

// expose for debugging / tests
(window as any).__app = { P, topicById };

splash();

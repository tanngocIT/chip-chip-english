import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import './style.css';

import { h, wait, pulse, confetti } from './lib/dom';
import {
  topics,
  words,
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
  pickScene,
  pickReviewSet,
  pickTodayTopic,
  REVIEW_MIN,
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
import { sfx, unlockAudio, playNotes } from './lib/sfx';
import { initInstall, installState, promptInstall, onInstallChange } from './lib/install';
import { icon, picture, starsRow, mascot, roundBtn, progressDots } from './ui';

const app = document.getElementById('app')!;
const P = load();
setRate(P.settings.rate);
initVoice();
initInstall();

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

/**
 * The one-tap "today" session: a fixed run of games in one topic. While it is on, each
 * result screen leads to the next game and Back leaves to the home screen.
 */
const SESSION_STEPS: Activity[] = ['learn', 'listen', 'find', 'sing'];
let session: { topic: Topic; i: number } | null = null;

function startToday(t: Topic) {
  if (overLimit(P)) return rest();
  session = { topic: t, i: 0 };
  startActivity(t, SESSION_STEPS[0]);
}

function nextStep() {
  const s = session;
  if (!s || ++s.i >= SESSION_STEPS.length) return home();
  startActivity(s.topic, SESSION_STEPS[s.i]);
}

/** Say a short line while the button wiggles, then go. Extra taps meanwhile are ignored. */
let announcing = false;
async function announce(btn: HTMLElement, line: string, go: () => void) {
  if (announcing) return;
  announcing = true;
  const id = screenId;
  pulse(btn, 'wiggle');
  await say(line);
  announcing = false;
  if (alive(id)) go();
}

/** Back button inside a game. */
const leave = (t: Topic) => (session ? home() : topicScreen(t));

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
  session = null;
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
        class: 'quick review',
        'aria-label': 'Review',
        onclick: (e: Event) => {
          sfx.tap();
          void announce(e.currentTarget as HTMLElement, "Let's play again!", review);
        },
      },
      h('span', { class: 'pile' }, reviewWords.slice(0, 3).map((w) => picture(w, 'sm'))),
      h('span', { class: 'label' }, 'Review'),
    );

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
      h('section', { class: 'quicks' }, today, reviewBtn),
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
  { id: 'find', name: 'Find it', img: imgUrl('find') },
  { id: 'say', name: 'Say it', img: imgUrl('mouth') },
  { id: 'sing', name: 'Sing along', img: imgUrl('drum') },
];

function topicScreen(t: Topic) {
  session = null;
  if (overLimit(P)) return rest();
  const iconWord = wordById(t.icon)!;
  const acts = ACTIVITIES.filter((a) => (a.id !== 'say' || canListen()) && !(a.id === 'match' && t.noShadow)).map((a) => {
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
  if (a === 'find') return findIt(t);
  if (a === 'sing') return singAlong(t);
  return sayIt(t);
}

function lessonBar(back: () => void, total: number, done: number, extra?: HTMLElement) {
  return h(
    'header',
    { class: 'bar' },
    roundBtn(icon.back(), 'Back', () => {
      sfx.tap();
      back();
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
        lessonBar(() => leave(t), list.length, i),
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
function review() {
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

interface QuizSpec {
  mode: 'listen' | 'match';
  targets: Word[];
  poolFor: (w: Word) => Word[];
  tintFor: (w: Word) => string;
  back: () => void;
  done: (firstTry: number, rounds: number) => void;
}

function runQuiz(q: QuizSpec) {
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
        await say([w.word, missed ? 'Yes!' : pick(['Great!', 'Yes!', 'Super!', 'Well done!'])]);
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

function finishQuiz(t: Topic, a: Activity, firstTry: number, rounds: number) {
  const stars = starsFor(firstTry, rounds);
  recordStars(P, t.id, a, stars);
  const sticker = stars >= 2 ? awardSticker(P, stickers.map((s) => s.id)) : null;
  persist();
  result(t, a, stars, sticker);
}

// ---------- find it in the picture ----------

function findIt(t: Topic) {
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
    confetti(btn);
    btn.classList.add('found');
    recordAnswer(P, w.id, !missed);
    if (!missed) firstTry++;
    persist();
    round++;
    dots.replaceChildren(progressDots(targets.length, round));
    await say([w.word, missed ? 'Yes!' : pick(['Great!', 'Yes!', 'Super!', 'Well done!'])]);
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

// ---------- sing along ----------

/** "Twinkle, twinkle" (dân gian, thuộc phạm vi công cộng): bốn ô nhịp, mỗi nốt một phách. */
const TUNE = [
  ['C', 'C', 'G', 'G'],
  ['A', 'A', 'G', '-'],
  ['F', 'F', 'E', 'E'],
  ['D', 'D', 'C', '-'],
];
const BEAT = 0.5; // giây

/**
 * A short chant over a tune: for each word the picture bounces on the beat while Chip says
 * "cat, cat, it's a cat." Speech sets the pace: each line waits for the next bar line, so slow
 * reading speeds or slow devices never get cut off.
 */
function singAlong(t: Topic) {
  const list = pickLearnSet(wordsIn(t.id), levelConfig(P.settings.age).singCount, P);
  let stopNotes: (() => void) | null = null;
  const dots = h('div', { class: 'dots-wrap' }, progressDots(list.length, 0));
  const stage = h('section', { class: 'stage' });

  show(
    h(
      'main',
      { class: 'screen lesson sing', style: `--tint:${t.color}` },
      h(
        'header',
        { class: 'bar' },
        roundBtn(icon.back(), 'Back', () => {
          sfx.tap();
          leave(t);
        }),
        dots,
        h('span', { class: 'spacer' }),
      ),
      stage,
    ),
    () => stopNotes?.(),
  );
  const id = screenId;

  /** One bar: start its notes, say the line, then wait for the bar line (a later one if speech ran long). */
  const bar = async (notes: string[], line: string) => {
    const start = performance.now();
    stopNotes = playNotes(notes, BEAT);
    if (line) await say(line);
    const barMs = notes.length * BEAT * 1000;
    const spent = performance.now() - start;
    const bars = Math.max(1, Math.ceil((spent - 80) / barMs));
    await wait(Math.max(0, bars * barMs - spent));
    return alive(id);
  };

  void (async () => {
    await wait(350);
    for (let i = 0; i < list.length && alive(id); i++) {
      const w = list[i];
      recordSeen(P, w.id);
      persist();
      dots.replaceChildren(progressDots(list.length, i));
      stage.replaceChildren(
        h('div', { class: 'card flash pop-in' }, h('div', { class: 'beat' }, picture(w, 'lg')), h('span', { class: 'word' }, w.word)),
      );
      const half = (i % 2) * 2;
      if (!(await bar(TUNE[half], w.word))) return;
      if (!(await bar(TUNE[half + 1], w.word))) return;
      // the sentence gets the same two bars again
      if (!(await bar(TUNE[half], describe(w)))) return;
      if (!(await bar(TUNE[half + 1], ''))) return;
    }
    if (!alive(id)) return;
    recordStars(P, t.id, 'sing', 3);
    persist();
    result(t, 'sing', 3, null);
  })();
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
        lessonBar(() => leave(t), targets.length, round),
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

/** Result of a game in a topic. In a today session it leads to the next game instead. */
function result(t: Topic, a: Activity, stars: number, sticker: string | null) {
  if (session) {
    return resultScreen({ tint: t.color, stars, sticker, done: nextStep, steps: [SESSION_STEPS.length, session.i + 1] });
  }
  resultScreen({ tint: t.color, stars, sticker, again: () => startActivity(t, a), done: () => topicScreen(t) });
}

interface ResultSpec {
  tint: string;
  stars: number;
  sticker: string | null;
  again?: () => void;
  done: () => void;
  /** [total, finished] games of a today session */
  steps?: [number, number];
}

function resultScreen({ tint, stars, sticker, again, done, steps }: ResultSpec) {
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
  session = null;
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

  // Cài app ra màn hình chính
  const refresh = () => {
    if (inParentArea && app.querySelector('.grown:not(.gate)')) parentArea();
  };
  const inst = installState();
  const installBtn = h('button', { class: 'primary', onclick: () => void promptInstall().then(refresh) }, 'Cài app ra màn hình chính');
  const installBody =
    inst === 'installed'
      ? [h('p', {}, 'App đã được cài trên máy này.')]
      : inst === 'prompt'
        ? [h('p', {}, 'Thêm Chip Chip English ra màn hình chính để bé mở như một app, chơi được cả khi không có mạng.'), installBtn]
        : inst === 'ios'
          ? [
              h('p', {}, 'Trên iPhone và iPad, hãy mở trang này bằng Safari rồi:'),
              h(
                'ol',
                { class: 'steps' },
                h('li', {}, 'Bấm nút ', h('b', {}, 'Chia sẻ'), ' ', icon.share(), ' (ô vuông có mũi tên lên).'),
                h('li', {}, 'Chọn ', h('b', {}, 'Thêm vào Màn hình chính'), '.'),
                h('li', {}, 'Bấm ', h('b', {}, 'Thêm'), '.'),
              ),
            ]
          : [h('p', {}, 'Mở menu của trình duyệt rồi chọn “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”. Nên dùng Chrome (Android, máy tính) hoặc Safari (iPhone, iPad).')];
  // Trình duyệt có thể báo cài được sau khi màn này đã mở
  onInstallChange(refresh);

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
        field('Độ tuổi của bé', age, '2–3 tuổi: 2 hình, 8 câu, 10 thẻ từ; 4–5 tuổi: 3 hình, 10 câu, 12 thẻ từ; 6 tuổi: 4 hình, 12 câu, 15 thẻ từ. Bài Say it ít hơn 2 câu. Bài Find it có 6, 9 hoặc 12 hình trong tranh.'),
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
      h('section', { class: 'panel install' }, h('h3', {}, 'Cài app'), installBody),
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
    () => onInstallChange(null),
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
  // A game in progress and its result screen are never cut off: the child finishes, then rests.
  if (overLimit(P) && !app.querySelector('.lesson, .result, .rest')) rest();
}, 60_000);

// expose for debugging / tests
(window as any).__app = { P, topicById };

splash();

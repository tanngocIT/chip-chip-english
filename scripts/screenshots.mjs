// Plays through the app in headless Chrome and saves screenshots to ./shots.
// Run `npm run build` first. Usage: node scripts/screenshots.mjs [phone|tablet] [small|middle|big]
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';
import fs from 'node:fs';

const device = process.argv[2] ?? 'tablet';
const age = process.argv[3] ?? 'small';
const tag = age === 'small' ? device : `${device}-${age}`;
const vp = device === 'phone' ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1024, height: 768, deviceScaleFactor: 1, hasTouch: true };

fs.mkdirSync('shots', { recursive: true });
const server = await preview({ preview: { port: 4179, host: '127.0.0.1' } });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const page = await browser.newPage();
await page.setViewport(vp);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()));

// Make speech instant so the run is fast and deterministic.
await page.evaluateOnNewDocument((age) => {
  if (age !== 'small' && !localStorage.getItem('be-hoc-tieng-anh:v1')) {
    localStorage.setItem('be-hoc-tieng-anh:v1', JSON.stringify({ settings: { age } }));
  }
  const fake = {
    speaking: false,
    getVoices: () => [],
    addEventListener() {},
    cancel() {},
    speak(u) {
      (window.__allSaid ??= []).push(u.text);
      setTimeout(() => u.onend && u.onend(), 30);
    },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: fake });
  window.SpeechSynthesisUtterance = function (t) {
    this.text = t;
  };
  window.SpeechRecognition = window.webkitSpeechRecognition = function () {
    this.start = () => setTimeout(() => {
      this.onresult?.({ results: [[{ transcript: window.__heard ?? '' }]] });
      this.onend?.();
    }, 50);
    this.stop = () => {};
    this.abort = () => {};
  };
}, age);

// Chặn file giọng thật để app rơi về TTS giả lập ở trên (nhanh, không chờ âm thanh).
await page.setRequestInterception(true);
page.on('request', (r) => (r.url().includes('/voice/') ? r.abort() : r.continue()));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => {
  await wait(500);
  await page.screenshot({ path: `shots/${tag}-${name}.png` });
};
const click = async (sel) => {
  await page.waitForSelector(sel);
  await page.$eval(sel, (el) => el.click());
  await wait(350);
};

await page.goto('http://127.0.0.1:4179/', { waitUntil: 'networkidle0' });
await shot('01-splash');
await click('.play-big');
await shot('02-home');
await click('.topic');
await shot('03-topic');

await click('.act-learn');
await shot('04-learn');
await click('.pager .go');
await shot('05-learn-next');
await click('.bar .round');

// Listen & tap: answer each round, first one wrong on purpose.
await click('.act-listen');
await shot('06-listen');
let sawChip = false;
let guard = 0;
while ((await page.$('.quiz')) && guard++ < 60) {
  const opts = await page.$$('.option:not(.dim)');
  // try options in order until the screen changes
  for (const o of opts) {
    const before = await page.$eval('.dots', (d) => d.querySelectorAll('.done').length).catch(() => -1);
    await o.click().catch(() => {});
    await wait(500);
    const after = await page.$eval('.dots', (d) => d.querySelectorAll('.done').length).catch(() => -1);
    if (after !== before || !(await page.$('.quiz'))) break;
  }
  // a right answer makes Chip pop up
  sawChip ||= !!(await page.$('.chip-peek'));
  if (guard === 1) await shot('07-listen-answered');
}
if (!sawChip) errors.push('Chip did not pop up after a right answer');
await wait(2500);
await shot('08-result');
await click('.pager .go');

await click('.act-match');
await shot('09-match');
// The word under the shadow stays hidden until the right picture is in place.
const hiddenBefore = await page.$eval('.drop .word', (el) => getComputedStyle(el).visibility);
if (hiddenBefore !== 'hidden') errors.push('shadow word is visible before the answer');
await page.evaluate(() => {
  const word = document.querySelector('.drop .word').textContent;
  [...document.querySelectorAll('.option')].find((o) => o.getAttribute('aria-label') === word).click();
});
await wait(200);
const shownAfter = await page.$eval('.drop .word', (el) => getComputedStyle(el).visibility).catch(() => 'gone');
if (shownAfter !== 'visible') errors.push(`shadow word not shown after the answer (${shownAfter})`);
await page.screenshot({ path: `shots/${tag}-09b-match-word.png` });
await click('.bar .round');

// Find it: tap pictures until every target is found, then expect the result screen.
await click('.act-find');
await shot('16-find');
const overflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
if (overflow > 2) errors.push(`find scene is taller than the screen by ${overflow}px`);
guard = 0;
while ((await page.$('.find')) && guard++ < 200) {
  const spots = await page.$$('.spot:not(.found)');
  for (const sp of spots) {
    const before = await page.$$eval('.spot.found', (f) => f.length).catch(() => -1);
    await sp.click().catch(() => {});
    await wait(120);
    const after = await page.$$eval('.spot.found', (f) => f.length).catch(() => -1);
    if (after !== before) {
      if (after === 1) await shot('17-find-found');
      await wait(600);
      break;
    }
  }
}
await page.waitForSelector('.result', { timeout: 5000 }).catch(() => errors.push('Find it did not reach the result screen'));
await wait(2500);
await shot('18-find-result');
await click('.pager .go');

// Memory: remember each card that was turned and pair them up.
await click('.act-memory');
await shot('24-memory');
const deckOverflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
if (deckOverflow > 2) errors.push(`memory deck is taller than the screen by ${deckOverflow}px`);
const cardCount = await page.$$eval('.flip', (c) => c.length);
if (cardCount % 2 || cardCount < 6) errors.push(`memory deck has ${cardCount} cards`);
await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const cards = [...document.querySelectorAll('.flip')];
  const known = new Map(); // word -> card
  const settle = async () => {
    for (let i = 0; i < 40 && cards.some((c) => c.classList.contains('up') && !c.classList.contains('matched')); i++) await sleep(100);
  };
  for (let guard = 0; guard < 60 && document.querySelector('.memory'); guard++) {
    const first = cards.find((c) => !c.classList.contains('matched') && ![...known.values()].includes(c)) ?? cards.find((c) => !c.classList.contains('matched'));
    if (!first) break;
    first.click();
    await sleep(60);
    const word = first.getAttribute('aria-label');
    let second = known.get(word);
    if (!second || second === first) second = cards.find((c) => c !== first && !c.classList.contains('matched') && ![...known.values()].includes(c)) ?? cards.find((c) => c !== first && !c.classList.contains('matched'));
    known.set(word, first);
    if (!second) break;
    second.click();
    await sleep(60);
    known.set(second.getAttribute('aria-label'), second);
    if (guard === 0) window.__memoryFirstPair = [word, second.getAttribute('aria-label')];
    await sleep(300);
    await settle();
  }
});
await page.waitForSelector('.result', { timeout: 8000 }).catch(() => errors.push('Memory did not reach the result screen'));
// With two stars or more the sticker comes in a gift box that the child opens.
await wait(1800);
const memStars = await page.$$eval('.stars.big .on', (s) => s.length);
if (memStars >= 2) {
  await page.waitForSelector('.gift', { timeout: 4000 }).catch(() => errors.push('no gift box on the result screen'));
  await shot('25-memory-result');
  await page.evaluate(() => document.querySelector('.gift')?.click());
  await wait(500);
  const prize = await page.evaluate(() => ({ img: !!document.querySelector('.prize .sticker'), name: document.querySelector('.sticker-name')?.textContent ?? '' }));
  if (!prize.img || !prize.name) errors.push(`gift did not open into a named sticker: ${JSON.stringify(prize)}`);
  await shot('25b-gift-open');
} else {
  await shot('25-memory-result');
}
await click('.pager .go');

// Sing along: plays by itself to the result screen.
await click('.act-sing');
await wait(1200);
await shot('19-sing');
await page.waitForSelector('.result', { timeout: 90000 }).catch(() => errors.push('Sing along did not reach the result screen'));
await wait(1500);
await click('.pager .go');
// leaving in the middle must stop it: no result screen may appear afterwards
await click('.act-sing');
await wait(1500);
await click('.bar .round');
await wait(5000);
if (!(await page.$('.topic-screen'))) errors.push('Sing along kept running after going back');

await click('.act-say');
await page.evaluate(() => {
  window.__heard = document.querySelector('.flash .word').textContent;
});
await shot('10-say');
await page.evaluate(() => {
  window.__played = 0;
  const orig = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    window.__played++;
    return orig.call(this);
  };
});
await click('.mic');
await wait(1500);
await shot('11-say-right');
const played = await page.evaluate(() => window.__played);
console.log('voice clips played back:', played);
if (!played) errors.push('child voice was not played back');
await click('.bar .round');
await click('.bar .round');

await click('.book-btn');
await shot('12-stickers');
// An owned sticker shows its name and says it when tapped.
const owned = await page.$$eval('.slot.have .name', (n) => n.map((x) => x.textContent));
if (!owned.length || owned.some((n) => !n)) errors.push(`owned stickers have no name: ${JSON.stringify(owned)}`);
else {
  await page.evaluate(() => {
    window.__said = [];
    const orig = window.speechSynthesis.speak;
    window.speechSynthesis.speak = (u) => (window.__said.push(u.text), orig(u));
  });
  await click('.slot.have');
  const said = await page.evaluate(() => window.__said);
  if (said[0] !== owned[0]) errors.push(`sticker said ${JSON.stringify(said)} instead of ${owned[0]}`);
}
await click('.bar .round');

// Grown-ups: hold the lock button.
await page.$eval('.grownup', (el) => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
await wait(1700);
await shot('13-gate');
await page.evaluate(() => {
  const target = document.querySelector('.ask b').textContent;
  const map = window.__viTest;
  const btns = [...document.querySelectorAll('.numpad button')];
  // find the button whose number spells the target
  const VI = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const vi = (n) => {
    const t = Math.floor(n / 10), o = n % 10;
    const h = t === 1 ? 'mười' : `${VI[t]} mươi`;
    if (o === 0) return h;
    if (o === 5) return `${h} lăm`;
    if (o === 1 && t > 1) return `${h} mốt`;
    if (o === 4 && t > 1) return `${h} tư`;
    return `${h} ${VI[o]}`;
  };
  btns.find((b) => vi(Number(b.textContent)) === target).click();
});
await shot('14-parents');
if (!(await page.$('.panel.install'))) errors.push('install panel missing');
// The browser offers install: the button must appear and open the prompt.
await page.evaluate(() => {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  e.prompt = () => ((window.__prompted = true), Promise.resolve());
  e.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(e);
});
await wait(300);
if (!(await page.$('.panel.install .primary'))) errors.push('install button did not appear after beforeinstallprompt');
else {
  await shot('14b-parents-install');
  await click('.panel.install .primary');
  await wait(300);
  const ok = await page.evaluate(() => window.__prompted === true && !document.querySelector('.panel.install .primary'));
  if (!ok) errors.push('install button did not prompt or did not hide after install');
}
await page.screenshot({ path: `shots/${tag}-15-parents-full.png`, fullPage: true });

// ---- today session, review and the daily limit ----

/** Plays whatever game is on screen until `until` shows up. */
async function autoplay(until, maxMs = 240000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (await page.$(until)) return true;
    if (await page.$('.result')) {
      await wait(500);
      await click('.pager .go');
    } else if (await page.$('.quiz')) {
      await page.evaluate(() => document.querySelector('.option:not(.dim):not(.right)')?.click());
      await wait(450);
    } else if (await page.$('.find')) {
      for (const sp of await page.$$('.spot:not(.found)')) {
        const before = await page.$$eval('.spot.found', (f) => f.length).catch(() => -1);
        await sp.click().catch(() => {});
        await wait(120);
        const after = await page.$$eval('.spot.found', (f) => f.length).catch(() => -1);
        if (after !== before) break;
      }
      await wait(500);
    } else if (await page.$('.sing')) {
      await wait(1000);
    } else if (await page.$('.lesson .flash')) {
      await click('.pager .go');
    } else {
      await wait(300);
    }
  }
  return false;
}

await click('.bar .round'); // parents -> home
await shot('20-home-quick');
if (!(await page.$('.quick.today'))) errors.push('today button missing on home');
if (!(await page.$('.quick.review'))) errors.push('review button missing although words were played');

// Today: learn -> listen -> find -> sing, each result leads on, the last one back home.
await click('.quick.today');
if (!(await page.$('.lesson .flash'))) errors.push('today session did not start with Look and listen');
const seenScreens = new Set();
const watcher = setInterval(async () => {
  const c = await page.$eval('main', (m) => m.className).catch(() => '');
  for (const k of ['quiz', 'find', 'sing', 'result']) if (c.includes(k)) seenScreens.add(k);
  if (c.includes('result') && !seenScreens.has('shot')) {
    seenScreens.add('shot');
    await page.screenshot({ path: `shots/${tag}-21-today-result.png` }).catch(() => {});
    if (await page.$('.result .soft')) errors.push('today session result shows Play again');
    if (!(await page.$('.result .dots'))) errors.push('today session result has no step dots');
  }
}, 150);
if (!(await autoplay('.home'))) errors.push('today session did not come back home');
clearInterval(watcher);
for (const k of ['quiz', 'find', 'sing', 'result']) if (!seenScreens.has(k)) errors.push(`today session skipped: ${k}`);

// Sentences: only from the middle age group up.
const hasSentences = !!(await page.$('.sentences-btn'));
if (hasSentences !== (age !== 'small')) errors.push(`sentences button shown=${hasSentences} for age ${age}`);
if (hasSentences) {
  await click('.sentences-btn');
  await shot('26-sentences');
  if (!(await page.$('.sentences'))) errors.push('Sentences did not open');
  const fit = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  if (fit > 2) errors.push(`sentences screen is taller than the screen by ${fit}px`);
  const empty = await page.$$eval('.sentences .option', (o) => o.filter((x) => !x.querySelector('img')).length);
  if (empty) errors.push('a sentence option has no picture');
  if (!(await autoplay('.result'))) errors.push('Sentences did not reach the result screen');
  await click('.pager .go');
  if (!(await page.$('.home'))) errors.push('Sentences Done did not go home');
}

// Review: plays to a result, Done goes home.
await click('.quick.review');
await shot('22-review');
if (!(await page.$('.quiz.listen'))) errors.push('review did not open a Listen and tap game');
if (!(await autoplay('.result'))) errors.push('review did not reach the result screen');
if (!(await page.$('.result .soft'))) errors.push('review result has no Play again');
await click('.pager .go');
if (!(await page.$('.home'))) errors.push('review Done did not go home');

// Daily limit runs out in the middle of a game: finish it, see the result, then rest.
await click('.topic');
await click('.act-listen');
await page.evaluate(() => {
  const P = window.__app.P;
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  P.minutesToday = { date, minutes: 999 };
});
if (!(await autoplay('.result'))) errors.push('game was cut off when play time ran out');
await wait(1500);
if (!(await page.$('.result'))) errors.push('result screen was replaced when play time ran out');
await click('.pager .go');
await shot('23-rest');
if (!(await page.$('.rest'))) errors.push('no rest screen after the result when play time ran out');

const praise = (await page.evaluate(() => window.__allSaid ?? [])).filter((t) => ['Yes!', 'Great!', 'Super!', 'Wonderful!'].includes(t));
if (praise.length) errors.push(`spoken praise after an answer: ${praise.join(', ')}`);

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
server.httpServer.close();
process.exit(errors.length ? 1 : 0);

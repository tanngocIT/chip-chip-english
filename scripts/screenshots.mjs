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
  if (await page.$('.chip-peek')) {
    sawChip = true;
    // the cheer floats over the page: it must not join the layout and make the page longer
    const peek = await page.evaluate(() => ({
      position: getComputedStyle(document.querySelector('.chip-peek') ?? document.body).position,
      overflow: document.documentElement.scrollHeight - window.innerHeight,
    }));
    if (peek.position !== 'fixed' && peek.position !== 'static') errors.push(`Chip's cheer is position ${peek.position}, not fixed`);
    // a few pixels come and go while a new card pops in; the bug to catch is the page growing by Chip's height
    if (peek.overflow > 40) errors.push(`page grew by ${peek.overflow}px while Chip cheered`);
  }
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

// Odd one out: every round shows exactly one picture that is not from this topic.
await click('.act-odd');
await shot('29-odd');
{
  const data = JSON.parse(fs.readFileSync('src/data/words.json', 'utf8'));
  const own = new Set(data.words.filter((w) => w.topic === data.topics[0].id).map((w) => w.word ?? w.id));
  const labels = await page.$$eval('.odd .option', (o) => o.map((x) => x.getAttribute('aria-label')));
  const strangers = labels.filter((l) => !own.has(l));
  if (labels.length !== (age === 'small' ? 3 : 4) || strangers.length !== 1) errors.push(`odd one out shows ${JSON.stringify(labels)}`);
  const fit = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  if (fit > 2) errors.push(`odd one out is taller than the screen by ${fit}px`);
  // a wrong picture first: it only shakes, the round stays
  await page.evaluate((own) => [...document.querySelectorAll('.odd .option')].find((o) => own.includes(o.getAttribute('aria-label'))).click(), [...own]);
  await wait(300);
  if ((await page.$$eval('.dots .done', (d) => d.length)) !== 0) errors.push('a wrong tap in odd one out moved on');
  if (!(await autoplay('.result'))) errors.push('Odd one out did not reach the result screen');
  await wait(1200);
  await click('.pager .go');
  if (!(await page.$('.topic-screen'))) errors.push('Odd one out Done did not go back to the topic');
}

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
if ((await page.$$eval('.wardrobe .look', (l) => l.length)) !== 5) errors.push('wardrobe does not show five things for Chip');
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

// My picture: tap a sticker in the tray to put it down, drag it around, drag it off to remove it.
if (!(await page.$('.scene-btn'))) errors.push('no picture button in the sticker book although stickers are owned');
else {
  await click('.scene-btn');
  if (!(await page.$('.scene-screen .board'))) errors.push('the sticker picture did not open');
  const trayCount = await page.$$eval('.tray-item', (t) => t.length);
  if (trayCount !== owned.length) errors.push(`tray has ${trayCount} stickers, the child owns ${owned.length}`);
  await click('.tray-item');
  const saved = () => page.evaluate(() => JSON.stringify(window.__app.P.scene));
  if ((await page.$$eval('.placed', (p) => p.length)) !== 1 || JSON.parse(await saved()).length !== 1) errors.push('a tap in the tray did not put a sticker on the picture');
  const center = (sel) => page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const dragTo = async (from, to) => {
    await page.mouse.move(from[0], from[1]);
    await page.mouse.down();
    await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 4 });
    await page.mouse.move(to[0], to[1], { steps: 4 });
    await page.mouse.up();
    await wait(250);
  };
  const board = await page.$eval('.board', (b) => { const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  // move it to the upper left quarter
  await dragTo(await center('.placed'), [board.x + board.w * 0.25, board.y + board.h * 0.25]);
  const moved = JSON.parse(await saved())[0];
  if (!moved || Math.abs(moved[1] - 25) > 3 || Math.abs(moved[2] - 25) > 3) errors.push(`dragging a sticker did not move it: ${JSON.stringify(moved)}`);
  // a second one dragged straight out of the tray lands where it is dropped
  await dragTo(await center('.tray-item'), [board.x + board.w * 0.7, board.y + board.h * 0.6]);
  const two = JSON.parse(await saved());
  if (two.length !== 2 || Math.abs(two[1][1] - 70) > 3 || Math.abs(two[1][2] - 60) > 3) errors.push(`dragging out of the tray did not place a sticker: ${JSON.stringify(two)}`);
  if (await page.$('.ghost')) errors.push('the dragged copy stayed on screen');
  const bgBefore = await page.$eval('.board', (b) => b.className);
  await click('.bar .round.soft');
  if ((await page.$eval('.board', (b) => b.className)) === bgBefore) errors.push('the background button did not change the picture');
  const sceneFit = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  if (sceneFit > 2) errors.push(`the sticker picture is taller than the screen by ${sceneFit}px`);
  await shot('30-picture');
  // dropped below the picture, a sticker comes off
  await dragTo(await center('.placed'), [board.x + board.w / 2, board.y + board.h + 30]);
  if (JSON.parse(await saved()).length !== 1) errors.push('dragging a sticker off the picture did not remove it');
  // it is still there after leaving and coming back
  await click('.bar .round');
  await click('.scene-btn');
  if ((await page.$$eval('.placed', (p) => p.length)) !== 1) errors.push('the sticker picture was not kept');
  await click('.bar .round');
}
await click('.bar .round');

// My words: the words met so far, each says its name.
{
  const shown = await page.$eval('.words-btn b', (b) => Number(b.textContent));
  const met = await page.evaluate(() => Object.values(window.__app.P.words).filter((s) => s.seen > 0).length);
  if (!shown || shown !== met) errors.push(`word book button shows ${shown}, the child has met ${met}`);
  await click('.words-btn');
  await shot('31-words');
  const cells = await page.$$eval('.wb-word:not(.todo)', (c) => c.map((x) => x.getAttribute('aria-label')));
  if (cells.length !== met) errors.push(`word book lists ${cells.length} words, expected ${met}`);
  await page.evaluate(() => (window.__said = []));
  await click('.wb-word:not(.todo)');
  const saidWord = await page.evaluate(() => window.__said);
  if (saidWord[0] !== cells[0]) errors.push(`word book said ${JSON.stringify(saidWord)} instead of ${cells[0]}`);
  await click('.bar .round');
  if (!(await page.$('.home'))) errors.push('word book Home did not go home');
}

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
// The week: seven bars, and today's games and answers are counted.
const weekInfo = await page.evaluate(() => ({
  bars: document.querySelectorAll('.panel.week .bar-col').length,
  tiles: [...document.querySelectorAll('.panel.week .tile b')].map((b) => b.textContent),
  days: Object.values(window.__app.P.days),
  version: [...document.querySelectorAll('.panel p')].some((p) => p.textContent.includes('Phiên bản')),
}));
if (weekInfo.bars !== 7 || weekInfo.tiles.length !== 4) errors.push(`week report is incomplete: ${JSON.stringify(weekInfo)}`);
if (!weekInfo.days.length || weekInfo.days[0].games < 1 || weekInfo.days[0].right + weekInfo.days[0].wrong < 1) errors.push(`today was not recorded: ${JSON.stringify(weekInfo.days)}`);
if (!weekInfo.version) errors.push('version line missing in the grown-ups area');
// Backup: the code on screen restores the same progress.
page.on('dialog', (d) => void d.accept());
const backup = await page.evaluate(() => {
  const [out, input] = document.querySelectorAll('.panel.backup .code');
  const before = JSON.stringify([window.__app.P.words, window.__app.P.best, window.__app.P.stickers]);
  input.value = out.value;
  // damage the progress, then restore it from the code
  window.__app.P.stickers.length = 0;
  window.__app.P.best = {};
  document.querySelectorAll('.panel.backup .ghost')[1].click();
  const after = JSON.stringify([window.__app.P.words, window.__app.P.best, window.__app.P.stickers]);
  return { code: out.value.slice(0, 6), same: before === after, saved: localStorage.getItem('be-hoc-tieng-anh:v1').includes('"stickers":["') };
});
if (backup.code !== 'CHIP1:' || !backup.same || !backup.saved) errors.push(`backup did not restore the progress: ${JSON.stringify(backup)}`);
await page.evaluate(() => {
  document.querySelectorAll('.panel.backup .code')[1].value = 'not a code';
  document.querySelectorAll('.panel.backup .ghost')[1].click();
});
const refused = await page.$eval('.backup-note', (n) => n.textContent);
if (!refused) errors.push('a wrong backup code gave no message');
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

// Printed flashcards: one card per word of the chosen topic, nine to a page.
{
  await page.evaluate(() => {
    window.__printed = 0;
    window.print = () => window.__printed++;
  });
  const topicSize = await page.evaluate(() => {
    const sel = document.querySelector('.panel.print select');
    sel.value = sel.options[2].value;
    document.querySelector('.panel.print .primary').click();
    return Number(sel.options[2].textContent.match(/\((\d+)/)[1]);
  });
  await page.waitForFunction(() => window.__printed === 1, { timeout: 8000 }).catch(() => errors.push('the print dialog was not opened'));
  const cards = await page.$$eval('.print-sheet .pcard', (c) => c.map((x) => [!!x.querySelector('.pic'), x.querySelector(':scope > b')?.textContent, x.querySelector(':scope > span')?.textContent]));
  if (cards.length !== topicSize || cards.some((c) => !c[0] || !c[1] || !c[2])) errors.push(`print sheet has ${cards.length} cards for ${topicSize} words, or a card is incomplete`);
  if (await page.$eval('.print-sheet', (s) => getComputedStyle(s).display !== 'none')) errors.push('the print sheet shows on screen');
  await page.emulateMediaType('print');
  const onPaper = await page.evaluate(() => ({ app: getComputedStyle(document.getElementById('app')).display, sheet: getComputedStyle(document.querySelector('.print-sheet')).display }));
  if (onPaper.app !== 'none' || onPaper.sheet === 'none') errors.push(`on paper: app is ${onPaper.app}, sheet is ${onPaper.sheet}`);
  if (device === 'tablet') {
    const pdf = Buffer.from(await page.pdf({ format: 'A4', path: `shots/${tag}-32-print.pdf` })).toString('latin1');
    const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    if (pages !== Math.ceil(topicSize / 9)) errors.push(`printed flashcards take ${pages} pages, expected ${Math.ceil(topicSize / 9)}`);
  }
  await page.emulateMediaType('screen');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  if (await page.$('.print-sheet')) errors.push('the print sheet stayed after printing');
}

// ---- keyboard: the whole app can be driven without a pointer ----
await click('.bar .round'); // parents -> home
{
  const key = async (k) => {
    await page.keyboard.press(k);
    await wait(400);
  };
  const cls = () => page.$eval('main', (m) => m.className);
  await key('1'); // first topic
  if (!(await cls()).includes('topic-screen')) errors.push('key 1 on home did not open the first topic');
  if (!(await page.evaluate(() => document.body.classList.contains('keys')))) errors.push('number hints did not turn on');
  const hint = await page.evaluate(() => getComputedStyle(document.querySelector('.activity'), '::after').content);
  if (!/1|counter/.test(hint)) errors.push(`no number hint on the first game: ${hint}`);
  await shot('27-keys-topic');
  await key('1'); // Look and listen
  if (!(await page.$('button.flash'))) errors.push('key 1 on the topic did not open the flashcards');
  await key('ArrowRight');
  const second = await page.$$eval('.dots .done', (d) => d.length);
  await key('ArrowLeft');
  const firstAgain = await page.$$eval('.dots .done', (d) => d.length);
  if (second !== 1 || firstAgain !== 0) errors.push(`arrow keys did not turn the flashcards (${second}, ${firstAgain})`);
  await key('Escape');
  if (!(await cls()).includes('topic-screen')) errors.push('Esc did not go back to the topic');
  await key('2'); // Listen and tap
  if (!(await page.$('.quiz.listen'))) errors.push('key 2 did not open Listen and tap');
  await shot('28-keys-quiz');
  // answer every round with the number keys alone
  for (let i = 0; i < 160 && (await page.$('.quiz')); i++) {
    const options = await page.$$eval('.option', (o) => o.length);
    await page.keyboard.press(String(1 + (i % options)));
    await wait(250);
  }
  if (!(await page.$('.result'))) errors.push('number keys could not finish a quiz');
  await wait(600);
  await key('Enter'); // opens the gift if there is one, else goes on
  if (await page.$('.result')) await key('Enter');
  if (!(await cls()).includes('topic-screen')) errors.push('Enter did not leave the result screen');
  // arrow keys move the focus, Enter presses the focused button
  await key('ArrowDown');
  const focused = await page.evaluate(() => document.activeElement?.className ?? '');
  if (!focused.includes('activity')) errors.push(`arrow key did not focus a game: "${focused}"`);
  await key('ArrowRight');
  const moved = await page.evaluate(() => document.activeElement?.className ?? '');
  if (moved === focused || !moved.includes('activity')) errors.push(`arrow key did not move the focus: "${moved}"`);
  await key('Enter');
  if ((await cls()).includes('topic-screen')) errors.push('Enter did not press the focused game');
  await key('Escape');
  await key('Escape');
  if (!(await page.$('.home'))) errors.push('Esc did not return home');
  // a tap hides the hints again
  await page.mouse.click(5, 5);
  if (await page.evaluate(() => document.body.classList.contains('keys'))) errors.push('number hints stayed on after a click');
}

// ---- today session, review and the daily limit ----

let challengeSeen = false;

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
    } else if (await page.$('.challenge')) {
      // the off-screen challenge that ends a session: look at it once, then say it is done
      if (!challengeSeen) {
        challengeSeen = true;
        await wait(500);
        const m = await page.evaluate(() => ({
          over: document.documentElement.scrollHeight - window.innerHeight,
          text: document.querySelector('.challenge .target-word')?.textContent ?? '',
          vi: document.querySelector('.mission-vi')?.textContent ?? '',
          pic: !!document.querySelector('.mission .pic img'),
          cut: [...document.querySelectorAll('.challenge .target-word, .challenge .pager .round, .mission-vi')].some((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1; }),
        }));
        await page.screenshot({ path: `shots/${tag}-33-challenge.png` });
        if (m.over > 2 || !m.text || !m.vi || !m.pic || m.cut) errors.push(`challenge screen: ${JSON.stringify(m)}`);
      }
      await click('.pager .go');
      await wait(900);
    } else if (await page.$('.lesson .flash, .story')) {
      await click('.pager .go');
    } else {
      await wait(300);
    }
  }
  return false;
}

await shot('20-home-quick');
if (!(await page.$('.quick.today'))) errors.push('today button missing on home');
const streak = await page.$eval('.streak b', (b) => b.textContent).catch(() => null);
if (streak !== '1') errors.push(`streak after the first day of play is ${streak}, expected 1`);
if (!(await page.$('.quick.review'))) errors.push('review button missing although words were played');

// Today: learn -> listen -> find -> sing, each result leads on, the last one back home.
await click('.quick.today');
if (!(await page.$('.lesson .flash'))) errors.push('today session did not start with Look and listen');
const seenScreens = new Set();
const watcher = setInterval(async () => {
  const c = await page.$eval('main', (m) => m.className).catch(() => '');
  for (const k of ['quiz', 'find', 'sing', 'result', 'challenge']) if (c.includes(k)) seenScreens.add(k);
  if (c.includes('result') && !seenScreens.has('shot')) {
    seenScreens.add('shot');
    await page.screenshot({ path: `shots/${tag}-21-today-result.png` }).catch(() => {});
    if (await page.$('.result .soft')) errors.push('today session result shows Play again');
    if (!(await page.$('.result .dots'))) errors.push('today session result has no step dots');
  }
}, 150);
if (!(await autoplay('.home'))) errors.push('today session did not come back home');
clearInterval(watcher);
for (const k of ['quiz', 'find', 'sing', 'result', 'challenge']) if (!seenScreens.has(k)) errors.push(`today session skipped: ${k}`);

// With the challenge switched off by the grown-ups, the session ends on the home screen.
await page.evaluate(() => (window.__app.P.settings.challenges = false));
await click('.quick.today');
{
  let sawChallenge = false;
  const w2 = setInterval(async () => {
    if (await page.$('.challenge').catch(() => null)) sawChallenge = true;
  }, 150);
  if (!(await autoplay('.home'))) errors.push('today session without a challenge did not come back home');
  clearInterval(w2);
  if (sawChallenge) errors.push('a challenge was given although it is switched off');
}
await page.evaluate(() => (window.__app.P.settings.challenges = true));

// Stories: only from the middle age group up. Read one to the end.
const hasStories = !!(await page.$('.stories-btn'));
if (hasStories !== (age !== 'small')) errors.push(`stories button shown=${hasStories} for age ${age}`);
if (hasStories) {
  await click('.stories-btn');
  await page.waitForSelector('.stories', { timeout: 4000 }).catch(() => errors.push('the story list did not open'));
  await shot('34-stories');
  if ((await page.$$eval('.story-tile', (t) => t.length)) < 6) errors.push('fewer than six stories');
  await click('.story-tile');
  await page.waitForSelector('.story', { timeout: 4000 }).catch(() => errors.push('the story did not open'));
  await shot('35-story-page');
  const pageFit = await page.evaluate(() => ({
    over: document.documentElement.scrollHeight - window.innerHeight,
    pics: document.querySelectorAll('.panel-pics .pic img').length,
    text: document.querySelector('.story .target-word')?.textContent ?? '',
    cut: [...document.querySelectorAll('.story .target-word, .pager .round')].some((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1; }),
  }));
  if (pageFit.over > 2 || !pageFit.pics || !pageFit.text || pageFit.cut) errors.push(`story page: ${JSON.stringify(pageFit)}`);
  for (let i = 0; i < 4; i++) await click('.pager .go');
  if (!(await page.$('.story-q'))) errors.push('no question after the four pages of a story');
  await shot('36-story-question');
  const qFit = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  if (qFit > 2) errors.push(`story question is taller than the screen by ${qFit}px`);
  if (!(await autoplay('.result'))) errors.push('the story did not reach the result screen');
  const read = await page.evaluate(() => window.__app.P.stories.length);
  if (read !== 1) errors.push(`finished stories recorded: ${read}`);
  await wait(800);
  await click('.pager .go');
  if (!(await page.$('.stories'))) errors.push('story Done did not go back to the list');
  if (!(await page.$('.story-tile .mini-stars'))) errors.push('the finished story has no star in the list');
  await click('.bar .round');
}

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

// Plays through the app in headless Chrome and saves screenshots to ./shots.
// Run `npm run build` first. Usage: node scripts/screenshots.mjs [phone|tablet]
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';
import fs from 'node:fs';

const device = process.argv[2] ?? 'tablet';
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
await page.evaluateOnNewDocument(() => {
  const fake = {
    speaking: false,
    getVoices: () => [],
    addEventListener() {},
    cancel() {},
    speak(u) {
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
});

// Chặn file giọng thật để app rơi về TTS giả lập ở trên (nhanh, không chờ âm thanh).
await page.setRequestInterception(true);
page.on('request', (r) => (r.url().includes('/voice/') ? r.abort() : r.continue()));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => {
  await wait(500);
  await page.screenshot({ path: `shots/${device}-${name}.png` });
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
  if (guard === 1) await shot('07-listen-answered');
}
await wait(2500);
await shot('08-result');
await click('.pager .go');

await click('.act-match');
await shot('09-match');
await click('.bar .round');

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
await page.screenshot({ path: `shots/${device}-15-parents-full.png`, fullPage: true });

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
server.httpServer.close();
process.exit(errors.length ? 1 : 0);

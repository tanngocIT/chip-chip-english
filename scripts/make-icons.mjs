// Renders the app icons (mascot on meadow green) with headless Chrome.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const chip = 'data:image/webp;base64,' + fs.readFileSync('public/img/art/ui/mascot.webp').toString('base64');
const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
for (const size of [192, 512]) {
  await page.setViewport({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:#e6f4ec;display:grid;place-items:center;height:100vh">
    <img src="${chip}" style="width:74%;height:74%"></body>`);
  await page.evaluate(() => document.images[0].decode());
  await page.screenshot({ path: `public/icon-${size}.png` });
}
await browser.close();
console.log('icons done');

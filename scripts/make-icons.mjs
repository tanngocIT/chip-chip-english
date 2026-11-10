// Renders the app icons (mascot on meadow green) with headless Chrome.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const svg = fs.readFileSync('public/img/mascot.svg', 'utf8');
const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
for (const size of [192, 512]) {
  await page.setViewport({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:#e6f4ec;display:grid;place-items:center;height:100vh">
    <div style="width:64%;height:64%;filter:drop-shadow(${size/40}px 0 0 #fff) drop-shadow(-${size/40}px 0 0 #fff) drop-shadow(0 ${size/40}px 0 #fff) drop-shadow(0 -${size/40}px 0 #fff)">${svg.replace('<svg', '<svg width="100%" height="100%"')}</div></body>`);
  await page.screenshot({ path: `public/icon-${size}.png` });
}
await browser.close();
console.log('icons done');

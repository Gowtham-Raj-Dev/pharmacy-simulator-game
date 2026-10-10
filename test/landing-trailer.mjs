// Check the home page's trailer: layout on a laptop, a large monitor and a phone, then play + full screen.
//   npm run build && npx vite preview --port 5199      (in another terminal)
//   node test/landing-trailer.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-position=-3000,0', '--autoplay-policy=no-user-gesture-required'] });
const sizes = [
  { name: 'laptop', viewport: { width: 1536, height: 730 }, deviceScaleFactor: 1.25 },
  { name: 'monitor', viewport: { width: 1920, height: 960 }, deviceScaleFactor: 1 },
  { name: 'phone', viewport: { width: 390, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
];
for (const s of sizes) {
  const { name, ...opts } = s;
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
  const media = [];
  page.on('request', (r) => { if (/\/video\//.test(r.url())) media.push(r.url().split('/').pop()); });
  await page.goto('http://localhost:5199/');
  await page.waitForSelector('#trailer-play');
  await page.waitForTimeout(600);
  const lay = await page.evaluate(() => {
    const L = document.getElementById('landing'), r = (id) => { const b = document.querySelector(id).getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
    return { scrolls: L.scrollHeight > L.clientHeight + 2, pageH: L.scrollHeight, viewH: L.clientHeight, frame: r('.trailer-frame'), fs: r('#trailer-fs'), poster: document.getElementById('trailer').poster.split('/').pop() };
  });
  await page.screenshot({ path: `test/landing-${name}.png`, fullPage: false });
  const before = [...media];
  await page.click('#trailer-play');
  await page.waitForFunction(() => document.getElementById('trailer').currentTime > 0.8, null, { timeout: 30000 });
  const playing = await page.evaluate(() => { const v = document.getElementById('trailer'); return { src: v.currentSrc.split('/').pop(), w: v.videoWidth, h: v.videoHeight, dur: +v.duration.toFixed(1), controls: v.controls, paused: v.paused, playHidden: document.getElementById('trailer-play').hidden }; });
  await page.screenshot({ path: `test/landing-${name}-playing.png` });
  await page.click('#trailer-fs');
  await page.waitForTimeout(700);
  const full = await page.evaluate(() => (document.fullscreenElement || document.webkitFullscreenElement)?.id || null);
  console.log(name, JSON.stringify(lay), '\n   before play:', before.join(', ') || '(no video requests)', '\n   playing:', JSON.stringify(playing), '\n   full screen element:', full, logs.join(' | ') || '');
  await ctx.close();
}
await browser.close();

// Capture the frames of the home-page trailer from the real game, one frame at a time.
//
//   npx vite --port 5199 --strictPort                 (terminal 1: the dev server)
//   node tools/promo/capture.mjs                       (terminal 2: 2560×1440 frames → tools/promo/work/frames/)
//   python tools/promo/build.py                        (frames + narration + music → public/video/)
//
// The game is not recorded live: director.js puts it on a virtual clock, so every frame is exactly
// 1/30 s of game time however long the computer needs to draw it, and the video is smooth 30 fps at 2K.
// Options: --scale 1 (1280×720 draft)  --shots title,shop  --every 10 (draft: keep 1 frame in 10)
//          --quality high  --out frames-draft  --stills (one PNG per shot, for checking framing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? (process.argv[i + 1]?.startsWith('--') || process.argv[i + 1] === undefined ? true : process.argv[i + 1]) : d; };
const SCALE = +arg('scale', 2), EVERY = +arg('every', 1), QUALITY = arg('quality', 'ultra');
const ONLY = arg('shots', '') ? String(arg('shots')).split(',') : null;
const OUT = path.join(HERE, 'work', String(arg('out', 'frames')));
const URL = arg('url', 'http://localhost:5199/app.html');

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--window-position=-3000,0', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: SCALE });
await page.addInitScript((q) => {
  localStorage.setItem('rxshift_settings_v1', JSON.stringify({
    quality: q, gfxV: 2, lang: 'en', acceptedNotice: true, adaptiveRes: false, guided: false, voiceDialogue: false,
    showFps: false, demoTools: true, haptics: false,
  }));
  localStorage.removeItem('rxshift_save_v1');
}, QUALITY);
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error' || /promo:|avatar failed|context lost/i.test(m.text())) console.log(m.type() + ':', m.text().slice(0, 300)); });

// the dev server's hot-reload socket is answered here and never reaches the server: saving a source file
// (or index.html) during the half-hour capture must not reload the page
await page.routeWebSocket(/.*/, () => {});
await page.goto(URL);
await page.waitForFunction(() => window.__game && !document.querySelector('.loading'), null, { timeout: 300000 });
await page.addScriptTag({ content: fs.readFileSync(path.join(HERE, 'director.js'), 'utf8') });
const lip = fs.existsSync(path.join(HERE, 'work', 'lip.json')) ? JSON.parse(fs.readFileSync(path.join(HERE, 'work', 'lip.json'), 'utf8')) : {};
const info = await page.evaluate((lip) => window.__promo.init(lip), lip);
console.log('renderer', info);

let shots = await page.evaluate(() => window.__promo.list());
const timeline = []; let at = 0;
for (const s of shots) { timeline.push({ ...s, start: at }); at += s.frames; }
fs.writeFileSync(path.join(HERE, 'work', 'timeline.json'), JSON.stringify({ fps: 30, frames: at, shots: timeline }, null, 1));
console.log(`${shots.length} shots, ${at} frames = ${(at / 30).toFixed(1)} s`);

const t0 = Date.now(); let saved = 0;
for (const s of timeline) {
  if (ONLY && !ONLY.includes(s.name)) continue;
  await page.evaluate((n) => window.__promo.begin(n), s.name);
  for (let f = 0; f < s.frames; f++) {
    const shoot = arg('stills', false) ? f === Math.floor(s.frames * 0.6) : f % EVERY === 0;
    await page.evaluate(([n, f, shoot]) => window.__promo.frame(n, f, shoot), [s.name, f, shoot]);
    if (!shoot) continue;
    const file = path.join(OUT, arg('stills', false) ? `${s.name}.png` : `f${String(s.start + f).padStart(5, '0')}.jpg`);
    await page.screenshot(arg('stills', false) ? { path: file } : { path: file, type: 'jpeg', quality: 96 });
    saved++;
  }
  await page.evaluate((n) => window.__promo.end(n), s.name);
  console.log(`  ${s.name.padEnd(10)} ${s.frames} frames   (${saved} saved, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
await browser.close();

// Check the app build (dist-app/): the packed avatars load with their textures and the Opus voices decode.
//   npx vite build --mode app && npx vite preview --outDir dist-app --port 5199   (in another terminal)
//   node test/app-build.mjs [quality]
import { chromium } from 'playwright';

const quality = process.argv[2] || 'medium';
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-position=-3000,0', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
await page.addInitScript((q) => { localStorage.setItem('rxshift_settings_v1', JSON.stringify({ quality: q, acceptedNotice: true, lang: 'en', voiceDialogue: true })); }, quality);
const logs = [], files = { glb: 0, ogg: 0, bad: [] };
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || /avatar failed|missing/i.test(m.text())) logs.push(m.type() + ': ' + m.text()); });
page.on('response', (r) => { const u = r.url(); if (/\.glb$/.test(u)) files.glb++; if (/\.ogg$/.test(u)) files.ogg++; if (r.status() >= 400) files.bad.push(r.status() + ' ' + u); });
await page.goto('http://localhost:5199/');
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });

const people = await page.evaluate(() => {
  const mats = new Map();
  window.__game.scene.traverse((o) => { if (o.isSkinnedMesh) for (const m of [].concat(o.material)) if (/_(body|head|opacity)$/.test(m.name)) mats.set(m.name, `${m.map?.image?.width || 0}${m.normalMap ? '+n' + m.normalMap.image?.width : ''}`); });
  return [...mats].map(([k, v]) => k + ':' + v);
});
console.log('avatar materials in the scene:', people.length, people.some((p) => /:0/.test(p)) ? 'SOME WITHOUT TEXTURE' : 'all textured');
console.log(' ', people.filter((p) => /opacity/.test(p)).join(' '));

const voice = await page.evaluate(async () => {
  const a = window.__game.audio;
  a.ctx = a.ctx || new AudioContext();
  const out = {};
  for (const lang of ['en', 'ta']) {
    a.lang = lang;
    for (const id of ['S01', 'S05_meds', 'cb_cetirizine']) { // S05_meds shares the recording of S05_allergies
      const r = await a._decodeClip(id);
      out[`${lang}/${id}`] = r && r.buf ? `${a._clipUrl(id).split('/').pop()} ${r.buf.duration.toFixed(2)}s ${r.buf.sampleRate}Hz gain ${r.gain.toFixed(2)}` : String(r);
    }
  }
  a.lang = 'en';
  return out;
});
console.log('voices:', voice);
console.log('requests: glb', files.glb, 'ogg', files.ogg, 'failed', files.bad.length ? files.bad : 'none');
await page.screenshot({ path: 'test/app-build.png' });
console.log(logs.join('\n') || 'no errors');
await browser.close();

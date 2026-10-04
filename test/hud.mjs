import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const LANG = process.argv[2] || 'en';
const sizes = [[844, 390, 'L'], [667, 375, 'Lse'], [390, 844, 'P'], [360, 740, 'Psm'], [1280, 720, 'tab']];
const logs = [];
for (const [w, h, tag] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  page.on('pageerror', e => logs.push(tag + ' PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) logs.push(tag + ' ' + m.text()); });
  await page.addInitScript((L) => { localStorage.clear(); localStorage.setItem('rxshift_settings_v1', JSON.stringify({ quality: 'low', lang: L, acceptedNotice: true, voiceDialogue: false })); }, LANG);
  await page.goto('http://localhost:5173/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
  await page.evaluate(() => { const g = window.__game; g.state.tutorialSeen.controls = true; g.ui._title?.remove(); g.ui._title = null; g.startPlay(true); g.ui.closeAll(); });
  await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 40; i++) g.update(1/30); g.ui.toast('Test notification: customer arriving', 'good', 'user'); g.ui.subtitle('Priya', 'I have a headache and mild fever since yesterday.', 9000); });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `/tmp/claude-0/shots/hud_${LANG}_${tag}.png` });
  // overlap check of HUD boxes
  const res = await page.evaluate(() => {
    const sel = ['.hud-tl', '.objective', '.hud-tr', '.side-btns', '.act', '.sprint', '.cam-bar', '#joy', '.toasts .toast', '.subtitle'];
    const boxes = sel.map(s => { const e = document.querySelector(s); if (!e || e.offsetParent === null && s !== '#joy') return null; const r = e.getBoundingClientRect(); return { s, l: r.left, t: r.top, r: r.right, b: r.bottom }; }).filter(Boolean);
    const out = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l), oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
      if (ox > -4 && oy > -4) out.push(`${a.s} × ${b.s} (gap ${Math.max(-ox, -oy).toFixed(0)}px)`);
    }
    const off = boxes.filter(b => b.l < 0 || b.t < 0 || b.r > innerWidth || b.b > innerHeight).map(b => 'OFFSCREEN ' + b.s);
    return out.concat(off);
  });
  console.log(tag, w + 'x' + h, res.length ? res.join(' | ') : 'no overlaps');
  await page.close();
}
console.log(logs.join('\n'));
await browser.close();

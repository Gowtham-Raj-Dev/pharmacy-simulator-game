// Medical 2 layout check: boots the game in the given layout, verifies every work spot can be walked to,
// and saves a top-down plan view plus the home screen.   node test/medical2.mjs [layout=2] [outDir]
import { chromium } from 'playwright';
const layout = +(process.argv[2] || 2), out = process.argv[3] || '.';
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-position=-3000,0'] });
const ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript((layout) => {
  localStorage.setItem('rxshift_settings_v1', JSON.stringify({ quality: 'low', lang: 'en', layout, acceptedNotice: true, realHumans: false, gfxV: 2 }));
}, layout);
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
await page.goto('http://localhost:5199/?game', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/m${layout}-title.png` });
const res = await page.evaluate(() => {
  const g = window.__game, W = g.world, P = W.points, bad = [];
  const reach = (name, from, to) => { const p = g.nav.findPath(from, to); const e = p && p[p.length - 1]; if (!p || Math.hypot(e.x - to.x, e.z - to.z) > 0.45) bad.push(name); };
  for (const it of W.interactables) if (!it.disabled || it.zone === 'expansion') reach('stand:' + it.id, P.playerStart, it.stand);
  reach('service', P.entry, P.service); reach('pos', P.service, P.posCustomer); reach('door', P.service, P.doorInside);
  P.queue.forEach((q, i) => reach('queue' + i, P.entry, q));
  P.waitSeats.forEach((s, i) => reach('seat' + i, P.entry, { x: s.pos.x, z: s.pos.z - 0.7 }));
  return { layout: W.layout, bad, shelves: W.shelves.length, interactables: W.interactables.map((i) => i.id) };
});
console.log(JSON.stringify(res));
// plan view: ceiling off, camera straight down
await page.evaluate(() => {
  const g = window.__game;
  g.ui._title?.remove();
  g.world.static.ceiling.visible = false; g.world.static.glow.visible = false;
  g.update = () => {};
  g.camera.fov = 50; g.camera.far = 80; g.camera.position.set(0, 26, 0.001); g.camera.up.set(0, 0, -1); g.camera.lookAt(0, 0, 0); g.camera.updateProjectionMatrix();
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/m${layout}-plan.png` });
// eye-level views
const view = async (name, p, l) => {
  await page.evaluate(([p, l]) => { const c = window.__game.camera; window.__game.world.static.ceiling.visible = true; window.__game.world.static.glow.visible = true; c.up.set(0, 1, 0); c.fov = 60; c.position.set(...p); c.lookAt(...l); c.updateProjectionMatrix(); }, [p, l]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/m${layout}-${name}.png` });
};
if (layout === 2) {
  await view('entrance', [0, 1.7, 8.2], [0.5, 1.2, 0]);
  await view('counter', [1.0, 1.7, 2.2], [5.5, 1.2, -2]);
  await view('floor', [-7, 2.4, 8.2], [0, 1.0, 1]);
  await view('office', [-1.2, 1.7, -1.9], [-6, 1.0, -4]);
  await view('backroom', [0.6, 1.7, -4.0], [3, 1.2, -8]);
}
console.log(logs.slice(0, 20).join('\n'));
await browser.close();

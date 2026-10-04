import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[PAGEERROR] ${err.message}`));

console.log('Navigating to http://localhost:5173/...');
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

// Wait until game ready
await page.waitForFunction(() => !!window.__game && (!document.getElementById('loading') || document.getElementById('loading').style.display === 'none' || document.getElementById('loading').classList.contains('hidden')), null, { timeout: 60000 });

console.log('Game initialized, starting gameplay...');

// Start play directly
await page.evaluate(() => {
  const g = window.__game;
  g.settings.acceptedNotice = true;
  g.state.tutorialSeen.controls = true;
  g.ui._title?.remove();
  g.ui._title = null;
  g.startPlay(true);
  g.ui.closeAll();
});

await page.waitForTimeout(2000);

// View 1: behind counter looking forward at store
await page.screenshot({ path: 'test/gameplay_view1.png' });
console.log('View 1 captured');

// View 2: Looking around at middle gondola shelves and back main marquee
await page.evaluate(() => {
  const g = window.__game;
  // Position camera in customer area looking back towards dispensary counter and pharmacy marquee
  const p = g.rig.pos.clone().set(0, 1.9, 2.8);
  const l = g.rig.look.clone().set(0, 2.3, -8.7);
  g.rig.setShot(p, l, { cut: true });
});
await page.waitForTimeout(600);
await page.screenshot({ path: 'test/gameplay_banners.png' });
console.log('Banners view captured');

// View 3: Close up on OTC gondola rack and product packages
await page.evaluate(() => {
  const g = window.__game;
  // Position right in front of OTC gondola rack (x=3.18, z=1.2) looking at it
  const p = g.rig.pos.clone().set(2.0, 1.2, 1.2);
  const l = g.rig.look.clone().set(3.18, 1.15, 1.2);
  g.rig.setShot(p, l, { cut: true });
});
await page.waitForTimeout(600);
await page.screenshot({ path: 'test/gameplay_racks.png' });
console.log('Racks view captured');


console.log('Logs (last 15):');
console.log(logs.slice(-15).join('\n'));

await browser.close();

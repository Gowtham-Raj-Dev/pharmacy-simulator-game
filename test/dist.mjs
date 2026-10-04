import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
await page.addInitScript(() => { localStorage.setItem('rxshift_settings_v1', JSON.stringify({ quality: 'low', acceptedNotice: true, lang: 'en', voiceDialogue: false })); });
const logs = [];
page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
await page.goto('file:///home/claude/rxshift/dist/index.html');
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await page.getByText(/Start first shift/).click();
await page.getByRole('button', { name: 'Start' }).click();
await page.waitForTimeout(300); if (await page.getByText('Got it').count()) await page.getByText('Got it').click();
// simulate joystick touch drag on canvas
const cdp = await page.context().newCDPSession(page);
const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
const before = await page.evaluate(() => window.__game.player.group.position.toArray());
await touch('touchStart', 110, 320);
for (let i = 0; i < 12; i++) { await touch('touchMove', 110, 320 - i * 6); await page.waitForTimeout(80); }
await page.waitForTimeout(1500);
await touch('touchEnd');
const after = await page.evaluate(() => window.__game.player.group.position.toArray());
console.log('joystick move', before.map(v=>v.toFixed(2)), '->', after.map(v=>v.toFixed(2)));
// swipe camera on right half
const yaw0 = await page.evaluate(() => window.__game.rig.yaw);
await touch('touchStart', 600, 200); for (let i = 0; i < 8; i++) { await touch('touchMove', 600 - i * 15, 200); await page.waitForTimeout(30); } await touch('touchEnd');
const yaw1 = await page.evaluate(() => window.__game.rig.yaw);
console.log('swipe yaw', yaw0.toFixed(2), '->', yaw1.toFixed(2));
// tap camera rotate button & sprint
await page.locator('.sprint').tap();
const sprint = await page.evaluate(() => window.__game.input.sprint);
console.log('sprint toggled', sprint);
await page.screenshot({ path: '/tmp/claude-0/shots/dist.png' });
console.log(logs.join('\n') || 'no errors');
await browser.close();

import { chromium } from 'playwright';
const lang = process.argv[2] || 'ta';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript((L) => { localStorage.clear(); localStorage.setItem('rxshift_settings_v1', JSON.stringify({ quality: 'low', lang: L, acceptedNotice: true, voiceDialogue: false })); }, lang);
const logs = []; page.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.__game, null, { timeout: 90000 });
await page.evaluate(() => { const g = window.__game; g.state.tutorialSeen.controls = true; g.ui._title?.remove(); g.ui._title = null; g.startPlay(true); g.ui.closeAll(); g.startInspection({ official: false, force: true }); for (let i = 0; i < 15 * 30; i++) g.update(1 / 30); });
await page.waitForTimeout(800);
const intro = await page.locator('.insp-band').first().innerText().catch(() => '');
console.log('intro:', intro.replace(/\n/g, ' | ').slice(0, 120));
await page.keyboard.press('Enter'); await page.waitForTimeout(400);
console.log('state', await page.evaluate(() => ({ insp: !!window.__game.insp, opts: document.querySelectorAll('.opt').length, stack: window.__game.ui.stack.map((s) => s.cls), mode: window.__game.mode, scope: window.__game.ui.keyScope()?.className })));
// answer one wrong → fail screen
await page.evaluate(() => { const g = window.__game; const q = g.insp.qs[g.insp.i]; const wrong = [0, 1, 2, 3].find((i) => i !== q.a); document.querySelectorAll('.opt')[wrong].click(); });
await page.keyboard.press('Enter'); await page.waitForTimeout(600); await page.keyboard.press('Enter'); await page.waitForTimeout(900);
console.log('fail screen:', (await page.locator('.insp-band.fail').innerText().catch(() => 'none')).replace(/\n/g, ' | '));
await page.screenshot({ path: `/tmp/claude-0/shots/insp_fail_${lang}.png` });
await page.keyboard.press('Enter'); await page.waitForTimeout(400); // restart
for (let k = 0; k < 20; k++) {
  await page.evaluate(() => { const g = window.__game; const q = g.insp.qs[g.insp.i]; document.querySelectorAll('.opt')[q.a].click(); });
  await page.keyboard.press('Enter'); await page.waitForTimeout(1100);
}
await page.waitForTimeout(800);
console.log('pass screen:', (await page.locator('.insp-band.pass').innerText().catch(() => 'none')).replace(/\n/g, ' | '));
await page.screenshot({ path: `/tmp/claude-0/shots/insp_pass_${lang}.png` });
console.log('certified', await page.evaluate(() => window.__game.state.inspection.certified));
console.log(logs.length ? logs.join('\n') : 'no page errors');
await browser.close();

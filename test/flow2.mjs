import { chromium } from 'playwright';
const [,, w='390', h='844', tag='port'] = process.argv;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
await page.addInitScript(() => { try { const k = 'rxshift_settings_v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.quality = 'low'; s.lang = s.lang || 'en'; s.voiceDialogue = false; localStorage.setItem(k, JSON.stringify(s)); } catch (e) {} });
const logs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
const out = (n) => `/tmp/claude-0/shots/${tag}_${n}.png`;
const sim = (sec) => page.evaluate((s) => { const g = window.__game; for (let i = 0; i < s * 30; i++) g.update(1 / 30); }, sec);
await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await page.evaluate(() => { localStorage.clear(); });
await page.waitForTimeout(500);
await page.screenshot({ path: out('01_title') });
await page.getByText('Start first shift').click();
await page.getByText('I understand').click();
await page.getByRole('button', { name: 'Start' }).click();
if (await page.getByText('Got it').count()) await page.getByText('Got it').click();
await page.evaluate(() => { const g = window.__game; g.jumpToLevel(7); });
await page.getByRole('button', { name: 'Start' }).click();
await page.evaluate(async () => { const g = window.__game; const m = await import('/src/data/scenarios.js'); g.customers.spawnTimer = 999; g.customers.spawn(m.SCENARIOS.find(s => s.id === 'S39')); });
await sim(14);
await page.screenshot({ path: out('02_hud') });
await page.evaluate(() => { const g = window.__game; g.startConsultation(g.customers.counterCust); });
await sim(3); await page.waitForTimeout(1200); await sim(0.5);
await page.screenshot({ path: out('03_dialogue') });
await page.evaluate(() => { const g = window.__game; g.ask('symptoms'); });
await page.waitForTimeout(900); await sim(0.3);
await page.screenshot({ path: out('04_symptoms') });
await page.getByText('Refer customer').click();
await page.waitForTimeout(300);
await page.screenshot({ path: out('05_refer') });
await page.getByText('Call emergency services').click();
await page.waitForTimeout(300);
// choose correct option
await page.evaluate(() => { const opts=[...document.querySelectorAll('.opt')]; const i = opts.findIndex(o=>/calling emergency services right now/i.test(o.textContent)); (opts[i]||opts[0]).click(); });
await page.getByText('Explain to customer').click();
await page.waitForTimeout(1600);
await page.screenshot({ path: out('06_outcome') });
await page.getByRole('button', { name: 'Continue' }).click();
await sim(2);
// Inspection
await page.evaluate(() => { const g = window.__game; g.startInspection({ official: false, force: true }); });
for (let i = 0; i < 6; i++) { await sim(1.0); await page.waitForTimeout(250); }
await page.screenshot({ path: out('07_cine') });
await page.getByText('Skip ▸').click();
await page.waitForTimeout(400);
await page.screenshot({ path: out('08_insp_intro') });
await page.getByText('BEGIN INSPECTION').click();
await page.waitForTimeout(400);
await page.screenshot({ path: out('09_q1') });
// answer 3 correctly then 1 wrong
for (let k = 0; k < 3; k++) {
  await page.evaluate(() => { const g = window.__game; const q = g.insp.qs[g.insp.i]; document.querySelectorAll('.quiz .opt')[q.a].click(); });
  await page.getByText('SUBMIT ANSWER').click();
  await page.waitForTimeout(1300);
}
await page.evaluate(() => { const g = window.__game; const q = g.insp.qs[g.insp.i]; document.querySelectorAll('.quiz .opt')[(q.a + 1) % 4].click(); });
await page.getByText('SUBMIT ANSWER').click();
await page.waitForTimeout(500);
await page.screenshot({ path: out('10_wrong') });
await page.getByText('SEE RESULT').click();
await page.waitForTimeout(400);
await page.screenshot({ path: out('11_failed') });
await page.getByText('RESTART INSPECTION').click();
await page.waitForTimeout(300);
for (let k = 0; k < 20; k++) {
  await page.evaluate(() => { const g = window.__game; const q = g.insp.qs[g.insp.i]; document.querySelectorAll('.quiz .opt')[q.a].click(); });
  await page.getByText('SUBMIT ANSWER').click();
  await page.waitForTimeout(1150);
}
await page.waitForTimeout(400);
await page.screenshot({ path: out('12_passed') });
await page.getByText('CONTINUE GAME').click();
await sim(2);
await page.screenshot({ path: out('13_after') });
await page.evaluate(() => window.__game.ui.showStats());
await page.waitForTimeout(300);
await page.screenshot({ path: out('14_stats') });
console.log(logs.join('\n'));
await browser.close();

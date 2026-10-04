// End-to-end: language picker → Tamil game → guided consultation via keyboard → POS →
// stock-in (order → delivery → receive) → bilingual → English. Collects page errors.
import { chromium } from 'playwright';
const [,, w = '1280', h = '720', tag = 'ta', lang = 'ta', touch = ''] = process.argv;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('rxshift_settings_v1', JSON.stringify({ quality: 'low', voiceDialogue: false })); } catch (e) {} });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push('console: ' + m.text()); });
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
const out = (n) => `/tmp/claude-0/shots/${tag}_${n}.png`;
const sim = (sec) => page.evaluate((s) => { const g = window.__game; for (let i = 0; i < s * 30; i++) g.update(1 / 30); }, sec);
const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(120); };
const check = (name, ok, extra = '') => console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
const TAR = new RegExp('[\u0B80-\u0BFF]');
const TA = { test: (x) => (lang === 'en' ? !TAR.test(x) && x.length > 0 : TAR.test(x)) };

await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 90000 });
await page.waitForTimeout(600);
check('language picker shown', await page.locator('.lang-card').count() === 3);
await page.screenshot({ path: out('01_picker') });
await key({ en: '1', ta: '2', bi: '3' }[lang]);
await page.waitForTimeout(500);
const titleTxt = await page.locator('.title').innerText();
check('title in Tamil', TA.test(titleTxt), titleTxt.slice(0, 60).replace(/\n/g, ' | '));
await page.screenshot({ path: out('02_title') });
await key('Enter'); // start training
await page.waitForTimeout(400);
check('notice in Tamil', TA.test(await page.locator('.modal').innerText()));
await key('Enter');
await page.waitForTimeout(300);
await key('Enter'); // level intro start
await page.waitForTimeout(300);
await page.screenshot({ path: out('03_controls') });
await key('Enter'); // controls got it
await sim(1.2);
const hudTxt = await page.locator('.hud').innerText();
check('HUD in Tamil', TA.test(hudTxt), hudTxt.replace(/\n/g, ' | ').slice(0, 120));
check('kbd badges on', await page.evaluate(() => document.documentElement.classList.contains('kbd')));
await page.screenshot({ path: out('04_play') });
// Guide panel (G key)
await key('g');
await page.waitForTimeout(300);
const gtxt = await page.locator('.guide-panel').innerText().catch(() => '');
check('guide panel opens with steps', gtxt.length > 20 && TA.test(gtxt), gtxt.slice(0, 80).replace(/\n/g, ' | '));
await page.screenshot({ path: out('05_guide') });
await key('Escape');
// jump to level 3 and spawn a known customer (S01 headache, dispense paracetamol/ibuprofen)
await page.evaluate(() => { const g = window.__game; g.ui.closeAll(); g.settings.demoTools = true; g.jumpToLevel(3); });
await page.waitForTimeout(300);
await key('Enter');
await page.evaluate(async () => { const g = window.__game; const m = await import('/src/data/scenarios.js'); g.customers.clearAll(); g.customers.spawn(m.SCENARIOS.find((s) => s.id === 'S01')); });
await sim(16);
await page.evaluate(() => { const g = window.__game; g.startConsultation(g.customers.counterCust); });
await sim(3); await page.waitForTimeout(1300); await sim(1);
const dlg = await page.locator('.sheet').innerText();
check('dialogue in Tamil', TA.test(dlg), dlg.slice(0, 100).replace(/\n/g, ' | '));
const mentor1 = await page.locator('.mentor-bar').innerText().catch(() => '');
check('mentor asks for key questions', TA.test(mentor1) && mentor1.includes('★') && !mentor1.includes('null'), mentor1.slice(0, 90).replace(/\n/g, ' '));
await page.screenshot({ path: out('06_dialogue') });
// ask all 6 questions via keys
for (const k of ['1', '2', '3', '4', '5', '6']) { await key(k); await sim(1); await page.waitForTimeout(800); }
await sim(1);
const mentor2 = await page.locator('.mentor-bar').innerText().catch(() => '');
check('mentor gives medicine hint', TA.test(mentor2), mentor2.slice(0, 120).replace(/\n/g, ' '));
await page.screenshot({ path: out('07_after_questions') });
// "Show me" → cabinet with suggestions
await page.locator('.mentor-bar .btn.primary').click();
await page.waitForTimeout(500);
const sug = await page.locator('.sugtag').count();
check('cabinet shows ★ suggested products', sug > 0, 'count ' + sug);
await page.screenshot({ path: out('08_cabinet') });
// open first suggested product
await page.locator('.prow.sug').first().click().catch(async () => { await page.locator('.sugtag').first().click(); });
await page.waitForTimeout(400);
const med = await page.locator('.modal').last().innerText();
check('medicine card in Tamil', TA.test(med), med.slice(0, 80).replace(/\n/g, ' | '));
check('mentor verdict good', await page.locator('.mentor-card.good').count() > 0);
await page.screenshot({ path: out('09_medicine') });
await key('d'); await page.waitForTimeout(200);
await key('Enter'); // add to customer
await page.waitForTimeout(400);
await key('Escape'); await page.waitForTimeout(200);
await page.evaluate(() => window.__game.ui.closeAll());
const tray = await page.evaluate(() => window.__game.tray.length);
check('product added to tray', tray === 1);
await page.waitForTimeout(200);
await key('Enter'); // safety check from dialogue
await page.waitForTimeout(400);
check('safety tip good', await page.locator('.mentor-card.good').count() > 0, await page.locator('.mentor-card').first().innerText().catch(() => ''));
await page.screenshot({ path: out('10_safety') });
await key('Enter'); // dispense
await page.waitForTimeout(400);
await key('h'); await page.waitForTimeout(200); // mentor tip highlights correct option
const hinted = await page.locator('.opt.hint').count();
check('counsel tip highlights an option', hinted === 1);
await page.locator('.opt.hint').click();
await key('Enter');
await page.waitForTimeout(1600);
const oc = await page.locator('.modal').last().innerText();
check('outcome in Tamil', TA.test(oc), oc.slice(0, 80).replace(/\n/g, ' | '));
await page.screenshot({ path: out('11_outcome') });
await key('Enter');
await sim(14);
// POS
await page.evaluate(() => { const g = window.__game; g.ui.showPOS('checkout'); });
await page.waitForTimeout(300);
await page.screenshot({ path: out('12_pos') });
await key('1'); await key('Enter');
await sim(5); await page.waitForTimeout(500); await sim(4);
check('payment done', await page.evaluate(() => window.__game.state.paidCount >= 1));
// stock-in: order an out-of-stock product from its medicine card
const oosId = await page.evaluate(() => { const g = window.__game; const p = g.catalog.find((x) => x.stock === 0 && g.sectionUnlocked(x.section)); g.ui.closeAll(); g.ui.showMedicine(p); return p.id; });
await page.waitForTimeout(300);
await page.screenshot({ path: out('13_oos_card') });
await key('o'); await page.waitForTimeout(300);
check('order placed', await page.evaluate((id) => !!window.__game.pendingOrderFor(id), oosId));
await page.evaluate(() => { const g = window.__game; g.ui.closeAll(); g.ui.showPOS('orders'); });
await page.waitForTimeout(300);
await page.screenshot({ path: out('14_orders') });
await page.evaluate(() => window.__game.ui.closeAll());
await sim(12);
check('delivery arrived', await page.evaluate(() => window.__game.arrivedOrders().length > 0));
const obj = await page.locator('.objective').innerText();
check('objective says receive delivery', TA.test(obj), obj);
await page.evaluate(() => { const g = window.__game; g.interact(g.world.interactables.find((i) => i.id === 'storage')); });
await sim(8); await page.waitForTimeout(400);
await page.screenshot({ path: out('15_receive') });
for (const k of ['1', '2', '3', '4']) await key(k);
await key('Enter');
await page.waitForTimeout(300);
check('stock received', await page.evaluate((id) => window.__game.productById.get(id).stock >= 30, oosId));
// bilingual
await page.evaluate(() => { const g = window.__game; g.ui.closeAll(); g.setLanguage('bi'); g.ui.showMenu(); });
await page.waitForTimeout(400);
check('bilingual spans rendered', await page.locator('.bi .be').count() > 3);
await page.screenshot({ path: out('16_bi_menu') });
await page.evaluate(() => { const g = window.__game; g.ui.closeAll(); g.ui.showMedicine(g.catalog[0]); });
await page.waitForTimeout(300);
await page.screenshot({ path: out('17_bi_medicine') });
// English
await page.evaluate(() => { const g = window.__game; g.ui.closeAll(); g.setLanguage('en'); g.ui.showMedicine(g.catalog[0]); });
await page.waitForTimeout(300);
const enTxt = await page.locator('.modal').last().innerText();
check('English restored', !TAR.test(enTxt) && /MEDICINE INFORMATION/.test(enTxt), enTxt.slice(0, 60).replace(/\n/g, ' | '));
await page.evaluate(() => window.__game.ui.closeAll());
await page.screenshot({ path: out('18_en_play') });
console.log(logs.length ? 'ERRORS:\n' + logs.join('\n') : 'no page errors');
await browser.close();

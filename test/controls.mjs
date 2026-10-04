import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
for (const [w, h, tag] of [[844, 390, 'L'], [390, 844, 'P']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('rxshift_settings_v1', JSON.stringify({ quality: 'low', acceptedNotice: true })); });
  await page.goto('http://localhost:5173/');
  await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
  await page.getByText(/Start first shift/).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `/tmp/claude-0/shots/ctl_${tag}.png` });
  await page.close();
}
await browser.close();

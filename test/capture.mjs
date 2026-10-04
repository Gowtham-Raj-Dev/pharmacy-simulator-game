import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[PAGEERROR] ${err.message}`));

console.log('Navigating to http://localhost:5173/...');
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

// Wait until loading screen is removed (lbar disappears or window.__game is initialized)
await page.waitForFunction(() => !!window.__game && (!document.getElementById('loading') || document.getElementById('loading').style.display === 'none' || document.getElementById('loading').classList.contains('hidden')), null, { timeout: 60000 });

console.log('Game initialized!');

// Check if title screen is up
const startBtn = page.locator('button:has-text("START"), button:has-text("START SHIFT"), button:has-text("Play"), .tbtn.pri').first();
if (await startBtn.count() > 0 && await startBtn.isVisible()) {
  console.log('Clicking start button...');
  await startBtn.click();
} else {
  // Try calling startPlay directly if title screen
  await page.evaluate(() => {
    if (window.__game) {
      window.__game.ui._title?.remove();
      window.__game.ui._title = null;
      window.__game.startPlay(true);
      window.__game.ui.closeAll();
    }
  });
}

// Wait for a few frames of 3D rendering
await page.waitForTimeout(3000);

await page.screenshot({ path: 'test/pharmacy_view.png' });
console.log('Screenshot saved to test/pharmacy_view.png');

await browser.close();

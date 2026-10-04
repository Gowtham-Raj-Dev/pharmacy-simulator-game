// Builds the website folder (site/) from the game build (dist/):
//   site/index.html                      home page: "Play in browser" or "Download APK"
//   site/rxshift-sim/                    the game (dist/ copied as-is: index.html + people/)
//   site/download/RxShift-Pharmacy-Sim.apk
// Upload the whole site/ folder to any static host. Run: npm run site
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist'), SITE = join(ROOT, 'site');
const GAME_PATH = 'rxshift-sim';

if (!existsSync(join(DIST, 'index.html'))) { console.error('dist/index.html missing: run "npm run build" first'); process.exit(1); }
rmSync(SITE, { recursive: true, force: true });
mkdirSync(join(SITE, 'download'), { recursive: true });

// game
cpSync(DIST, join(SITE, GAME_PATH), { recursive: true });

// APK: the signed release if present, otherwise the debug build
const apk = ['RxShift-Pharmacy-Sim.apk', 'RxShift-Pharmacy-Sim-debug.apk'].map((f) => join(ROOT, f)).find(existsSync);
let size = '';
if (apk) {
  copyFileSync(apk, join(SITE, 'download', 'RxShift-Pharmacy-Sim.apk'));
  size = (statSync(apk).size / 1048576).toFixed(0) + ' MB';
  console.log('• APK   ', apk.replace(ROOT, '.'), size);
} else console.warn('• APK    none found: the download button will be disabled');

// home page
const home = readFileSync(join(ROOT, 'site-src', 'index.html'), 'utf8').replace('__APK_SIZE__', size);
writeFileSync(join(SITE, 'index.html'), home);
console.log(`• site/  ready → index.html (home), ${GAME_PATH}/ (game), download/`);

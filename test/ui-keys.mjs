import fs from 'fs';
import { EN } from '../src/i18n/en.js';
const files = ['src/ui/ui.js', 'src/ui/panels.js', 'src/game.js', 'src/systems/evaluation.js', 'src/systems/guide.js', 'src/systems/customers.js', 'src/world/pharmacy.js', 'src/world/textures.js', 'src/main.js', 'src/i18n/content.js'].filter((f) => fs.existsSync(f));
const missing = new Set();
for (const f of files) { const s = fs.readFileSync(f, 'utf8'); for (const m of s.matchAll(/\bt\(\s*'([^']+)'/g)) if (!m[1].endsWith('.') && !(m[1] in EN)) missing.add(f + ': ' + m[1]); }
console.log(missing.size ? [...missing].join('\n') : 'all keys present', '| EN keys:', Object.keys(EN).length);
if (process.argv[2] === 'export') {
  const keys = Object.keys(EN); const half = Math.ceil(keys.length / 2);
  fs.writeFileSync('src/i18n/parts/en/ui.1.json', JSON.stringify(Object.fromEntries(keys.slice(0, half).map((k) => [k, EN[k]])), null, 1));
  fs.writeFileSync('src/i18n/parts/en/ui.2.json', JSON.stringify(Object.fromEntries(keys.slice(half).map((k) => [k, EN[k]])), null, 1));
  console.log('exported', half, keys.length - half);
}

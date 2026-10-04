// Merge translated parts into src/i18n/ta/*.json (and the English counterparts into src/i18n/en_merged for reference).
import fs from 'fs';
const P = 'src/i18n/parts/';
const groups = { scenarios: ['scenarios_a', 'scenarios_b'], questions: ['questions'], products: ['products_a', 'products_b'], phrases: ['phrases'], misc: ['misc'], ui: ['ui'] };
fs.mkdirSync('src/i18n/ta', { recursive: true });
for (const lang of ['en', 'ta']) {
  for (const [out, prefixes] of Object.entries(groups)) {
    const files = fs.readdirSync(P + lang).filter((f) => prefixes.some((p) => f.startsWith(p + '.'))).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    const res = {};
    for (const f of files) {
      const o = JSON.parse(fs.readFileSync(P + lang + '/' + f, 'utf8'));
      for (const [k, v] of Object.entries(o)) {
        const base = k.replace(/#\d+$/, '');
        if (base !== k) { if (Array.isArray(v)) res[base] = [...(res[base] || []), ...v]; else res[base] = { ...(res[base] || {}), ...v }; }
        else res[k] = v;
      }
    }
    if (lang === 'ta') fs.writeFileSync(`src/i18n/ta/${out}.json`, JSON.stringify(res));
    else { fs.mkdirSync('test/.en', { recursive: true }); fs.writeFileSync(`test/.en/${out}.json`, JSON.stringify(res)); }
    console.log(lang, out, files.length, Buffer.byteLength(JSON.stringify(res)));
  }
}

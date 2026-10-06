import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

// The apps' page: written as index.html (Capacitor and the lite APK open that), with the inlined game
// script (≈4.6 MB) moved from <head> to the end of <body>. Module scripts run after the page is parsed
// either way, but now the loading screen is parsed (and painted) before the browser reads the script.
const appIndex = (outDir) => ({
  name: 'app-index',
  apply: 'build',
  writeBundle() {
    const src = resolve(outDir, 'app.html');
    let html = readFileSync(src, 'utf8');
    const a = html.indexOf('<script type="module"'), b = html.indexOf('</script>', a);
    if (a < 0 || b < 0) throw new Error('app-index: no module script in app.html');
    const script = html.slice(a, b + 9);
    html = html.slice(0, a) + html.slice(b + 9);
    const end = html.lastIndexOf('</body>');
    html = html.slice(0, end) + script + '\n' + html.slice(end);
    writeFileSync(resolve(outDir, 'index.html'), html);
    unlinkSync(src);
  },
});

// Single-file build: the whole game (Three.js, data, UI) ships as one
// offline HTML file. Works inside Capacitor's WebView with no network.
//   vite build             → dist/      the website: index.html (landing page + game)
//   vite build --mode app  → dist-app/  the installed apps: app.html (game only), written as index.html
export default defineConfig(({ mode }) => {
  const app = mode === 'app';
  const outDir = app ? 'dist-app' : 'dist';
  return {
    base: './',
    plugins: [
      viteSingleFile(),
      app && appIndex(outDir),
    ],
    // native projects and build outputs are rewritten by Gradle / cap sync; watching them crashes the dev server on Windows
    server: { watch: { ignored: ['**/android/**', '**/android-lite/**', '**/ios/**', '**/dist/**', '**/dist-app/**', '**/site/**'] } },
    build: {
      outDir,
      target: 'es2020',
      assetsInlineLimit: 100000000,
      chunkSizeWarningLimit: 4000,
      cssCodeSplit: false,
      minify: 'esbuild',
      rollupOptions: app ? { input: 'app.html' } : undefined,
    },
  };
});

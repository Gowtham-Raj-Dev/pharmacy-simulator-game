import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync, writeFileSync, unlinkSync, rmSync, cpSync, existsSync } from 'node:fs';
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
  // website-only files from public/ (the home page's trailer) don't go into the apps
  closeBundle() { rmSync(resolve(outDir, 'video'), { recursive: true, force: true }); },
});

// The Android app's voices: the Opus recordings in app-voices/ (tools/app_voices.py) take the place of the
// website's MP3s copied from public/. Same lines, same voices, about a third of the size.
const appVoices = (outDir) => ({
  name: 'app-voices',
  apply: 'build',
  closeBundle() {
    if (!existsSync('app-voices/en')) throw new Error('app-voices/ missing: run "python tools/app_voices.py"');
    const dst = resolve(outDir, 'audio/voices');
    rmSync(dst, { recursive: true, force: true });
    cpSync('app-voices', dst, { recursive: true, filter: (f) => !f.endsWith('.json') });
  },
});

// Single-file build: the whole game (Three.js, data, UI) ships as one
// offline HTML file. Works inside Capacitor's WebView with no network.
//   vite build                 → dist/      the website: index.html (landing page + game)
//   vite build --mode app      → dist-app/  the installed apps: app.html (game only), written as index.html
//   vite build --mode app-mp3  → dist-app/  the same with the MP3 voices (iOS: older WebKit can't decode Opus)
export default defineConfig(({ mode }) => {
  const app = mode === 'app' || mode === 'app-mp3';
  const opus = mode === 'app';
  const outDir = app ? 'dist-app' : 'dist';
  return {
    base: './',
    define: { __VOICE_EXT__: JSON.stringify(opus ? 'ogg' : 'mp3') },
    plugins: [
      viteSingleFile(),
      app && appIndex(outDir),
      opus && appVoices(outDir),
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

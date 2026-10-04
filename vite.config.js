import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single-file build: the whole game (Three.js, data, UI) ships as one
// offline HTML file. Works inside Capacitor's WebView with no network.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  // native projects and build outputs are rewritten by Gradle / cap sync; watching them crashes the dev server on Windows
  server: { watch: { ignored: ['**/android/**', '**/android-lite/**', '**/ios/**', '**/dist/**', '**/site/**'] } },
  build: {
    outDir: 'dist',
    target: 'es2020',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 4000,
    cssCodeSplit: false,
    minify: 'esbuild',
  },
});

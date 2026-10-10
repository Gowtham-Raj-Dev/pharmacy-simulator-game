// Write the game's own generated music loops to WAV, for the trailer's soundtrack:
//   tools/promo/work/music-calm.wav (32 s loop) and music-inspection.wav (16 s loop).
// They are rendered by the game's audio code (src/core/audio.js, OfflineAudioContext), not recorded live.
//   npx vite --port 5199 --strictPort    then    node tools/promo/music.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WORK = path.join(path.dirname(fileURLToPath(import.meta.url)), 'work');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:5199/tools/promo/blank.html');
for (const mode of ['calm', 'inspection']) {
  const { sr, b64 } = await page.evaluate(async (mode) => {
    const { AudioSys } = await import('/src/core/audio.js');
    const a = new AudioSys({}); a.ctx = new AudioContext({ sampleRate: 48000 });   // only used for its sample rate and createBuffer
    const buf = await a._renderLoop(mode);
    const n = buf.length, L = buf.getChannelData(0), R = buf.getChannelData(buf.numberOfChannels > 1 ? 1 : 0);
    const pcm = new Int16Array(n * 2);
    for (let i = 0; i < n; i++) { pcm[i * 2] = Math.max(-1, Math.min(1, L[i])) * 32767; pcm[i * 2 + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
    let s = ''; const u8 = new Uint8Array(pcm.buffer);
    for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode(...u8.subarray(i, i + 32768));
    return { sr: buf.sampleRate, b64: btoa(s) };
  }, mode);
  const data = Buffer.from(b64, 'base64'), h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(WORK, `music-${mode}.wav`), Buffer.concat([h, data]));
  console.log(mode, (data.length / 4 / sr).toFixed(1) + ' s');
}
await browser.close();

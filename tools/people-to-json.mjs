// Re-pack the avatar GLBs for hosts that only serve web file types (.json / .jpg / .png):
//   people/<id>.json      glTF JSON with the binary buffer embedded as base64 (extras.rxBin)
//   people/<id>_<n>.jpg   textures as plain image files
// The game loads these when window.RX_PEOPLE_FORMAT === 'json' (see src/world/rocketbox.js).
//
//   node tools/people-to-json.mjs dist/people out/people
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const [,, src = 'dist/people', out = 'dist-json/people'] = process.argv;
fs.mkdirSync(out, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const tmp = fs.mkdtempSync('/tmp/rxjson-');
for (const f of fs.readdirSync(src)) {
  if (!f.endsWith('.glb')) { fs.copyFileSync(path.join(src, f), path.join(out, f)); continue; }
  const id = f.replace(/\.glb$/, '');
  const doc = await io.read(path.join(src, f));
  doc.getRoot().listTextures().forEach((t, i) => t.setURI(`${id}_${i}.${t.getMimeType() === 'image/png' ? 'png' : 'jpg'}`));
  doc.getRoot().listBuffers().forEach((b) => b.setURI(`${id}.bin`));
  const { json, resources } = await io.writeJSON(doc);
  const bin = resources[`${id}.bin`];
  for (const [name, data] of Object.entries(resources)) if (name !== `${id}.bin`) fs.writeFileSync(path.join(out, name), data);
  json.buffers = [{ byteLength: bin.byteLength }];
  json.extras = { ...(json.extras || {}), rxBin: Buffer.from(bin).toString('base64') };
  fs.writeFileSync(path.join(out, id + '.json'), JSON.stringify(json));
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log('packed', fs.readdirSync(out).length, 'files into', out);

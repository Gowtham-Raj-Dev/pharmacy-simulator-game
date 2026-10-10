// Shrink the avatar GLBs in public/people/ without changing a single pixel, vertex or keyframe:
//   • hair / opacity PNGs → lossless WebP (EXT_texture_webp; every RGBA value kept, even under alpha 0)
//   • COLOR_0 that is pure white everywhere is dropped (it only multiplied the colour by 1)
//   • JOINTS_0 as 8-bit when the skeleton has under 256 bones (same indices)
//   • geometry + animation packed with meshopt in its lossless mode (EXT_meshopt_compression,
//     no quantization or filters; the game sets GLTFLoader's MeshoptDecoder)
// JPEG textures are left untouched. Every file is decoded again and compared with the original
// before it is written; any difference aborts. Already optimized files are skipped.
//
//   node tools/optimize-people.mjs            (all of public/people)
//   node tools/optimize-people.mjs a.glb …    (some files)
// Needs Python with Pillow (for the WebP encoder's "exact" mode).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rx-people-'));
const PY = `
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src); im.load()
im.save(dst, 'WEBP', lossless=True, exact=True, quality=100, method=6)
back = Image.open(dst); back.load()
if back.mode != im.mode or back.size != im.size or back.tobytes() != im.tobytes(): sys.exit('webp differs from png: ' + src)
`;
function pngToWebp(png) {
  const a = path.join(tmp, 'in.png'), b = path.join(tmp, 'out.webp');
  fs.writeFileSync(a, png);
  execFileSync(process.platform === 'win32' ? 'python' : 'python3', ['-c', PY, a, b], { stdio: 'inherit' });
  return fs.readFileSync(b);
}
const pixels = (img) => {
  const a = path.join(tmp, 'px.img'), b = path.join(tmp, 'px.raw');
  fs.writeFileSync(a, img);
  execFileSync(process.platform === 'win32' ? 'python' : 'python3', ['-c',
    'import sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert("RGBA")\nopen(sys.argv[2],"wb").write(im.tobytes())', a, b]);
  return fs.readFileSync(b);
};

const allWhite = (a) => { const v = a.getArray(); for (let i = 0; i < v.length; i++) if (v[i] !== 1) return false; return true; };

/** Everything the renderer reads, as plain values (decoded), keyed by a stable path. */
function snapshot(doc) {
  const s = new Map(), root = doc.getRoot();
  const put = (k, acc) => { if (!acc) return; const n = acc.getCount(), e = acc.getElementSize(), out = new Float64Array(n * e), el = []; for (let i = 0; i < n; i++) { acc.getElement(i, el); out.set(el, i * e); } s.set(k, out); };
  root.listMeshes().forEach((m, mi) => m.listPrimitives().forEach((p, pi) => {
    for (const sem of p.listSemantics()) if (sem !== 'COLOR_0') put(`m${mi}p${pi}.${sem}`, p.getAttribute(sem));
    // triangles as sets (meshopt may rotate a triangle's corners, keeping the winding)
    const idx = p.getIndices()?.getArray();
    if (idx) {
      const tris = [];
      for (let i = 0; i < idx.length; i += 3) { const t = [idx[i], idx[i + 1], idx[i + 2]], r = t.indexOf(Math.min(...t)); tris.push(`${t[r]},${t[(r + 1) % 3]},${t[(r + 2) % 3]}`); }
      s.set(`m${mi}p${pi}.tris`, tris.join(';'));
    }
    p.listTargets().forEach((t, ti) => { for (const sem of t.listSemantics()) put(`m${mi}p${pi}t${ti}.${sem}`, t.getAttribute(sem)); });
    s.set(`m${mi}p${pi}.material`, p.getMaterial()?.getName());
  }));
  root.listAnimations().forEach((a) => a.listChannels().forEach((c, ci) => {
    put(`a:${a.getName()}:${ci}:${c.getTargetNode()?.getName()}.${c.getTargetPath()}.in`, c.getSampler().getInput());
    put(`a:${a.getName()}:${ci}:${c.getTargetNode()?.getName()}.${c.getTargetPath()}.out`, c.getSampler().getOutput());
  }));
  root.listSkins().forEach((sk, i) => { put(`skin${i}.ibm`, sk.getInverseBindMatrices()); s.set(`skin${i}.joints`, sk.listJoints().map((j) => j.getName()).join(',')); });
  root.listNodes().forEach((n) => s.set(`node:${n.getName()}`, JSON.stringify([n.getTranslation(), n.getRotation(), n.getScale(), n.listChildren().map((c) => c.getName())])));
  root.listMaterials().forEach((m) => {
    s.set(`mat:${m.getName()}`, JSON.stringify([m.getAlphaMode(), m.getAlphaCutoff(), m.getDoubleSided(), m.getBaseColorFactor(), m.getRoughnessFactor(), m.getMetallicFactor(), m.getNormalScale()]));
    for (const [k, t] of [['base', m.getBaseColorTexture()], ['normal', m.getNormalTexture()]]) if (t) s.set(`tex:${m.getName()}.${k}`, t.getMimeType() === 'image/jpeg' ? t.getImage() : pixels(t.getImage()));
  });
  return s;
}
function same(a, b) {
  if (typeof a === 'string' || typeof b === 'string' || a === undefined || b === undefined) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const files = process.argv.length > 2 ? process.argv.slice(2) : fs.readdirSync('public/people').filter((f) => f.endsWith('.glb')).map((f) => path.join('public/people', f));
let before = 0, after = 0;
for (const file of files) {
  const src = fs.readFileSync(file);
  const doc = await io.readBinary(new Uint8Array(src));
  const root = doc.getRoot();
  if (root.listExtensionsUsed().some((e) => e.extensionName === 'EXT_meshopt_compression')) { console.log('skip (already optimized)', file); continue; }
  const ref = snapshot(doc);

  let webp = false;
  for (const t of root.listTextures()) if (t.getMimeType() === 'image/png') { t.setImage(new Uint8Array(pngToWebp(t.getImage()))).setMimeType('image/webp'); webp = true; }
  if (webp) doc.createExtension(EXTTextureWebP).setRequired(true);
  const maxJoints = Math.max(0, ...root.listSkins().map((s) => s.listJoints().length));
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    const c = p.getAttribute('COLOR_0');
    if (c && allWhite(c)) p.setAttribute('COLOR_0', null);
    const j = p.getAttribute('JOINTS_0');
    if (j && maxJoints <= 256 && j.getComponentType() !== 5121) j.setArray(new Uint8Array(j.getArray()));
  }
  await doc.transform(dedup(), prune());
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const out = await io.writeBinary(doc);

  // decode the result and compare it with the original, value by value
  const got = snapshot(await io.readBinary(out));
  const bad = [...new Set([...ref.keys(), ...got.keys()])].filter((k) => !same(ref.get(k), got.get(k)));
  if (bad.length) throw new Error(`${file}: optimized file differs from the original in ${bad.slice(0, 5).join(', ')}`);
  fs.writeFileSync(file, out);
  before += src.length; after += out.length;
  console.log(path.basename(file).padEnd(18), (src.length / 1e6).toFixed(2), '→', (out.length / 1e6).toFixed(2), 'MB  identical');
}
fs.rmSync(tmp, { recursive: true, force: true });
if (before) console.log(`total ${(before / 1e6).toFixed(2)} → ${(after / 1e6).toFixed(2)} MB`);

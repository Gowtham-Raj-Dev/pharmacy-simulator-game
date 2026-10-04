// Optimise the bundled human models: drop animations, re-encode textures as JPEG (max 1024px), quantize meshes.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, quantize } from '@gltf-transform/functions';
import { execFileSync } from 'child_process';
import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const jobs = [['/tmp/claude-0/models/readyplayer.me.glb', 'src/assets/humans/male.glb', 1024], ['/tmp/claude-0/models/Michelle.glb', 'src/assets/humans/female.glb', 1024]];
const tmp = '/tmp/claude-0/texopt'; fs.mkdirSync(tmp, { recursive: true });
for (const [src, dst, max] of jobs) {
  const doc = await io.read(src);
  const root = doc.getRoot();
  for (const a of root.listAnimations()) a.dispose();
  let k = 0;
  for (const tex of root.listTextures()) {
    const img = tex.getImage(); if (!img) continue;
    const isNormal = root.listMaterials().some((m) => m.getNormalTexture() === tex);
    const inF = `${tmp}/in_${k}`, outF = `${tmp}/out_${k}.jpg`; k++;
    fs.writeFileSync(inF, Buffer.from(img));
    execFileSync('python3', ['-c', `
from PIL import Image
im = Image.open('${inF}').convert('RGB')
m = ${max}
if max(im.size) > m: im.thumbnail((m, m), Image.LANCZOS)
im.save('${outF}', 'JPEG', quality=${isNormal ? 90 : 84}, optimize=True)
`]);
    tex.setImage(new Uint8Array(fs.readFileSync(outF))).setMimeType('image/jpeg').setURI('');
  }
  await doc.transform(dedup(), prune(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8 }));
  await io.write(dst, doc);
  console.log(dst, (fs.statSync(dst).size / 1024).toFixed(0) + ' KB', 'from', (fs.statSync(src).size / 1024).toFixed(0) + ' KB');
}

// Import Microsoft Rocketbox avatars (MIT licence, github.com/microsoft/Microsoft-Rocketbox)
// as compact game-ready GLBs in public/people/.
//
//   node tools/rocketbox-import.mjs Adults/Female_Adult_02:rbF02 Adults/Male_Adult_05:rbM05 …
//   node tools/optimize-people.mjs      (afterwards: lossless packing, meshopt geometry + WebP hair layer)
//
// For each avatar: download the FBX + textures, convert with FBX2glTF, swap the
// placeholder textures for resized JPEGs (colour 1024², normal 512²) and a 512² PNG
// for the alpha-tested hair/opacity layer, and set the PBR factors used in-game.
// Animations are not stored per avatar: at runtime every avatar shares the
// mocap clips (idle / walk / talk / sit …) of a same-gender donor model.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup } from '@gltf-transform/functions';

const REPO = 'https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/Assets/Avatars';
const TMP = process.env.RB_TMP || '/tmp/claude-0/rb';
const OUT = path.resolve(process.env.RB_OUT || 'public/people');
const FBX2GLTF = path.resolve('node_modules/fbx2gltf/bin/Linux/FBX2glTF');
fs.mkdirSync(TMP, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const curl = (url, file) => execFileSync('curl', ['-sSf', '--retry', '3', '-o', file, url], { stdio: 'inherit' });
const py = (code) => execFileSync('python3', ['-c', code], { stdio: 'inherit' });

async function importOne(spec) {
  const [src, name] = spec.split(':');
  const base = path.basename(src);
  const dir = path.join(TMP, base); fs.mkdirSync(dir, { recursive: true });
  const fbx = path.join(dir, base + '.fbx');
  if (!fs.existsSync(fbx)) curl(`${REPO}/${src}/Export/${base}.fbx`, fbx);
  const strs = fs.readFileSync(fbx).toString('latin1');
  const bm = strs.match(/([fm]\d{3})_body_color(_[a-z0-9]+)?\.tga/);
  const pfx = bm?.[1], bodyVariant = bm?.[2] || '';
  if (!pfx) throw new Error('no texture prefix in ' + src);
  const hasOpacity = strs.includes(pfx + '_opacity_color.tga');
  // texture sizes (env RB_COLOR / RB_NORMAL / RB_HAIR, e.g. 2048 / 1024 / 1024 for the player character)
  const C = +(process.env.RB_COLOR || 1024), N = +(process.env.RB_NORMAL || 512), Hh = +(process.env.RB_HAIR || 512);
  const want = [['body_color', C, 'jpg'], ['body_normal', N, 'jpg'], ['head_color', C, 'jpg'], ['head_normal', N, 'jpg']];
  if (hasOpacity) want.push(['opacity_color', Hh, 'png']);
  const imgs = {};
  for (const [k, size, fmt] of want) {
    const out = path.join(dir, `${k}_${size}.${fmt}`);
    if (!fs.existsSync(out)) {
      const tga = path.join(dir, `${k}.tga`);
      curl(`${REPO}/${src}/Textures/${pfx}_${k}${k === 'body_color' ? bodyVariant : ''}.tga`, tga);
      py(`from PIL import Image\nim=Image.open(${JSON.stringify(tga)})\n` +
        (fmt === 'jpg' ? `im=im.convert('RGB').resize((${size},${size}),Image.LANCZOS)\nim.save(${JSON.stringify(out)},quality=${k.includes('normal') ? 88 : 84},optimize=True,progressive=True)`
          : `im=im.convert('RGBA').resize((${size},${size}),Image.LANCZOS)\nim.save(${JSON.stringify(out)},optimize=True)`));
      fs.rmSync(tga);
    }
    imgs[k] = fs.readFileSync(out);
  }
  const glbTmp = path.join(dir, 'raw');
  execFileSync(FBX2GLTF, ['--binary', '--input', fbx, '--output', glbTmp], { stdio: 'ignore' });
  const doc = await io.read(glbTmp + '.glb');
  const root = doc.getRoot();
  for (const t of root.listTextures()) t.dispose();
  for (const a of root.listAnimations()) a.dispose();
  const tex = (k, mime) => doc.createTexture(`${name}_${k}`).setImage(imgs[k]).setMimeType(mime);
  for (const m of root.listMaterials()) {
    const n = m.getName();
    m.setMetallicFactor(0).setEmissiveFactor([0, 0, 0]).setBaseColorFactor([1, 1, 1, 1]);
    if (n.endsWith('_body')) m.setBaseColorTexture(tex('body_color', 'image/jpeg')).setNormalTexture(tex('body_normal', 'image/jpeg')).setRoughnessFactor(0.85);
    else if (n.endsWith('_head')) m.setBaseColorTexture(tex('head_color', 'image/jpeg')).setNormalTexture(tex('head_normal', 'image/jpeg')).setRoughnessFactor(0.62);
    else if (n.endsWith('_opacity') && imgs.opacity_color) m.setBaseColorTexture(tex('opacity_color', 'image/png')).setNormalTexture(null).setAlphaMode('MASK').setAlphaCutoff(0.45).setDoubleSided(true).setRoughnessFactor(0.55);
  }
  await doc.transform(dedup(), prune());
  const out = path.join(OUT, name + '.glb');
  await io.write(out, doc);
  console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB', pfx, hasOpacity ? '+hair' : '');
}

for (const spec of process.argv.slice(2)) {
  try { await importOne(spec); } catch (e) { console.error('FAILED', spec, e.message); }
}

// RxShift bootstrap: renderer, environment, asynchronous loading, render loop.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildCatalog } from './data/products.js';
import { buildPharmacy, PROBE } from './world/pharmacy.js';
import { RealHumans, Rocketbox } from './world/character.js';
import { Game } from './game.js';
import { UI } from './ui/ui.js';
import { AudioSys } from './core/audio.js';
import { loadGame, loadSettings, newGameState } from './core/state.js';
import { nextFrame } from './core/util.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import { setLang, getLang } from './i18n/i18n.js';
import { initContent, applyContent } from './i18n/content.js';
import { initShortcuts } from './ui/keys.js';

// Colour grade: Khronos PBR Neutral tone mapping (keeps whites from blowing out and product colours
// true) + a touch of saturation and contrast. Runs inside every material's shader — no extra pass.
THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace(
  'vec3 CustomToneMapping( vec3 color ) { return color; }',
  `vec3 CustomToneMapping( vec3 color ) {
    vec3 c = NeutralToneMapping( color );
    float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
    c = max( mix( vec3( l ), c, 1.1 ), 0.0 );
    return pow( c, vec3( 1.07 ) );
  }`);

async function boot(overrideLang) {
  const setL = (p, t) => { const b = document.getElementById('lbar'); const s = document.getElementById('lstep'); if (b) b.style.width = Math.round(p * 100) + '%'; if (s && t) s.textContent = t; };
  setL(0.04, 'Preparing renderer…');
  const canvas = document.getElementById('gl');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance', stencil: false });
  } catch (e) {
    document.querySelector('.lstep').textContent = 'WebGL is not available on this device/browser.';
    return;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.CustomToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  const settings = await loadSettings();
  if (overrideLang && !settings.lang) settings.lang = overrideLang;
  const saved = await loadGame();
  const state = saved || newGameState();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdde8ee);
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.05, 60);
  camera.position.set(2, 2.2, 6);
  await nextFrame();
  setL(0.12, 'Lighting the pharmacy…');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = roomEnv.texture;
  scene.environmentIntensity = 0.55;
  await nextFrame();
  setL(0.2, 'Stocking 1,300 catalog items…');
  const catalog = buildCatalog();
  initContent(catalog);
  if (settings.lang) { setLang(settings.lang); applyContent(getLang()); }
  try { await Promise.race([Promise.all([document.fonts.load('700 40px "Noto Sans Tamil"', 'அ'), document.fonts.load('400 20px "Noto Sans Tamil"', 'அ')]), new Promise((r) => setTimeout(r, 1500))]); } catch { /* ignore */ }
  await nextFrame();
  setL(0.3, 'Building shelves, counters and signage…');
  const desktop = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  const world = buildPharmacy(scene, { quality: settings.quality, anisotropy: Math.min(desktop ? 16 : 8, renderer.capabilities.getMaxAnisotropy()) });
  await nextFrame();
  // Reflection probe: capture the finished pharmacy itself (shelves, counter, light panels) as the
  // environment, so the glossy floor and fittings reflect the real room (box-projected in pharmacy.js).
  try {
    const envRT = pmrem.fromScene(scene, 0.012, 0.05, 40, { size: 256, position: PROBE });
    scene.environment = envRT.texture; roomEnv.dispose();
  } catch (e) { console.warn('probe capture failed', e); }
  pmrem.dispose();
  setL(0.42, 'Generating realistic people…');
  RealHumans.enabled = settings.realHumans !== false;
  if (RealHumans.enabled) await RealHumans.load();
  // Rocketbox avatars (pharmacist, inspector-doctor and the clip donors); visitors load with the customers
  // (avatars are separate files: a page opened straight from disk (file://) can't fetch them → generated people)
  Rocketbox.enabled = settings.realHumans !== false && location.protocol !== 'file:';
  // texture budgets: PCs and Ultra phones get everything at full resolution (the pharmacist at 2048²);
  // other phones keep full-res visitors on High but load fewer of them, and smaller textures on Medium / Low
  const q = settings.quality;
  Rocketbox.texBudget = desktop || q === 'ultra' || q === 'high' ? null : q === 'medium' ? { head: 768, body: 512, normal: 256 } : { head: 512, body: 512, normal: 256 };
  Rocketbox.playerBudget = desktop || q === 'ultra' ? null : q === 'high' ? { head: 1536, body: 1536, normal: 1024 } : { head: 1024, body: 1024, normal: 512 };
  Rocketbox.maxVisitors = desktop || q === 'ultra' ? 0 : q === 'high' ? 18 : q === 'medium' ? 14 : 12;
  if (Rocketbox.enabled) { setL(0.46, 'Bringing in the pharmacist…'); await Rocketbox.loadAll(['pharmacistF', 'doctor']); }
  await nextFrame();
  setL(0.5, 'Hiring the pharmacist…');
  const audio = new AudioSys(settings);
  audio.lang = getLang();
  const game = new Game({ renderer, scene, camera, world, audio, settings, state, catalog });
  const ui = new UI(document.getElementById('ui'), game);
  game.attachUI(ui);
  audio.onMissingVoice = () => ui.toast(getLang() === 'en' ? 'Tamil voice not installed: Settings › Text-to-speech › Google › install Tamil' : 'தமிழ் குரல் நிறுவப்படவில்லை: Settings › Text-to-speech › Google › Tamil நிறுவவும்', 'warn', 'info', 6000);
  audio.onMissingVoiceWeb = () => ui.toast(getLang() === 'en' ? 'This browser has no Tamil voice. For Tamil speech use Microsoft Edge (Pallavi / Valluvar voices) or Chrome on Android.' : 'இந்த பிரவுசரில் தமிழ் குரல் இல்லை. தமிழ் பேச்சுக்கு Microsoft Edge (Pallavi / Valluvar) அல்லது Android Chrome பயன்படுத்துங்கள்.', 'warn', 'info', 7000);
  initShortcuts(ui);
  game.applySettings(false);
  await nextFrame();
  setL(0.56, 'Customers are on their way…');
  await game.customers.preload((p) => setL(0.56 + p * 0.32, 'Customers are on their way…'));
  setL(0.9, 'Compiling shaders…');
  await nextFrame();
  try { renderer.compile(scene, camera); } catch { /* ignore */ }
  setL(1, 'Ready');

  // Post-processing (High/Ultra on PC, Ultra on phones): ground-truth ambient occlusion (soft contact
  // shadows where people stand, under shelves and in corners) + bloom glow on Ultra
  let composer = null, bloomPass = null, aoPass = null;
  const ensureComposer = () => {
    if (composer) return composer;
    // multisampled HDR target: keeps edges anti-aliased
    const pr = renderer.getPixelRatio();
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(Math.max(1, window.innerWidth * pr), Math.max(1, window.innerHeight * pr), { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(scene, camera));
    aoPass = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
    aoPass.updateGtaoMaterial({ radius: 0.32, distanceExponent: 1.6, thickness: 1.2, scale: 1.1, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 12 });
    aoPass.blendIntensity = 0.9;
    composer.addPass(aoPass);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.22, 0.35, 1.9);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
    return composer;
  };
  game.onQualityChange = () => { if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(window.innerWidth, window.innerHeight); } world.resizeReflections?.(...game.reflSize()); };
  if (Capacitor.isNativePlatform()) { try { await StatusBar.setOverlaysWebView({ overlay: true }); await StatusBar.hide(); } catch { /* ignore */ } }
  // landscape-only game (the native apps also lock it in their manifests)
  try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch { /* not supported */ }
  // resize
  const onResize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
    world.resizeReflections?.(...game.reflSize());
    camera.aspect = w / h;
    game.rig.baseFov = w < h ? 68 : 55;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
  onResize();

  // render loop with FPS cap, battery-friendly pausing and perf governor
  let last = performance.now(), acc = 0, frames = 0, fpsT = 0, skip = 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    const elapsed = now - last;
    const minFrame = settings.fpsCap === 30 ? 1000 / 30 - 2 : 0;
    if (elapsed < minFrame) return;
    last = now;
    const dt = Math.min(0.05, elapsed / 1000);
    game.update(dt);
    // when a full-screen panel covers the 3D view, render at a low rate to save battery
    if (ui.fullCover && (skip = (skip + 1) % 6) !== 0) return;
    const t0 = performance.now();
    // shadows: rendered once per frame even when several passes draw the scene (AO, reflections)
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
    if (game.bloom || game.ao) {
      if (!composer) { ensureComposer(); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(window.innerWidth, window.innerHeight); }
      aoPass.enabled = !!game.ao; bloomPass.enabled = !!game.bloom;
      composer.render(dt);
    } else renderer.render(scene, camera);
    game.perfTick(Math.max(elapsed, performance.now() - t0));
    frames++; fpsT += elapsed;
    if (fpsT > 500) { ui.setFPS(`${Math.round((frames * 1000) / fpsT)} FPS · ${renderer.info.render.calls} draws · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris · ×${game.pr.toFixed(2)}`); frames = 0; fpsT = 0; }
  };
  requestAnimationFrame(loop);
  ui.hideLoading();
  if (!settings.lang) ui.showLanguagePicker(() => game.showTitle(!!saved));
  else game.showTitle(!!saved);
  window.__game = game; // debugging / automated tests
}

function initApp() {
  const landing = document.getElementById('landing');
  const playBtn = document.getElementById('play-now-btn');

  // Skip landing page if running native (Capacitor Android/iOS) or explicit query/hash
  const isNative = Capacitor.isNativePlatform();
  const directGame = isNative || location.search.includes('game') || location.hash.includes('game');

  if (directGame || !landing) {
    if (landing) landing.classList.add('hidden');
    boot();
    return;
  }

  // Interactive landing page setup
  const root = document.documentElement;
  let savedLang = null;
  try { savedLang = localStorage.getItem('rx-site-lang'); } catch (e) {}
  const initialLang = savedLang || (/^ta/i.test(navigator.language || '') ? 'ta' : 'en');

  function setLandingLang(l) {
    root.lang = l;
    landing.querySelectorAll('.lang button').forEach((b) => b.classList.toggle('on', b.dataset.set === l));
    try { localStorage.setItem('rx-site-lang', l); } catch (e) {}
  }

  landing.querySelectorAll('.lang button').forEach((b) => {
    b.addEventListener('click', () => setLandingLang(b.dataset.set));
  });
  setLandingLang(initialLang);

  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isIos = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webCard = document.getElementById('c-web');
  const apkCard = document.getElementById('c-apk');
  if (isAndroid) {
    apkCard?.classList.add('rec');
    webCard?.classList.remove('rec');
  } else {
    webCard?.classList.add('rec');
    apkCard?.classList.remove('rec');
  }
  if (isIos) {
    const iosNote = document.getElementById('ios-note');
    if (iosNote) iosNote.hidden = false;
    const apkLink = document.getElementById('apk-link');
    apkLink?.setAttribute('aria-disabled', 'true');
  }

  let booted = false;
  function startSimulation() {
    if (booted) return;
    booted = true;
    landing.classList.add('fade-out');
    const selectedLang = root.lang || 'en';
    setTimeout(() => {
      landing.classList.add('hidden');
      boot(selectedLang);
    }, 240);
  }

  playBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    startSimulation();
  });
}

initApp();


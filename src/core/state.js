// Game state + save system (Capacitor Preferences on device, localStorage on web).
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { randi } from './util.js';

const KEY = 'rxshift_save_v1';
const SETTINGS_KEY = 'rxshift_settings_v1';

export const DEFAULT_SETTINGS = {
  textScale: 1,            // 0.9 / 1 / 1.15 / 1.3
  subtitles: true,
  colorSafe: false,
  haptics: true,
  master: 0.9, sfx: 0.9, music: 0.55, voice: 0.85,
  voiceDialogue: true,
  handed: 'right',          // right = joystick on left (right thumb for camera)
  reducedMotion: false,
  quality: null,            // low / medium / high / ultra / auto (null = pick for this device)
  fpsCap: 60,
  showFps: false,
  camSensitivity: 1,
  invertY: false,
  firstPerson: false,
  autoCamera: true,
  lodDebug: false,
  demoTools: false,
  acceptedNotice: false,
  lang: null,               // 'en' | 'ta' | 'bi' (null = ask on first launch)
  guided: true,             // mentor tips
  adaptiveRes: true,        // lower resolution automatically when FPS drops
  realHumans: true,         // realistic generated people (off = lightweight stylised people)
  layout: 1,                // pharmacy layout: 1 = the original, 2 = "Medical 2"
};

export function newGameState() {
  return {
    v: 1,
    level: 1,
    levelObjectives: null,   // [{done,count}] per objective of current level
    careerMode: false,
    xp: 0,
    money: 1500,
    reputation: 50,
    satisfaction: 70,
    safety: 70,
    served: 0,
    servedSafe: 0,
    safeStreak: 0,
    unsafeCount: 0,
    referralsCorrect: 0,
    dailyRevenue: 0,
    day: 1,
    customerCounter: 0,
    stock: {},               // productId → qty override
    restockOrders: 0,
    upgrades: { outfit_default: true },
    outfit: 'default',
    theme: 'modern',
    viewedDetails: {},
    searchedSymptom: false,
    modulesDone: [],
    practiceBest: 0,
    inspection: { nextAt: randi(7, 10), passed: 0, attempts: 0, failed: 0, certified: false, best: 0, active: false },
    achievements: {},
    recentScenarios: [],
    tutorialSeen: {},
    pendingEvents: [],
    orders: [],
    orderCounter: 0,
    lastSaved: 0,
  };
}

const isNative = () => { try { return Capacitor.isNativePlatform(); } catch { return false; } };

async function rawGet(key) {
  try {
    if (isNative()) { const r = await Preferences.get({ key }); return r.value; }
    return localStorage.getItem(key);
  } catch { return null; }
}
async function rawSet(key, value) {
  try {
    if (isNative()) await Preferences.set({ key, value });
    else localStorage.setItem(key, value);
    return true;
  } catch { return false; }
}
async function rawRemove(key) {
  try { if (isNative()) await Preferences.remove({ key }); else localStorage.removeItem(key); } catch { /* ignore */ }
}

export async function loadGame() {
  const s = await rawGet(KEY);
  if (!s) return null;
  try {
    const data = JSON.parse(s);
    if (!data || data.v !== 1) return null;
    return Object.assign(newGameState(), data, { inspection: Object.assign(newGameState().inspection, data.inspection || {}) });
  } catch { return null; }
}
export async function saveGame(state) {
  state.lastSaved = Date.now();
  return rawSet(KEY, JSON.stringify(state));
}
export async function deleteSave() { await rawRemove(KEY); }

export async function loadSettings() {
  const s = await rawGet(SETTINGS_KEY);
  let out;
  try { out = Object.assign({}, DEFAULT_SETTINGS, s ? JSON.parse(s) : {}); } catch { out = { ...DEFAULT_SETTINGS }; }
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  const desk = !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  if (!out.quality) out.quality = desk ? (cores >= 8 ? 'ultra' : 'high') : (cores < 4 || mem < 3 ? 'medium' : 'high');
  else if (!out.gfxV && desk && out.quality === 'high' && cores >= 8) out.quality = 'ultra'; // v2 graphics: PCs get the full preset
  out.gfxV = 2;
  return out;
}
export async function saveSettings(settings) { return rawSet(SETTINGS_KEY, JSON.stringify(settings)); }

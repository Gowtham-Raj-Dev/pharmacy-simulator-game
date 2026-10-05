// Voice cast for the recorded dialogue (public/audio/voices/<en|ta>/<clip>.mp3).
//
// Every customer scenario has a voice of its own: one of four personas per gender (four
// different speakers), pitched and paced for the patient's age, and handed out in turn so
// customers who follow each other never sound alike. The pharmacist and the inspector keep
// one fixed voice all game.
//
// A voice is [Microsoft neural voice, pitch shift in Hz, speaking-rate change in %].
// English uses Indian-English and Hindi voices (both read English with an Indian accent),
// Tamil uses the Tamil voices of India, Sri Lanka, Malaysia and Singapore.
// After changing anything here, re-record:
//   node tools/voice-lines.mjs && python tools/generate_voices.py --prune
import { SCENARIOS } from './scenarios.js';

const PERSONAS = {
  M: [
    { en: ['en-IN-PrabhatNeural', 0, 0], ta: ['ta-IN-ValluvarNeural', 0, 0] },
    { en: ['hi-IN-MadhurNeural', 0, 0], ta: ['ta-LK-KumarNeural', 0, 0] },
    { en: ['en-IN-PrabhatNeural', -9, -3], ta: ['ta-MY-SuryaNeural', 0, 0] },
    { en: ['hi-IN-MadhurNeural', -7, 4], ta: ['ta-SG-AnbuNeural', 0, 0] },
  ],
  F: [
    { en: ['en-IN-NeerjaExpressiveNeural', 0, 0], ta: ['ta-LK-SaranyaNeural', 0, 0] },
    { en: ['hi-IN-SwaraNeural', 0, 0], ta: ['ta-MY-KaniNeural', 0, 0] },
    { en: ['en-IN-NeerjaExpressiveNeural', -12, -3], ta: ['ta-SG-VenbaNeural', 0, 0] },
    { en: ['hi-IN-SwaraNeural', 10, 4], ta: ['ta-IN-PallaviNeural', -12, 0] },
  ],
};
// age bands (young < 26 ≤ adult < 50 ≤ mature < 65 ≤ elderly): [pitch Hz for men, for women, rate %]
const AGE = { y: [6, 10, 5], a: [0, 0, 0], m: [-5, -8, -3], e: [-10, -14, -9] };
const PITCH_LIMIT = { M: [-16, 10], F: [-20, 16] };

export const PHARMACIST = { en: ['en-IN-NeerjaNeural', 0, 0], ta: ['ta-IN-PallaviNeural', 0, 0] };
export const INSPECTOR = { en: ['en-IN-PrabhatNeural', -12, -6], ta: ['ta-IN-ValluvarNeural', -10, -6] };

const band = (age) => (age < 26 ? 'y' : age < 50 ? 'a' : age < 65 ? 'm' : 'e');

let CAST = null;
/** Voice id of a scenario's customer, e.g. 'M2a' (male persona 2, adult). */
export function voiceOf(scn) {
  if (!CAST) {
    CAST = {};
    const n = { M: 0, F: 0 };
    for (const s of SCENARIOS) { const g = s.patient.gender; CAST[s.id] = g + ((n[g]++ % 4) + 1) + band(s.patient.age); }
  }
  return CAST[scn?.id] || 'F1a';
}

/** [voice, pitch, rate] of a customer voice id for 'en' | 'ta', in edge-tts form ('+6Hz', '-9%'). */
export function voiceParams(id, lang) {
  const g = id[0], P = PERSONAS[g][+id[1] - 1][lang], A = AGE[id[2]];
  const [lo, hi] = PITCH_LIMIT[g];
  return fmt([P[0], Math.max(lo, Math.min(hi, P[1] + A[g === 'M' ? 0 : 1])), P[2] + A[2]]);
}
export const fmt = ([voice, pitch, rate]) => [voice, `${pitch < 0 ? '' : '+'}${pitch}Hz`, `${rate < 0 ? '' : '+'}${rate}%`];

/** Every recorded clip a customer may say: complaint, the six answers and the closing lines
 *  (thank-you for each decision, or handing a wrong medicine back). */
export const ANSWER_KEYS = ['duration', 'symptoms', 'allergies', 'meds', 'history', 'lifestyle'];
export const THANKS = ['dispense', 'refer', 'advise', 'emergency', 'return'];
export const thanksClip = (scn, kind) => `thx_${kind}_${voiceOf(scn)}`;
export function customerClips(scn) {
  return [scn.id, ...ANSWER_KEYS.map((k) => `${scn.id}_${k}`), ...THANKS.map((k) => thanksClip(scn, k))];
}
export const PHARMACIST_CLIPS = ['g_hello', ...ANSWER_KEYS.map((k) => `q_${k}`)];

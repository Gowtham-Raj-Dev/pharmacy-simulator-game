// Procedural audio (Web Audio) — no audio files needed, tiny footprint.
// Ambience, SFX, generative music (normal + inspection), optional TTS voices.
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { getLang } from '../i18n/i18n.js';

const TA_VOWELS = {
  '\u0B85': 'a', '\u0B86': 'aa', '\u0B87': 'i', '\u0B88': 'ee', '\u0B89': 'u', '\u0B8A': 'oo',
  '\u0B8E': 'e', '\u0B8F': 'ae', '\u0B90': 'ai', '\u0B92': 'o', '\u0B93': 'oh', '\u0B94': 'au',
  '\u0B83': 'k'
};
const TA_CONSONANTS = {
  '\u0B95': 'k', '\u0B99': 'ng', '\u0B9A': 'ch', '\u0B9C': 'j', '\u0B9E': 'gn',
  '\u0B9F': 't', '\u0BA3': 'n', '\u0BA4': 'th', '\u0BA8': 'n', '\u0BA9': 'n',
  '\u0BAA': 'p', '\u0BAE': 'm', '\u0BAF': 'y', '\u0BB0': 'r', '\u0BB1': 'r',
  '\u0BB2': 'l', '\u0BB3': 'l', '\u0BB4': 'zh', '\u0BB5': 'v',
  '\u0BB6': 'sh', '\u0BB7': 'sh', '\u0BB8': 's', '\u0BB9': 'h'
};
const TA_MATRAS = {
  '\u0BBE': 'aa', '\u0BBF': 'i', '\u0BC0': 'ee', '\u0BC1': 'u', '\u0BC2': 'oo',
  '\u0BC6': 'e', '\u0BC7': 'ae', '\u0BC8': 'ai', '\u0BCA': 'o', '\u0BCB': 'oh', '\u0BCC': 'au'
};
const TA_VIRAMA = '\u0BCD';

export function romanizeTamil(text) {
  if (!text) return '';
  const s = String(text);
  let res = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (TA_VOWELS[ch]) {
      res += TA_VOWELS[ch];
    } else if (TA_CONSONANTS[ch]) {
      const base = TA_CONSONANTS[ch];
      const next = s[i + 1];
      if (next === TA_VIRAMA) {
        res += base;
        i++;
      } else if (TA_MATRAS[next]) {
        res += base + TA_MATRAS[next];
        i++;
      } else {
        res += base + 'a';
      }
    } else {
      res += ch;
    }
  }
  return res.replace(/thth/g, 'tth').replace(/kkaa/g, 'kaa');
}

export class AudioSys {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.ready = false;
    this.musicMode = 'none';
    this._musicTimer = null;
    this._voices = [];
    this._speechQueue = [];
    this._isSpeaking = false;
    this._currentVoiceAudio = null;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    // 'balanced' gives phones a bigger audio buffer: no crackles/drop-outs while the 3D scene renders
    this.ctx = new AC({ latencyHint: 'balanced' });
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.connect(this.master);
    this.ambBus = c.createGain(); this.ambBus.connect(this.master);
    // shared noise buffer
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    }
    this.whiteBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const wd = this.whiteBuf.getChannelData(0);
    for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.startAmbience();
    this.ready = true;
    try { this._voices = speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => { this._voices = speechSynthesis.getVoices(); }; } catch { /* no TTS */ }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
    });
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.music * 0.5, t, 0.2);
    this.ambBus.gain.setTargetAtTime(s.sfx * 0.55, t, 0.2);
  }

  // ── primitives ──
  _env(g, t, a, peak, dcy, sustain = 0) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + dcy);
  }
  tone(freq, dur, { type = 'sine', vol = 0.2, attack = 0.005, at = 0, bus, detune = 0, slide } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    this._env(g, t, attack, vol, dur);
    o.connect(g); g.connect(bus || this.sfxBus);
    o.start(t); o.stop(t + attack + dur + 0.05);
  }
  noise(dur, { vol = 0.2, type = 'bandpass', freq = 1000, q = 1, at = 0, attack = 0.003, bus, white = false, sweep } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + at;
    const src = c.createBufferSource(); src.buffer = white ? this.whiteBuf : this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = c.createGain(); this._env(g, t, attack, vol, dur);
    src.connect(f); f.connect(g); g.connect(bus || this.sfxBus);
    src.start(t, Math.random()); src.stop(t + dur + attack + 0.05);
  }

  // ── named SFX ──
  sfx(name, opts = {}) {
    if (!this.ctx) return;
    const v = opts.vol ?? 1;
    switch (name) {
      case 'click': this.tone(1400, 0.04, { type: 'triangle', vol: 0.06 * v }); break;
      case 'tap': this.tone(900, 0.05, { type: 'sine', vol: 0.08 * v }); this.noise(0.03, { vol: 0.04 * v, freq: 3000 }); break;
      case 'whoosh': this.noise(0.28, { vol: 0.06 * v, type: 'bandpass', freq: 400, sweep: 2400, q: 0.7, attack: 0.08 }); break;
      case 'chime': this.tone(1318.5, 0.9, { vol: 0.12 * v }); this.tone(1046.5, 1.2, { vol: 0.12 * v, at: 0.32 }); break;
      case 'door': this.noise(0.6, { vol: 0.07 * v, type: 'lowpass', freq: 500, sweep: 1500, attack: 0.1 }); this.tone(90, 0.5, { type: 'sine', vol: 0.03 * v, attack: 0.1 }); break;
      case 'step': this.noise(0.07, { vol: 0.09 * v, type: 'bandpass', freq: 700 + Math.random() * 400, q: 1.2 }); this.tone(110 + Math.random() * 30, 0.05, { vol: 0.05 * v }); break;
      case 'shelf': this.tone(190, 0.08, { type: 'triangle', vol: 0.09 * v }); this.noise(0.18, { vol: 0.05 * v, type: 'highpass', freq: 2500, at: 0.02 }); break;
      case 'package':
        for (let i = 0; i < 6; i++) this.noise(0.03, { vol: (0.03 + Math.random() * 0.04) * v, type: 'highpass', freq: 3000 + Math.random() * 3000, at: i * 0.035 + Math.random() * 0.02, white: true });
        break;
      case 'beep': this.tone(1850, 0.08, { type: 'square', vol: 0.05 * v }); break;
      case 'cash':
        this.tone(1850, 0.07, { type: 'square', vol: 0.045 * v });
        this.noise(0.12, { vol: 0.08 * v, type: 'bandpass', freq: 1800, at: 0.12 });
        this.tone(2400, 0.5, { vol: 0.05 * v, at: 0.18 }); this.tone(3600, 0.4, { vol: 0.03 * v, at: 0.18 });
        break;
      case 'notify': this.tone(880, 0.12, { vol: 0.09 * v }); this.tone(1320, 0.2, { vol: 0.09 * v, at: 0.1 }); break;
      case 'correct': [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.1 * v, at: i * 0.07 })); break;
      case 'incorrect': this.tone(150, 0.22, { type: 'sawtooth', vol: 0.06 * v, slide: 110 }); this.tone(140, 0.3, { type: 'sawtooth', vol: 0.06 * v, at: 0.25, slide: 90 }); break;
      case 'complete':
        [523.25, 659.25, 783.99].forEach((f) => this.tone(f, 1.2, { type: 'triangle', vol: 0.07 * v, attack: 0.02 }));
        [783.99, 1046.5, 1318.5, 1568].forEach((f, i) => this.tone(f, 0.4, { type: 'sine', vol: 0.08 * v, at: 0.15 + i * 0.09 }));
        break;
      case 'alarm': for (let i = 0; i < 3; i++) this.tone(2200, 0.09, { type: 'square', vol: 0.04 * v, at: i * 0.18 }); break;
      case 'siren': this.tone(700, 0.6, { vol: 0.03 * v, slide: 1000 }); this.tone(1000, 0.6, { vol: 0.03 * v, at: 0.6, slide: 700 }); break;
      case 'cough':
        this.noise(0.12, { vol: 0.07 * v, type: 'bandpass', freq: 600, q: 0.8, attack: 0.01 });
        this.noise(0.18, { vol: 0.05 * v, type: 'bandpass', freq: 450, q: 0.8, at: 0.16 });
        break;
      case 'sneeze': this.noise(0.08, { vol: 0.03 * v, freq: 2500, at: 0 }); this.noise(0.25, { vol: 0.07 * v, type: 'highpass', freq: 1800, at: 0.35 }); break;
      case 'levelup': this.sfx('complete', opts); this.tone(2093, 0.6, { vol: 0.05 * v, at: 0.55 }); break;
      case 'paper': this.noise(0.22, { vol: 0.05 * v, type: 'highpass', freq: 3500, attack: 0.03 }); break;
      case 'drop': this.tone(300, 0.1, { type: 'sine', vol: 0.08 * v, slide: 180 }); this.sfx('package', { vol: 0.6 * v }); break;
      default: break;
    }
  }

  // ── Ambience: HVAC hum + filtered room tone + occasional distant chatter ──
  startAmbience() {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const g = c.createGain(); g.gain.value = 0.22;
    src.connect(lp); lp.connect(g); g.connect(this.ambBus); src.start();
    const hum = c.createOscillator(); hum.frequency.value = 58; const hg = c.createGain(); hg.gain.value = 0.012;
    hum.connect(hg); hg.connect(this.ambBus); hum.start();
    const chatter = () => {
      if (!this.ctx) return;
      if (this.musicMode !== 'inspection' && Math.random() < 0.6) {
        const n = 3 + Math.floor(Math.random() * 5);
        for (let i = 0; i < n; i++) this.noise(0.12 + Math.random() * 0.15, { bus: this.ambBus, vol: 0.012 + Math.random() * 0.01, type: 'bandpass', freq: 300 + Math.random() * 500, q: 4, at: i * 0.17 + Math.random() * 0.1, attack: 0.04 });
      }
      setTimeout(chatter, 3500 + Math.random() * 6000);
    };
    setTimeout(chatter, 3000);
  }

  // ── Music: each piece is rendered once (OfflineAudioContext) into a seamless loop and played as a
  // looping buffer, so it never stutters when the main thread is busy with 3D rendering ──
  setMusic(mode) {
    if (!this.ctx || mode === this.musicMode) return;
    this.musicMode = mode;
    const t = this.ctx.currentTime;
    if (this._music) { // fade the old piece out
      const { src, g } = this._music;
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 1.6);
      try { src.stop(t + 1.7); } catch { /* ignore */ }
      this._music = null;
    }
    if (mode === 'none') return;
    this._loopBuffer(mode).then((buf) => {
      if (!buf || this.musicMode !== mode || this._music) return;
      const c = this.ctx, now = c.currentTime;
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      const g = c.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, now + 2.5);
      src.connect(g); g.connect(this.musicBus); src.start(now + 0.05);
      this._music = { src, g };
    });
  }
  _loopBuffer(mode) {
    this._loops = this._loops || {};
    if (!this._loops[mode]) this._loops[mode] = this._renderLoop(mode).catch(() => null);
    return this._loops[mode];
  }
  async _renderLoop(mode) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return null;
    const sr = this.ctx.sampleRate, calm = mode !== 'inspection';
    const len = calm ? 32 : 16, tail = 5;
    const oc = new OAC(2, Math.ceil(sr * (len + tail)), sr);
    // soft room: a filtered feedback delay on each side gives width and a little space
    const dry = oc.createGain(); dry.connect(oc.destination);
    const merger = oc.createChannelMerger(2); merger.connect(oc.destination);
    [0.29, 0.37].forEach((dt, ch) => {
      const d = oc.createDelay(1); d.delayTime.value = dt;
      const fb = oc.createGain(); fb.gain.value = 0.32;
      const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      const wet = oc.createGain(); wet.gain.value = 0.28;
      dry.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); wet.connect(merger, 0, ch);
    });
    const warm = oc.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = calm ? 1500 : 1800; warm.connect(dry);
    const note = (f, at, dur, { type = 'sine', vol = 0.05, attack = 0.02, release = 0.6, detune = 0, to = warm } = {}) => {
      const o = oc.createOscillator(), g = oc.createGain();
      o.type = type; o.frequency.value = f; o.detune.value = detune;
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + attack);
      g.gain.setValueAtTime(vol, at + Math.max(attack, dur)); g.gain.linearRampToValueAtTime(0, at + Math.max(attack, dur) + release);
      o.connect(g); g.connect(to); o.start(at); o.stop(at + Math.max(attack, dur) + release + 0.05);
    };
    let seed = calm ? 7 : 11; // fixed melody: the loop sounds the same every time
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
    if (calm) {
      // C maj7 → A m7 → F maj7 → G6, 4 s each, played twice with a different melody
      const chords = [[48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 52]];
      const scale = [72, 74, 76, 79, 81, 84];
      for (let i = 0; i < 8; i++) {
        const ch = chords[i % 4], at = i * 4;
        ch.forEach((m) => { note(midi(m), at, 3.6, { type: 'triangle', vol: 0.022, attack: 1.4, release: 1.6, detune: -5 }); note(midi(m), at, 3.6, { type: 'triangle', vol: 0.022, attack: 1.4, release: 1.6, detune: 5 }); });
        note(midi(ch[0] - 12), at, 3.4, { vol: 0.07, attack: 0.3, release: 1.2 });
        for (let b = 0; b < 8; b++) if (rnd() < (i < 4 ? 0.45 : 0.6)) {
          const m = scale[Math.floor(rnd() * scale.length)];
          note(midi(m), at + b * 0.5, 0.05, { vol: 0.028, attack: 0.008, release: 1.3 });
          note(midi(m + 12), at + b * 0.5, 0.05, { vol: 0.006, attack: 0.008, release: 0.6 }); // bell shimmer
        }
      }
    } else {
      // tense pulse, 120 bpm: A m → G# dim → G m → G# dim
      const chords = [[45, 48, 52], [44, 47, 50], [43, 46, 50], [44, 47, 50]];
      for (let i = 0; i < 4; i++) {
        const ch = chords[i], at = i * 4;
        ch.forEach((m) => note(midi(m), at, 3.7, { type: 'sawtooth', vol: 0.011, attack: 0.8, release: 0.8 }));
        for (let b = 0; b < 8; b++) {
          note(midi(ch[0] - 24), at + b * 0.5, 0.12, { vol: b % 2 ? 0.05 : 0.09, attack: 0.005, release: 0.15 });
          if (b % 4 === 2) note(midi(ch[b % 3] + 12), at + b * 0.5, 0.15, { type: 'triangle', vol: 0.02, attack: 0.01, release: 0.4 });
        }
      }
    }
    const rendered = await oc.startRendering();
    // fold the release tail back onto the start so the loop point is seamless
    const n = Math.floor(sr * len), out = this.ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = rendered.getChannelData(ch), o = out.getChannelData(ch);
      o.set(d.subarray(0, n));
      for (let i = n; i < d.length; i++) o[(i - n) % n] += d[i];
    }
    return out;
  }

  // ── Voice: native text-to-speech in the apps (Android WebView has no speechSynthesis),
  // Web Speech in browsers. Tamil uses a ta-IN voice, English an en-IN voice. ──
  async _nativeTTS() {
    if (this._tts !== undefined) return this._tts;
    this._tts = null;
    try {
      if (window.RxTTS) this._tts = 'lite'; // standalone Android shell (android-lite)
      else if (Capacitor.isNativePlatform()) {
        const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
        this._tts = TextToSpeech;
        try { this._taOK = (await TextToSpeech.isLanguageSupported({ lang: 'ta-IN' })).supported; } catch { this._taOK = false; }
      }
    } catch { this._tts = null; }
    if (this._tts === 'lite') { try { this._taOK = !!window.RxTTS.hasLang('ta-IN'); } catch { this._taOK = false; } }
    return this._tts;
  }
  /**
   * Speak a line with real human audio. opts: clipId (for pre-recorded neural studio voice),
   * gender 'F'|'M', age, voice (seed: same seed → same voice), queue, onStart / onEnd.
   */
  speak(text, opts = {}) {
    if (!this.settings.voiceDialogue || text == null) { opts.onEnd?.(); return; }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});

    // If queue is requested and already speaking, enqueue to speak sequentially!
    if (opts.queue && (this._isSpeaking || this._currentVoiceAudio)) {
      this._speechQueue.push({ text, opts });
      return;
    }

    if (!opts.queue) {
      this.stopSpeech();
    }

    this._executeSpeak(text, opts);
  }

  _executeSpeak(text, opts = {}) {
    this._isSpeaking = true;

    const wrappedOnEnd = () => {
      this._isSpeaking = false;
      opts.onEnd?.();
      // Natural 200ms conversational turn gap before next person speaks:
      setTimeout(() => {
        if (!this._isSpeaking && this._speechQueue.length > 0) {
          const next = this._speechQueue.shift();
          this._executeSpeak(next.text, next.opts);
        }
      }, 200);
    };

    // Try playing pre-recorded studio neural audio file first!
    if (opts.clipId) {
      const activeLang = this.lang || getLang() || 'en';
      const langFolder = (activeLang === 'ta' || activeLang === 'bi') ? 'ta' : 'en';
      const url = `./audio/voices/${langFolder}/${opts.clipId}.mp3`;

      const audio = new Audio(url);
      audio.volume = Math.min(1, (this.settings.voice ?? 1) * (this.settings.master ?? 1));

      let started = false;
      const cleanup = () => {
        if (this._currentVoiceAudio === audio) this._currentVoiceAudio = null;
      };

      audio.onplay = () => {
        started = true;
        opts.onStart?.();
      };
      audio.onended = () => {
        cleanup();
        wrappedOnEnd();
      };
      audio.onerror = () => {
        cleanup();
        if (!started) {
          this._fallbackTTS(text, { ...opts, onEnd: wrappedOnEnd });
        }
      };

      this._currentVoiceAudio = audio;
      audio.play().catch(() => {
        cleanup();
        if (!started) this._fallbackTTS(text, { ...opts, onEnd: wrappedOnEnd });
      });
      return;
    }

    this._fallbackTTS(text, { ...opts, onEnd: wrappedOnEnd });
  }

  _fallbackTTS(text, opts = {}) {
    this._nativeTTS().then((tts) => (tts ? this._speakNative(tts, text, opts) : this._speakWeb(text, opts)));
  }

  // Per-voice character: subtle pitch/rate variations to preserve natural human voice quality without robotic distortion.
  _prosody({ gender = 'F', age = 35, voice = 0 } = {}, native = false) {
    const j = ((voice * 2654435761) >>> 0) / 4294967296 - 0.5; // −0.5…0.5, stable per seed
    let pitch = age < 14 ? 1.14 : gender === 'F' ? 1.02 : 0.98;
    if (age > 60) pitch -= 0.03;
    pitch += j * 0.04;
    let rate = age > 65 ? 0.94 : age < 14 ? 1.04 : 0.99;
    rate += j * 0.04;
    if (native) rate *= 0.98;
    return { pitch: Math.max(0.92, Math.min(1.18, pitch)), rate: Math.max(0.88, Math.min(1.12, rate)) };
  }

  _clean(t) { return String(t).replace(/[“”"*★]/g, '').replace(/\s+/g, ' ').trim(); }

  _resolveVoiceText(text, opts = {}) {
    const activeLang = this.lang || getLang() || 'en';
    const rawTa = String(text); // in bi mode String(text) returns Tamil
    const rawEn = opts.en || (typeof text === 'object' && text?.en ? String(text.en) : null) || (text && text.en ? String(text.en) : null);
    const wantsTamil = (activeLang === 'ta' || activeLang === 'bi');

    if (!wantsTamil) {
      let say = rawEn || rawTa;
      return { say: this._clean(say), lang: 'en-IN', isTamil: false };
    }

    // Refresh voices list if empty
    if (!this._voices?.length && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { this._voices = speechSynthesis.getVoices(); } catch { /* ignore */ }
    }

    const hasTaVoice = (this._voices || []).some((vv) => /^ta/i.test(vv.lang));

    if (hasTaVoice) {
      return { say: this._clean(rawTa), lang: 'ta-IN', isTamil: true };
    }

    // If NO native Tamil voice is installed on OS (common on Windows without Tamil SAPI pack):
    // If an English translation exists, speak it in a natural Indian English voice.
    if (rawEn && rawEn !== rawTa) {
      return { say: this._clean(rawEn), lang: 'en-IN', isTamil: false };
    }

    // If only Tamil text exists and no Tamil voice exists on OS, DO NOT butcher Tamil with an American English voice!
    return { say: '', lang: 'ta-IN', isTamil: true, skipped: true };
  }

  _speakNative(tts, text, opts = {}) {
    const { say, lang, isTamil } = this._resolveVoiceText(text, opts);
    const { rate, pitch } = this._prosody(opts, true);
    const volume = Math.min(1, this.settings.voice * this.settings.master);
    const est = Math.max(900, say.length * (isTamil ? 75 : 62) / rate);
    const wait = opts.queue ? Math.max(0, (this._busyUntil || 0) - performance.now()) : 0;
    this._busyUntil = performance.now() + wait + est;
    if (this._nativeTimeout) clearTimeout(this._nativeTimeout);
    this._nativeTimeout = setTimeout(() => {
      opts.onStart?.();
      this._nativeTimeout = setTimeout(() => opts.onEnd?.(), est);
    }, wait);
    if (tts === 'lite') {
      try { if (window.RxTTS.speakQ) window.RxTTS.speakQ(say, lang, rate, pitch, volume, !!opts.queue); else setTimeout(() => window.RxTTS.speak(say, lang, rate, pitch, volume), wait); } catch { /* ignore */ }
      return;
    }
    const go = () => tts.speak({ text: say, lang, rate, pitch, volume, category: 'playback', queueStrategy: opts.queue ? 1 : 0 }).catch(() => {});
    if (opts.queue) go(); else tts.stop().catch(() => {}).finally(go);
  }

  stopSpeech() {
    this._speechQueue = [];
    this._isSpeaking = false;
    if (this._currentVoiceAudio) {
      try {
        this._currentVoiceAudio.onended = null;
        this._currentVoiceAudio.onerror = null;
        this._currentVoiceAudio.onplay = null;
        this._currentVoiceAudio.pause();
        this._currentVoiceAudio.currentTime = 0;
      } catch { /* ignore */ }
      this._currentVoiceAudio = null;
    }
    this._speakingUtterances?.clear();
    this._busyUntil = 0;
    if (this._resumeInterval) {
      clearInterval(this._resumeInterval);
      this._resumeInterval = null;
    }
    if (this._nativeTimeout) {
      clearTimeout(this._nativeTimeout);
      this._nativeTimeout = null;
    }
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        speechSynthesis.cancel();
      }
    } catch { /* ignore */ }
    this._nativeTTS().then((tts) => {
      try {
        if (tts && tts !== 'lite' && tts.stop) tts.stop().catch(() => {});
        else if (window.RxTTS?.stop) window.RxTTS.stop();
      } catch { /* ignore */ }
    });
  }

  // Best natural voice for a language + gender. Strict gender separation:
  // Male characters always get male voices; female characters always get female voices.
  _pickVoice(tamil, gender = 'F', seed = 0, wide = false) {
    if (!this._voices?.length && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { this._voices = speechSynthesis.getVoices(); } catch { /* ignore */ }
    }
    const voices = this._voices || [];

    const getGender = (vv) => {
      const n = (vv.name || '').toLowerCase();
      if (/\b(female|woman|girl)\b/i.test(n)) return 'F';
      if (/\b(male|man|boy)\b/i.test(n)) return 'M';
      // Known female voice names (including Google US English which is female)
      if (/neerja|pallavi|heera|veena|kalpana|swara|aditi|raveena|zira|samantha|victoria|karen|moira|tessa|susan|serena|fiona|aria|jenny|sonia|libby|natasha|clara|emma|ava|ananya|shruti|lekha|hazel|stephanie|google us english|tamil female|english female/i.test(n)) {
        return 'F';
      }
      // Known male voice names
      if (/prabhat|valluvar|ravi|hemant|madhur|rishi|david|mark|daniel|alex|fred|thomas|oliver|arthur|guy|ryan|william|liam|george|kumar|arjun|cosmo|tamil male|english male/i.test(n)) {
        return 'M';
      }
      return null;
    };

    let langVoices = voices.filter((vv) => (tamil ? /^ta/i : /^en/i).test(vv.lang));
    if (!langVoices.length) {
      langVoices = voices.filter((vv) => /^en/i.test(vv.lang));
      if (!langVoices.length) langVoices = voices;
    }

    const targetGender = gender === 'M' ? 'M' : 'F';
    // STRICT: Only include voices that match the target gender
    const strictGender = langVoices.filter((vv) => getGender(vv) === targetGender);
    const pool = strictGender.length > 0 ? strictGender : langVoices.filter((vv) => getGender(vv) !== (targetGender === 'M' ? 'F' : 'M'));
    const finalPool = pool.length > 0 ? pool : langVoices;

    const score = (vv) => {
      let s = 0;
      const n = (vv.name || '').toLowerCase();
      if (/natural|neural|online|premium|enhanced|wavenet/i.test(n)) s += 10;
      if (/google/i.test(n)) s += 5;
      if (/-in$/i.test((vv.lang || '').replace('_', '-'))) s += 4;
      const g = getGender(vv);
      if (g === targetGender) s += 8;
      else if (g && g !== targetGender) s -= 30; // Never prefer opposite gender
      return s;
    };

    const ranked = [...finalPool].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
    return ranked[seed % ranked.length] || null;
  }

  _speakWeb(text, opts = {}) {
    try {
      if (!('speechSynthesis' in window)) {
        opts.onStart?.();
        setTimeout(() => opts.onEnd?.(), 1200);
        return;
      }
      this._speakingUtterances = this._speakingUtterances || new Set();

      // Ensure voices list is loaded
      if (!this._voices?.length) {
        try { this._voices = speechSynthesis.getVoices(); } catch { /* ignore */ }
      }

      const { say, lang, isTamil, skipped } = this._resolveVoiceText(text, opts);
      if (skipped || !say) {
        opts.onStart?.();
        setTimeout(() => opts.onEnd?.(), 1500);
        return;
      }
      const { gender = 'F', voice: seed = 0 } = opts;
      const voice = this._pickVoice(isTamil, gender, seed, opts.role !== 'staff');
      const { rate, pitch } = this._prosody(opts);
      const volume = Math.min(1, this.settings.voice * this.settings.master);

      // Split into clean sentence chunks
      const parts = say.split(/(?<=[.!?।])\s+/).filter(Boolean);
      if (!parts.length) { opts.onEnd?.(); return; }

      let started = false;
      const onDone = () => {
        if (!started) opts.onStart?.();
        opts.onEnd?.();
      };

      parts.forEach((p, i) => {
        const u = new SpeechSynthesisUtterance(p);
        if (voice) u.voice = voice;
        u.lang = voice?.lang || lang;
        u.rate = rate;
        u.pitch = pitch;
        u.volume = volume;

        this._speakingUtterances.add(u);

        if (i === 0) {
          u.onstart = () => {
            started = true;
            opts.onStart?.();
          };
        }
        if (i === parts.length - 1) {
          u.onend = () => {
            this._speakingUtterances.delete(u);
            onDone();
          };
          u.onerror = () => {
            this._speakingUtterances.delete(u);
            onDone();
          };
        } else {
          u.onend = () => this._speakingUtterances.delete(u);
          u.onerror = () => this._speakingUtterances.delete(u);
        }

        try {
          speechSynthesis.speak(u);
        } catch {
          onDone();
        }
      });

      // Keep Chrome TTS from stalling on long audio
      if (speechSynthesis.paused) {
        try { speechSynthesis.resume(); } catch { /* ignore */ }
      }
      if (!this._resumeInterval) {
        this._resumeInterval = setInterval(() => {
          if (window.speechSynthesis && speechSynthesis.speaking && !speechSynthesis.paused) {
            try { speechSynthesis.pause(); speechSynthesis.resume(); } catch { /* ignore */ }
          }
        }, 3500);
      }
    } catch {
      opts.onEnd?.();
    }
  }
}

// Haptics: Capacitor Haptics on device (falls back to navigator.vibrate on web)
export function haptic(settings, kind = 'light') {
  if (!settings.haptics) return;
  try {
    if (kind === 'success') Haptics.notification({ type: NotificationType.Success });
    else if (kind === 'error') Haptics.notification({ type: NotificationType.Error });
    else if (kind === 'warning') Haptics.notification({ type: NotificationType.Warning });
    else Haptics.impact({ style: kind === 'heavy' ? ImpactStyle.Heavy : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light });
  } catch { try { navigator.vibrate?.(kind === 'heavy' ? 30 : 12); } catch { /* ignore */ } }
}

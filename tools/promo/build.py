"""Build the home-page trailer from the captured frames.

    python tools/promo/vo.py              # narration (once, or after changing a line)
    python tools/promo/build.py prep      # lip-sync data for the two patients who speak (before capture)
    node tools/promo/music.mjs            # the game's music loops as WAV   (dev server running on :5199)
    node tools/promo/capture.mjs          # frames                          (dev server running on :5199)
    python tools/promo/build.py           # frames + narration + patients' voices + the game's music
                                          #   → public/video/rxshift-trailer-1440p.mp4, -1080p.mp4, -poster.jpg

Needs numpy and ffmpeg (imageio-ffmpeg's binary, or ffmpeg on PATH).
"""
import json
import os
import shutil
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
WORK = os.path.join(HERE, 'work')
OUT = os.path.join(ROOT, 'public', 'video')
FPS = 30
SR = 48000
SPEAKERS = ['en/S01', 'ta/S04']  # the recorded patient lines heard in the trailer (director.js: speak, tamil)


def ffmpeg():
    exe = shutil.which('ffmpeg')
    if exe:
        return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


FF = ffmpeg()


def run(args, **kw):
    return subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-y', *args], check=True, **kw)


def pcm(path, sr=SR):
    r = subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)


def voice_file(key):
    """The patient's line: the 96 kbps master if it was recorded (tools/app_voices.py), else the website MP3."""
    lang, cid = key.split('/')
    m = os.path.join(ROOT, 'tools', 'voice-masters', lang, cid + '.mp3')
    return m if os.path.exists(m) else os.path.join(ROOT, 'public', 'audio', 'voices', lang, cid + '.mp3')


def speech_span(x, sr=SR):
    """(start, end) seconds of the speech in a clip (leading / trailing silence removed)."""
    hop = sr // 100
    e = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    on = np.nonzero(e > max(1e-4, e.max() * 0.03))[0]
    return (max(0, on[0] - 3) / 100, min(len(e), on[-1] + 12) / 100) if len(on) else (0.0, len(x) / sr)


def prep():
    """work/lip.json: per video frame, the mouth opening the game would get from each line's loudness
    (audio.js lipLevel: (RMS - 0.015) * 7 after levelling the voice to RMS 0.13), plus the lines' text."""
    items = {f"{it['lang']}/{it['id']}": it for it in json.load(open(os.path.join(ROOT, 'tools', 'voice_items.json'), encoding='utf-8'))}
    env, text = {}, {}
    for key in SPEAKERS:
        x = pcm(voice_file(key))
        a, b = speech_span(x)
        x = x[int(a * SR):int(b * SR)]
        voiced = x[np.abs(x) > 0.02]
        gain = 0.13 / np.sqrt(np.mean(voiced ** 2)) if len(voiced) else 1.0
        n = SR // FPS
        env[key] = [round(float(np.clip((np.sqrt(np.mean((x[i:i + n] * gain) ** 2)) - 0.015) * 7, 0, 1)), 3) for i in range(0, len(x), n)]
        text[key] = items[key]['text']
        print(f'{key}: {b - a:.2f} s of speech, {len(env[key])} frames')
    os.makedirs(WORK, exist_ok=True)
    json.dump({'env': env, 'text': text}, open(os.path.join(WORK, 'lip.json'), 'w', encoding='utf-8'), ensure_ascii=False)


# when each narration line starts inside its shot (seconds); patients' lines start with their lip-sync (frame 8)
VO_AT = {'title': 0.55, 'shop': 0.25, 'walkin': 0.3, 'ask': 0.25, 'pick': 0.25, 'refer': 0.25, 'lang': 0.25, 'inspect': 0.3, 'end': 0.6}
PATIENT = {'speak': 'en/S01', 'tamil': 'ta/S04'}
LIP_START = 8 / FPS


def wav(path):
    import wave
    w = wave.open(path, 'rb')
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    return x.reshape(-1, w.getnchannels())


def level(x, target):
    """Scale speech so its voiced RMS is `target`."""
    v = x[np.abs(x) > 0.02]
    return x * (target / np.sqrt(np.mean(v ** 2))) if len(v) else x


def soundtrack(tl):
    """Narration + the two patients + the game's music (ducked under speech) → work/soundtrack.wav"""
    total = tl['frames'] / FPS
    n = int(total * SR)
    mix = np.zeros((n, 2))
    speech = np.zeros(n)                    # where someone is talking (for ducking the music)
    start = {s['name']: s['start'] / FPS for s in tl['shots']}

    def lay(x, at, gain=1.0):
        i = int(at * SR); x = x[: max(0, n - i)]
        mix[i:i + len(x)] += (x * gain)[:, None]
        speech[i:i + len(x)] = 1
        return at + len(x) / SR

    for name, at in VO_AT.items():
        x = pcm(os.path.join(WORK, 'vo', name + '.mp3'))
        a, b = speech_span(x)
        end = lay(level(x[int(a * SR):int(b * SR)], 0.115), start[name] + at)
        print(f'  narration {name:8s} {start[name] + at:6.2f} – {end:6.2f} s')
    for name, key in PATIENT.items():
        x = pcm(voice_file(key))
        a, b = speech_span(x)
        end = lay(level(x[int(a * SR):int(b * SR)], 0.105), start[name] + LIP_START)
        print(f'  patient   {name:8s} {start[name] + LIP_START:6.2f} – {end:6.2f} s')

    # music: the calm loop throughout; the inspection pulse while the inspector walks in
    calm, insp = wav(os.path.join(WORK, 'music-calm.wav')), wav(os.path.join(WORK, 'music-inspection.wav'))
    music = np.tile(calm, (int(np.ceil(n / len(calm))), 1))[:n]
    t = np.arange(n) / SR
    i0, i1 = start['inspect'] + 1.5, start['inspect'] + 3.75       # the cinematic part of the shot
    x = np.clip((t - i0) / 0.35, 0, 1) * np.clip((i1 - t) / 0.5, 0, 1)
    tense = np.zeros((n, 2)); k = int(i0 * SR); seg = insp[: max(0, min(len(insp), n - k))]; tense[k:k + len(seg)] = seg
    music = music * (1 - 0.85 * x)[:, None] + tense * (x * 1.15)[:, None]
    # duck under speech (smoothed), fade in at the start and out at the end
    win = int(0.25 * SR); c = np.cumsum(np.concatenate([np.zeros(win // 2 + 1), speech, np.zeros(win // 2)])); duck = (c[win:win + n] - c[:n]) / win   # 0.25 s moving average
    env = (1 - 0.55 * duck) * np.clip(t / 0.8, 0, 1) * np.clip((total - t) / 2.6, 0, 1)
    rms = np.sqrt(np.mean(calm ** 2))
    mix += music * env[:, None] * (0.05 / rms)        # about 14 dB under the voices, 8 dB under in the gaps
    mix *= np.clip((total - t) / 0.25, 0, 1)[:, None]
    import re
    import wave
    out = os.path.join(WORK, 'soundtrack.wav')

    def save(x):
        w = wave.open(out, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()

    # one static gain to -16 LUFS (web video loudness), keeping peaks under -1 dBFS; no compressor
    mix *= min(1.0, 0.5 / np.abs(mix).max())
    save(mix)
    r = subprocess.run([FF, '-hide_banner', '-nostats', '-i', out, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True)
    lufs = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r.stderr)[-1])
    gain = min(10 ** ((-16 - lufs) / 20), 0.89 / np.abs(mix).max())
    mix *= gain
    save(mix)
    print(f'  soundtrack {total:.2f} s, {lufs + 20 * np.log10(gain):.1f} LUFS, peak {np.abs(mix).max():.2f}')
    return out


def video():
    tl = json.load(open(os.path.join(WORK, 'timeline.json'), encoding='utf-8'))
    frames = os.path.join(WORK, 'frames')
    missing = [i for i in range(tl['frames']) if not os.path.exists(os.path.join(frames, f'f{i:05d}.jpg'))]
    if missing:
        sys.exit(f'{len(missing)} frames missing (first: {missing[0]}): run tools/promo/capture.mjs')
    audio = soundtrack(tl)
    os.makedirs(OUT, exist_ok=True)
    src = ['-framerate', str(FPS), '-i', os.path.join(frames, 'f%05d.jpg'), '-i', audio]
    # the frames are full-range JPEGs: convert once to video-range BT.709 so every player shows the game's colours
    col = 'in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv'
    tags = ['-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv']
    enc = ['-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-g', '60', '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709',
           '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', '-shortest']
    # crf 21 keeps the 2K file under 50 MB (GitHub warns above that) and is still visually clean
    for name, scale, crf, lvl in [('1440p', '2560:1440', '21', '5.0'), ('1080p', '1920:1080', '21', '4.2')]:
        out = os.path.join(OUT, f'rxshift-trailer-{name}.mp4')
        run([*src, '-vf', f'scale={scale}:flags=lanczos:{col}', *tags, *enc, '-crf', crf, '-level', lvl, out])
        print(f'  {os.path.basename(out)}  {os.path.getsize(out) / 1e6:.1f} MB')
    poster(tl)


def poster(tl):
    # the title with the logo up, before its tagline (the page lays its play button over the lower left)
    frames = os.path.join(WORK, 'frames')
    title = next(s for s in tl['shots'] if s['name'] == 'title')
    out = os.path.join(OUT, 'rxshift-trailer-poster.jpg')
    run(['-i', os.path.join(frames, f"f{title['start'] + 56:05d}.jpg"), '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '4', out])
    print(f'  {os.path.basename(out)}  {os.path.getsize(out) / 1e3:.0f} KB')


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'prep':
        prep()
    elif len(sys.argv) > 1 and sys.argv[1] == 'poster':
        poster(json.load(open(os.path.join(WORK, 'timeline.json'), encoding='utf-8')))
    elif len(sys.argv) > 1 and sys.argv[1] == 'audio':
        soundtrack(json.load(open(os.path.join(WORK, 'timeline.json'), encoding='utf-8')))
    else:
        video()

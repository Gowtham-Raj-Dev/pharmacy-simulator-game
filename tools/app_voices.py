"""Make the installed apps' voice files: Opus (.ogg) versions of the dialogue lines, about a third
of the size of the website's MP3s at the same quality.

    python tools/app_voices.py            # record masters if needed, then encode
    python tools/app_voices.py --fetch    # only record the masters

The website keeps public/audio/voices/<en|ta>/<id>.mp3 (48 kbps, made by generate_voices.py).
For the apps every line is recorded again from the same neural voice as a 96 kbps MP3 master
(tools/voice-masters/, not committed) and encoded once from that master to Opus, so the app's
voices aren't a re-encode of the 48 kbps files. Lines with the same voice and text share one
recording: src/data/voice-alias.json maps each repeat to the line that holds the recording.
Output: app-voices/<en|ta>/<id>.ogg, copied into dist-app/audio/voices by `npm run build:app`.

Needs edge-tts (pip install edge-tts) and ffmpeg (imageio-ffmpeg's binary, or ffmpeg on PATH).
"""
import asyncio
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
import types

import edge_tts
import edge_tts.communicate as _comm

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITEMS = os.path.join(ROOT, 'tools', 'voice_items.json')
MASTERS = os.path.join(ROOT, 'tools', 'voice-masters')
OUT = os.path.join(ROOT, 'app-voices')
ALIAS = os.path.join(ROOT, 'src', 'data', 'voice-alias.json')
KBPS = 32  # Opus VBR target; speech from a clean master is transparent here (see README)

# edge-tts always asks for 48 kbps MP3; the same endpoint also serves 96 kbps MP3, which is the
# best master it offers (it has no PCM). Build a copy of the module that asks for that.
MASTER_FORMAT = 'audio-24khz-96kbitrate-mono-mp3'
_src = open(_comm.__file__, encoding='utf-8').read()
_old = '"outputFormat":"audio-24khz-48kbitrate-mono-mp3"'
if _old not in _src:
    sys.exit('edge-tts changed: cannot set the master output format (look for outputFormat in communicate.py)')
_hq = types.ModuleType('edge_tts.communicate_hq')
_hq.__package__ = 'edge_tts'
exec(compile(_src.replace(_old, f'"outputFormat":"{MASTER_FORMAT}"'), _comm.__file__, 'exec'), _hq.__dict__)

with open(ITEMS, 'r', encoding='utf-8') as f:
    items = json.load(f)


def digest(it):
    return hashlib.sha1('|'.join([MASTER_FORMAT, it['voice'], it['pitch'], it['rate'], it['text']]).encode('utf-8')).hexdigest()


# one recording per (language, voice, pitch, rate, text); the first line listed holds it
canon, alias = {}, {}
for it in items:
    k = (it['lang'], digest(it))
    if k in canon:
        alias.setdefault(it['lang'], {})[it['id']] = canon[k]['id']
    else:
        canon[k] = it
unique = list(canon.values())


def master_path(it):
    return os.path.join(MASTERS, it['lang'], it['id'] + '.mp3')


def out_path(it):
    return os.path.join(OUT, it['lang'], it['id'] + '.ogg')


CACHE = os.path.join(MASTERS, 'cache.json')
cache = {}
if os.path.exists(CACHE):
    with open(CACHE, 'r', encoding='utf-8') as f:
        cache = json.load(f)


def save_cache():
    os.makedirs(MASTERS, exist_ok=True)
    with open(CACHE, 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(cache.items())), f, indent=0, ensure_ascii=False)


sem = asyncio.Semaphore(8)
done = 0


async def record(it, total):
    global done
    path = master_path(it)
    async with sem:
        for attempt in range(5):
            try:
                tmp = path + '.part'
                await _hq.Communicate(it['text'], it['voice'], rate=it['rate'], pitch=it['pitch']).save(tmp)
                if os.path.getsize(tmp) < 1000:
                    raise RuntimeError('empty audio')
                os.replace(tmp, path)
                cache[f"{it['lang']}/{it['id']}"] = digest(it)
                done += 1
                if done % 100 == 0 or done == total:
                    print(f'  masters {done}/{total}', flush=True)
                    save_cache()
                return True
            except Exception as e:  # network hiccup / rate limit: back off and retry
                if attempt == 4:
                    print(f"FAILED {it['lang']}/{it['id']}: {e}")
                    return False
                await asyncio.sleep(1.5 * (attempt + 1))


def ffmpeg():
    exe = shutil.which('ffmpeg')
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit('ffmpeg not found: pip install imageio-ffmpeg (or put ffmpeg on PATH)')


def encode(exe, it):
    src, dst = master_path(it), out_path(it)
    tmp = dst + '.part.ogg'
    subprocess.run([exe, '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-map_metadata', '-1',
                    '-c:a', 'libopus', '-b:a', f'{KBPS}k', '-vbr', 'on', '-application', 'voip',
                    '-compression_level', '10', tmp], check=True)
    for attempt in range(20):  # Windows: a virus scanner may hold the new file for a moment
        try:
            os.replace(tmp, dst)
            return
        except PermissionError:
            if attempt == 19:
                raise
            time.sleep(0.25)


async def main():
    for lang in {it['lang'] for it in unique}:
        os.makedirs(os.path.join(MASTERS, lang), exist_ok=True)
        os.makedirs(os.path.join(OUT, lang), exist_ok=True)
    todo = [it for it in unique if cache.get(f"{it['lang']}/{it['id']}") != digest(it) or not os.path.exists(master_path(it))]
    print(f'{len(items)} lines, {len(unique)} recordings ({len(items) - len(unique)} repeats share one), {len(todo)} masters to record')
    results = await asyncio.gather(*(record(it, len(todo)) for it in todo))
    save_cache()
    if results.count(False):
        sys.exit(f'{results.count(False)} masters failed; run again')
    if '--fetch' in sys.argv:
        return

    # encode: a line is redone when its master or the bitrate changed
    stamp_path = os.path.join(OUT, '.encoded.json')
    stamps = json.load(open(stamp_path, encoding='utf-8')) if os.path.exists(stamp_path) else {}
    want = {f"{it['lang']}/{it['id']}": f"{cache[f'{it['lang']}/{it['id']}']}@{KBPS}" for it in unique}
    redo = [it for it in unique if stamps.get(f"{it['lang']}/{it['id']}") != want[f"{it['lang']}/{it['id']}"] or not os.path.exists(out_path(it))]
    exe = ffmpeg()
    loop = asyncio.get_running_loop()
    n = 0
    async def one(it):
        nonlocal n
        async with sem:
            await loop.run_in_executor(None, encode, exe, it)
            stamps[f"{it['lang']}/{it['id']}"] = want[f"{it['lang']}/{it['id']}"]
            n += 1
            if n % 200 == 0 or n == len(redo):
                print(f'  encoded {n}/{len(redo)}', flush=True)
    try:
        await asyncio.gather(*(one(it) for it in redo))
    finally:  # a run that stops half way keeps what it encoded
        with open(stamp_path, 'w', encoding='utf-8') as f:
            json.dump(dict(sorted(stamps.items())), f, indent=0)

    # remove app recordings no longer listed (or now shared through an alias)
    keep = set(want)
    removed = 0
    for lang in os.listdir(OUT):
        folder = os.path.join(OUT, lang)
        if os.path.isdir(folder):
            for name in os.listdir(folder):
                if name.endswith('.ogg') and f'{lang}/{name[:-4]}' not in keep:
                    os.remove(os.path.join(folder, name))
                    stamps.pop(f'{lang}/{name[:-4]}', None)
                    removed += 1
    with open(stamp_path, 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(stamps.items())), f, indent=0)
    with open(ALIAS, 'w', encoding='utf-8') as f:
        json.dump({lang: dict(sorted(m.items())) for lang, m in sorted(alias.items())}, f, indent=1, ensure_ascii=False)
        f.write('\n')
    size = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fns in os.walk(OUT) for fn in fns if fn.endswith('.ogg'))
    print(f'done: {len(redo)} encoded, {removed} removed, app voices {size / 1e6:.1f} MB at {KBPS} kbps')


if __name__ == '__main__':
    asyncio.run(main())

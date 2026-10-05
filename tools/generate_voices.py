"""Record the dialogue lines listed in tools/voice_items.json (made by tools/voice-lines.mjs)
with Microsoft neural voices (edge-tts) into public/audio/voices/<en|ta>/<id>.mp3.

    pip install edge-tts
    node tools/voice-lines.mjs && python tools/generate_voices.py --prune

Only new or changed lines are recorded (tools/voice_cache.json remembers what each file
was made from). --prune deletes recordings that are no longer listed.
"""
import asyncio
import hashlib
import json
import os
import sys

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITEMS = os.path.join(ROOT, 'tools', 'voice_items.json')
CACHE = os.path.join(ROOT, 'tools', 'voice_cache.json')
OUT = os.path.join(ROOT, 'public', 'audio', 'voices')

with open(ITEMS, 'r', encoding='utf-8') as f:
    items = json.load(f)
cache = {}
if os.path.exists(CACHE):
    with open(CACHE, 'r', encoding='utf-8') as f:
        cache = json.load(f)


def key(it):
    return f"{it['lang']}/{it['id']}"


def digest(it):
    return hashlib.sha1('|'.join([it['voice'], it['pitch'], it['rate'], it['text']]).encode('utf-8')).hexdigest()


def out_path(it):
    return os.path.join(OUT, it['lang'], it['id'] + '.mp3')


def save_cache():
    with open(CACHE, 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(cache.items())), f, indent=0, ensure_ascii=False)


sem = asyncio.Semaphore(8)
done = 0


async def record(it, total):
    global done
    path = out_path(it)
    async with sem:
        for attempt in range(5):
            try:
                tmp = path + '.part'
                await edge_tts.Communicate(it['text'], it['voice'], rate=it['rate'], pitch=it['pitch']).save(tmp)
                if os.path.getsize(tmp) < 1000:
                    raise RuntimeError('empty audio')
                os.replace(tmp, path)
                cache[key(it)] = digest(it)
                done += 1
                if done % 50 == 0 or done == total:
                    print(f'  {done}/{total}')
                    save_cache()
                return True
            except Exception as e:  # network hiccup / rate limit: back off and retry
                if attempt == 4:
                    print(f"FAILED {key(it)}: {e}")
                    return False
                await asyncio.sleep(1.5 * (attempt + 1))


async def main():
    for lang in {it['lang'] for it in items}:
        os.makedirs(os.path.join(OUT, lang), exist_ok=True)
    todo = [it for it in items if cache.get(key(it)) != digest(it) or not os.path.exists(out_path(it))]
    print(f'{len(items)} lines listed, {len(todo)} to record')
    results = await asyncio.gather(*(record(it, len(todo)) for it in todo))
    save_cache()
    failed = results.count(False)
    if '--prune' in sys.argv:
        keep = {key(it) for it in items}
        removed = 0
        for lang in os.listdir(OUT):
            folder = os.path.join(OUT, lang)
            if not os.path.isdir(folder):
                continue
            for name in os.listdir(folder):
                if name.endswith('.mp3') and f'{lang}/{name[:-4]}' not in keep:
                    os.remove(os.path.join(folder, name))
                    cache.pop(f'{lang}/{name[:-4]}', None)
                    removed += 1
        save_cache()
        print(f'pruned {removed} old recordings')
    print(f'done: {len(todo) - failed} recorded, {failed} failed')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    asyncio.run(main())

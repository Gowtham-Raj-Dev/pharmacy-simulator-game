import asyncio
import json
import os
import sys
import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITEMS_FILE = os.path.join(ROOT, 'tools', 'voice_items.json')
OUT_TA = os.path.join(ROOT, 'public', 'audio', 'voices', 'ta')
OUT_EN = os.path.join(ROOT, 'public', 'audio', 'voices', 'en')

os.makedirs(OUT_TA, exist_ok=True)
os.makedirs(OUT_EN, exist_ok=True)

with open(ITEMS_FILE, 'r', encoding='utf-8') as f:
    items = json.load(f)

# Sort priority: complaints (no underscore in id except outcomes/questions) first!
def priority(item):
    i_id = item['id']
    if i_id.startswith('S') and '_' not in i_id:
        return 0  # Highest priority: customer complaints!
    if i_id.startswith('thx_') or i_id.startswith('q_'):
        return 1  # High priority: outcomes & questions!
    return 2  # Answers

items.sort(key=priority)

print(f"Total items in manifest: {len(items)}")

VOICES = {
    'ta': {
        'F': 'ta-IN-PallaviNeural',
        'M': 'ta-IN-ValluvarNeural'
    },
    'en': {
        'F': 'en-IN-NeerjaNeural',
        'M': 'en-IN-PrabhatNeural'
    }
}

sem = asyncio.Semaphore(6)

async def generate_clip(text, voice, out_path):
    if os.path.exists(out_path) and os.path.getsize(out_path) > 1000:
        return True
    async with sem:
        for attempt in range(3):
            try:
                comm = edge_tts.Communicate(text, voice)
                await comm.save(out_path)
                return True
            except Exception as e:
                if attempt == 2:
                    print(f"Failed {out_path}: {e}")
                    return False
                await asyncio.sleep(1)

async def main():
    tasks = []
    # If run with --priority-only, only generate complaints, outcomes, questions (70 items)
    priority_only = '--priority-only' in sys.argv
    target_items = [it for it in items if priority(it) <= 1] if priority_only else items

    print(f"Processing {len(target_items)} items ({len(target_items)*2} files)...")

    for it in target_items:
        gender = it.get('gender', 'F')
        i_id = it['id']

        # Tamil
        if 'ta' in it and it['ta']:
            v_ta = VOICES['ta'][gender]
            p_ta = os.path.join(OUT_TA, f"{i_id}.mp3")
            tasks.append(generate_clip(it['ta'], v_ta, p_ta))

        # English
        if 'en' in it and it['en']:
            v_en = VOICES['en'][gender]
            p_en = os.path.join(OUT_EN, f"{i_id}.mp3")
            tasks.append(generate_clip(it['en'], v_en, p_en))

    results = await asyncio.gather(*tasks)
    success = sum(1 for r in results if r)
    print(f"Done! Successfully generated {success}/{len(tasks)} audio files.")

if __name__ == '__main__':
    asyncio.run(main())

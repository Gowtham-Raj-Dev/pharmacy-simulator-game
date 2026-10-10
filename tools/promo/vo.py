"""Record the promo video's narration (tools/promo/work/vo/<n>.mp3, 96 kbps masters) with the
neural voice used for the game's pharmacist family. Re-run after changing a line.

    python tools/promo/vo.py
"""
import asyncio
import json
import os
import sys
import types

import edge_tts.communicate as _comm

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'work', 'vo')
VOICE, RATE, PITCH = 'en-IN-NeerjaExpressiveNeural', '+4%', '+0Hz'

# key: line. The keys are the shot names in capture.mjs / build.py.
LINES = {
    'title': 'Welcome to RxShift. The 3D pharmacy training simulator.',
    'shop': 'Run a complete hospital pharmacy, with real medicine brands on every shelf.',
    'walkin': 'Patients walk in, and tell you what is wrong.',
    'ask': 'Ask the right questions. Check allergies, history, and other medicines.',
    'pick': 'Then choose the right medicine, and explain how to take it safely.',
    'refer': 'Spot the red flags, and know when to send a patient to the doctor.',
    'lang': 'Every patient speaks. In English, and in Tamil.',
    'inspect': 'Level up, shift by shift, and pass the twenty out of twenty inspection.',
    'end': 'RxShift. Play free in your browser, or get the Android app.',
}

_src = open(_comm.__file__, encoding='utf-8').read()
_old = '"outputFormat":"audio-24khz-48kbitrate-mono-mp3"'
if _old not in _src:
    sys.exit('edge-tts changed: cannot set the output format')
_hq = types.ModuleType('edge_tts.communicate_hq')
_hq.__package__ = 'edge_tts'
exec(compile(_src.replace(_old, '"outputFormat":"audio-24khz-96kbitrate-mono-mp3"'), _comm.__file__, 'exec'), _hq.__dict__)


async def main():
    os.makedirs(OUT, exist_ok=True)
    for key, text in LINES.items():
        path = os.path.join(OUT, key + '.mp3')
        await _hq.Communicate(text, VOICE, rate=RATE, pitch=PITCH).save(path)
        print(key, os.path.getsize(path) * 8 / 96000, 's')
    json.dump(LINES, open(os.path.join(OUT, 'lines.json'), 'w', encoding='utf-8'), indent=1)

asyncio.run(main())

# RxShift — 3D Pharmacy Training Simulator (Android & iOS)

RxShift is a 3D mobile training simulator. You play a pharmacist in a modern retail pharmacy. Customers walk in and describe their symptoms. You ask follow-up questions, search a large inventory, read the medicine information, and run a safety check. Then you dispense, refer or advise, explain your decision, and take payment. Eventually a surprise **20-question inspection** arrives, and passing it needs **20 / 20**.

> **Educational simulation.** It uses curated, predefined scenarios and real Indian-market medicine brands (see `src/data/brands.js`; prices and stock are simulated). It does not diagnose or prescribe, and no generative AI makes medical decisions. Medicine classification (OTC / pharmacist-only / Rx) varies by country and is simplified here.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173 (use --host to test on a phone on the same Wi-Fi)
npm run build        # dist/index.html: one self-contained offline file (~1 MB, ~270 KB gzip)
npm run site         # site/: home page (Play in browser / Download APK) + game at /rxshift-sim/ + download/
npm run site:preview # serve site/ locally
```

### Direct APK (no Android Studio)

`RxShift-Pharmacy-Sim.apk` is a ready-to-install, signed APK (Android 6.0+, OpenGL ES 3 / WebGL 2). It's a full-screen WebView shell (`android-lite/`) that serves the game and the avatar files offline from a secure in-app origin. Copy it to the phone, open it and allow *Install unknown apps* for your file manager / browser. Back button = close panel / open menu, double-tap back = exit.

Rebuild it on any Ubuntu/Debian machine without Gradle:

```bash
sudo apt-get install aapt apksigner zipalign android-sdk-platform-23 dalvik-exchange
tools/build-apk.sh        # vite build → aapt → javac → dx → zipalign → apksigner
```

The first run creates `android-lite/rxshift-release.jks` (password `rxshift-release`, override with `KS_PASS`). **Keep that file**: updates must be signed with the same key or Android refuses to install them over the old version. The Capacitor project below is still the route for Play Store builds (AAB, targetSdk 35).

### Android
Requirements: Android Studio (Ladybug or newer), JDK 17 or 21, and the Android SDK.
```bash
npm run build && npx cap sync android
npx cap open android            # then Run ▶ on a device or emulator
# or from the CLI:
cd android && ./gradlew assembleDebug     # app/build/outputs/apk/debug/app-debug.apk
cd android && ./gradlew bundleRelease     # Play Store .aab (configure signing first)
```
A GitHub Actions workflow (`.github/workflows/android.yml`) builds a debug APK on every push and uploads it as a downloadable artifact.

### iOS
Requirements: macOS, Xcode 15 or newer. The project uses Swift Package Manager, so CocoaPods is not needed.
```bash
npm run build && npx cap sync ios
npx cap open ios                # select your Team in Signing & Capabilities, then Run ▶
```

App ID: `com.zrubix.rxshift`. App name: `RxShift Pharmacy Sim`. Change both in `capacitor.config.json`, then run `npx cap sync`.
Icons and splash screens are generated from `assets/` with `npx capacitor-assets generate --android --ios`.

---

## Features

| Area | What's included |
|---|---|
| **3D pharmacy** | Dispensing counter (prescriptions, consultation, cash/POS), tablet & capsule wall, prescription cabinet, syrups, tonics, vitamins, first aid, skin care, baby care, medical devices, OTC remedies, medicine refrigerator with live temperature display, storage room with racking and quarantine bin, pharmacist workstation, waiting area, BP kiosk, automatic sliding doors, signage, health posters, and an unlockable expansion wing |
| **Characters** | **Real people from the Microsoft Rocketbox avatar library** (MIT licence, `public/people/*.glb`): scanned-quality textured humans with an 81-bone Biped rig and **motion-captured animation** — idle, walk, fast walk, run, talk, listen and sit. Walking is synced to real movement speed: the walk → fast-walk → run blend shares one phase with the clips lined up on the same footfall, people speed up and slow down over a step or two, turn before they walk off and always move the way they face (no sliding round corners), take small steps when turning on the spot, back into their chair before sitting, and stop walking when pushed against a shelf. Footsteps sound when a foot touches down. The game's procedural animator layers on top what mocap can't know: handing over medicines, paying, holding the inspector's clipboard, symptom gestures (cough, headache, stomach…), looking at whoever they talk to. **Cast:** the pharmacist (you) is one fixed character in a lab coat; the **inspector is a doctor** (stethoscope + clipboard); every other model — 26 of them — is a visitor/customer, picked least-recently-seen for variety. Children (and file:// builds that can't fetch the avatar files) use bodies generated from MakeHuman's CC0 base mesh (`tools/gen-humans.mjs`) |
| **Languages** | **English, தமிழ் (Tamil) and தமிழ் + English** (bilingual, with Tamil above English). Every screen, customer dialogue, medicine, quiz question, event, 3D sign, poster and screen switches. All dialogue is spoken in both languages (see **Voices**). The language is asked on first launch and can be changed from the title, menu or settings |
| **Guided mode (mentor)** | Step-by-step help: where to go (with *Take me there*), which ★ questions to ask, and, once they're answered, the decision (dispense / refer / emergency / advise). It also shows which medicine to search for, marks safe matches with ★, gives verdicts on the medicine card and the safety check, and offers tips for counselling and events. Toggle it in Settings |
| **Stock-in** | Out-of-stock and low items can be ordered from the medicine card, the out-of-stock list or by section at the POS. Deliveries show their status (Ordered → On the way → Arrived). Stock is received in the storage room with a check (quantity, batch/expiry, FEFO, cold chain) before it goes back on the shelves |
| **Animation** | Walk, run, idle, talking with lip movement and gestures, blinking, facial expressions, head look-at, symptom gestures (headache, cough, stomach, chest, sneezing, limp…), pick up / inspect, hand over a bag, payment, sitting, carrying, inspector's clipboard. All of it is blended on bones to avoid robotic transitions |
| **Customer AI** | 56 predefined teaching scenarios across 5 difficulty levels. They include allergy, interaction, pregnancy, child and elderly traps, red flags needing a doctor or emergency referral, prescriptions (valid, out of date, allergy conflicts), out-of-stock brand → generic alternative, and duplicate-ingredient cases. Several have **not dispensing** as the correct answer |
| **Stock suggestions** | When the patient describes the problem ("fever", "loose motions", "cold"…), the consultation shows the brands in stock for that symptom (age-appropriate, never a product the label rules out for that age, no Rx items unless the category is about them) plus when to refer. Tap a brand for its card, or *Why & when to refer* for the full list |
| **Consultation** | Six questions (duration, other symptoms, allergies, current medicines, medical history, lifestyle/driving). Asking reveals hidden profile facts that change what is safe |
| **Inventory** | **~870 real-brand items** (Dolo, Crocin, Calpol, Digene, Electral, Augmentin…) from the editable hospital stock list `src/data/brands.js`, across all requested categories. Each has an ingredient, category, form, educational use, warnings, contraindication flags, storage, OTC/P/Rx status, stock, price, placeholder manufacturer, batch/expiry and a description |
| **Smart search** | By name, ingredient, category, symptom, form or manufacturer, plus section/status/in-stock filters and a virtualised list. Symptom searches show an educational guide: "Potentially relevant OTC category", "Why it may be considered", and "When referral is appropriate" |
| **Medicine card** | MEDICINE INFORMATION → VIEW DETAILS / ADD TO CUSTOMER / BACK. You must read the description before dispensing. Products can be dragged into the dispensing tray from the cabinet or the shelves |
| **Safety check** | Allergies, current medicines, history, lifestyle, age, prescription status, batch/expiry, duplicates and red flags. Anything you didn't ask about is shown as **not verified** |
| **Scoring** | Safety carries more weight than revenue. Counselling ("explain why") is scored. Each outcome comes with an educational note |
| **Random events** | Fridge temperature alarm, expired stock, wrong-shelf cold-chain item, inventory shortage, out-of-stock brand, prescription problems, surprise inspector |
| **Inspection** | Cinematic entrance, lighting/POS "compliance mode", 20 balanced questions drawn from a 68-question bank, ✓ CORRECT / ✕ INCORRECT, fail → RESTART INSPECTION, pass → certificate appears on the wall |
| **Progression** | 10 levels (navigation → interactions → medicine info → conditions → safety → inventory → difficult → advanced → inspection prep → inspection), then career mode. Unlocks: expansion wing, uniforms, equipment, evening and hospital themes |
| **Save** | Automatic checkpoints (after each customer, event, inspection, level and every 60 s). Saves level, money, reputation, safety, stock, upgrades, modules, inspection progress and achievements. Uses Capacitor Preferences on device and localStorage on web |
| **Accessibility** | Text size S–XL, subtitles, colour-safe palette, haptics toggle, master/SFX/music/voice volume, left/right-handed layout, reduced motion, voice dialogue toggle |
| **Voices** | Every spoken line is a recorded Microsoft neural voice in English and Tamil (`public/audio/voices/`, ~1,450 clips). **Each customer has their own voice**: four different speakers per gender, pitched and paced for the patient's age, handed out so customers who follow each other never sound alike (`src/data/voices.js`). The pharmacist and the inspector keep one voice all game. Subtitles and voice always match. Lines play through Web Audio, levelled to one loudness and gently compressed, with the music and room tone ducked underneath, and the speaker's jaw follows the voice (lip-sync). Tap a question, the conversation or **Skip** (S) to skip a line. Clips are fetched only when needed and prefetched when a customer reaches the counter; text-to-speech is the fallback |
| **Audio** | Procedural Web Audio: ambience, door chime, door slide, footsteps, distant chatter, shelf/package sounds, POS beeps and cash drawer, notifications, calm and inspection music, correct/incorrect, completion, fridge alarm, siren, coughs/sneezes |

## Controls

| | Touch | Keyboard |
|---|---|---|
| Move | Left virtual joystick (push fully or tap **RUN** to sprint) | WASD / arrows · **R** toggles run · hold Shift (on a PC the joystick, RUN and camera bar are hidden; a key legend shows instead) |
| Look | Swipe anywhere outside buttons · **camera bar** rotate buttons | Mouse drag · Z / C |
| Zoom | Pinch · camera bar magnifiers | Wheel · − / = |
| Recenter / view | Camera bar target / eye (first-person) | T / V |
| Interact | Big round context button · tap people, shelves, POS, fridge, storage, workstation | E / Space / Enter |
| Guide · Cabinet · Study · Stats · Menu | Side buttons / top bar | G · I · B · O · Esc |
| Consultation | Question and action buttons | 1–6 ask · P profile · I cabinet · F refer · X advise/prescription · Enter safety check |
| Dialogs | Buttons | Every button shows its key badge on PC (Enter = main action, Esc = back, 1–4 / A–D = options) |
| Walk somewhere | Tap the floor | — |
| Dispense | Tap a product → ADD TO CUSTOMER, or drag the product icon into the tray | — |

The controls are mirrored for left-handed players (Settings → Control layout). A **How to play** guide opens on first launch and is always available in the menu.

## Graphics & performance

| Preset | What it does |
|---|---|
| Low | 0.8× resolution, blob shadows, short LOD distances |
| Medium | Up to 1.5× resolution, blob shadows |
| **High** (default on phones) | Up to 2× resolution, real-time shadows, extended LOD; **on PCs also planar floor reflections** |
| **Ultra** (default on 8-thread PCs) | Up to 2.5× resolution, 2048 px shadows (fixtures cast too), MSAA bloom glow, floor reflections, longest shelf and character detail |
| Auto | Dynamic resolution that keeps ~60 FPS |
| **Smooth mode** (default on, every preset) | Keeps it HD *and* lag-free: resolution adapts but never drops below ~1× on PCs / ~1.2× on high-DPI phones; if the GPU still struggles, effects step down one at a time (reflections → bloom → fixture shadows → all shadows) instead of the image going blurry |

Rendering: Khronos PBR Neutral tone mapping with a light colour grade, an environment probe captured from the pharmacy itself with **box-projected reflections** (floor, glass, metal), real-time **planar floor reflections** on PC, baked light falloff on walls and ceiling, 16× anisotropic filtering on PC.

Mobile-performance techniques used:

- **Draw calls ≈ 30–70.** Static geometry is merged per material, every character is **one skinned mesh** (one draw call) with shared materials, and blob shadows are a single instanced mesh.
- **GPU instancing.** All shelf products are `InstancedMesh` objects that use a packaging atlas through a per-instance attribute.
- **Shelf LOD**, as specified: HIGH = textured instanced products, MEDIUM = flat instanced products, LOW = a single facade quad per unit. The selected shelf is forced to HIGH and highlighted. *Settings → Show shelf LOD tiers* colours each tier.
- **Characters.** Avatars share geometry and textures between clones, animate at half rate when far away and skip animation beyond 22 m. Phones use smaller body/normal textures (faces stay sharp) so 25+ people fit in GPU memory. Every visitor model loads behind the loading screen, and every texture is uploaded and every shader compiled before the lobby appears (hidden customers, the inspector and shelf detail levels included), so nothing pops in or hitches later. The loading screen lifts only once the pharmacy behind the menu has been drawn.
- **Lighting and culling.** Floor AO is baked, so there's no real-time AO. The storage room uses zone culling, a simple form of occlusion culling, and frustum culling is on everywhere.
- **Pooling and data.** Customer characters are pooled. Inventory is **data**: the 1,300 products are never spawned as physics objects, and there is no physics engine at all.
- **Footprint.** The game itself is one ~4.7 MB HTML file (procedural canvas textures, no downloads); the realistic people are 28 separate GLB files (~30 MB) in `people/`, and the voices ~1,450 MP3 clips (~60 MB, each fetched only when spoken) in `audio/voices/`. Serve the folder over http(s) (or run it in the app) — a page opened straight from disk falls back to the generated people.
- **Battery.** There's a 30/60 FPS cap (battery saver). Rendering slows to 1/6 rate while a full-screen panel covers the 3D view and pauses when the app is in the background. Loading is asynchronous with progress steps.

## Project structure

```
src/
  main.js              bootstrap, async loading, render loop, Ultra bloom
  game.js              orchestrator: controls, interaction, consultation, payment,
                       events, inspection, progression, save, quality presets
  core/                util (DOM/icons), state (save), audio (Web Audio, recorded voices + TTS fallback, haptics), input (touch/keyboard)
  world/               pharmacy (environment, LOD, batching), character (procedural skinned humans),
                       camera (3rd/1st person, collision, cinematics), nav (A* grid), textures (canvas)
  systems/             customers (AI/queue/pool), evaluation (safety rules & scoring)
  data/                products (1,300-item catalog generator), scenarios (56 cases + symptom guide),
                       questions (68 MCQs + 10 study modules), levels (levels, upgrades, achievements),
                       voices (voice cast: which neural voice speaks each line)
  ui/                  ui (HUD, menus, settings, training), panels (dialogue, search, info, safety, POS, stock-in, inspection), keys (PC shortcuts)
  i18n/                i18n core (t / bilingual), en.js UI dictionary, content.js (content swapping), ta/*.json Tamil translations
  systems/guide.js     mentor / guided mode
  world/rocketbox.js   Rocketbox avatars: loading, mocap clip blending synced to speed, procedural action/gesture layer
  world/realhumans.js  generated MakeHuman people (children / fallback; variant blending, retargeting)
  assets/humans/       people.glb (generated by tools/gen-humans.mjs)
tools/                 rocketbox-import.mjs (Rocketbox FBX → game GLB), gen-humans.mjs (MakeHuman → people.glb),
                       voice-lines.mjs + generate_voices.py (record the dialogue voices)
public/people/         28 Rocketbox avatar GLBs + LICENSE-Rocketbox.md (MIT)
android/ ios/          Capacitor native projects
test/                  Playwright smoke/flow tests and content validation (node test/eval.mjs)
```

## Website (home page + browser play + APK download)

`npm run site` builds the game and writes `site/`: `index.html` is the home page, which asks whether to **play in the browser** (opens `/rxshift-sim/`) or **download the APK** (`/download/RxShift-Pharmacy-Sim.apk`, the signed release if present, otherwise the debug build). The home page itself never loads the game. Upload the whole `site/` folder to any static host. The home page source is `site-src/index.html`.

The live GitHub Pages site (`.github/workflows/deploy.yml`, from the root `index.html`) does not carry the APK (`*.apk` is gitignored). Its **Download APK** button and the QR code beside it (shown on computers only, for scanning with a phone) both point at `https://github.com/Gowtham-Raj-Dev/pharmacy-simulator-game/releases/latest/download/RxShift-Pharmacy-Sim.apk`. To ship a new APK, publish a GitHub release with a file of exactly that name: `gh release create vX.Y.Z RxShift-Pharmacy-Sim.apk`. The QR never needs regenerating.

## Extending

- **Hospital stock (brands).** Edit `src/data/brands.js` to match the brands your pharmacy actually stocks. Each entry is `b(name, manufacturer, onlyVariants)` or `gen(name)` for the generic; keys match the ingredients in `products.js`. Have a pharmacist verify the list against the formulary.

- **Content.** Add scenarios to `src/data/scenarios.js`. Each one needs answers, hidden `facts`, `correct` / `alsoOk`, `keyQuestions` and a `learning` note. Then run `node test/eval.mjs`, which checks that every scenario has a safe, reachable correct answer and that the traps trigger.
- **More people.** `node tools/rocketbox-import.mjs Adults/Female_Adult_08:rbF08 Adults/Male_Adult_11:rbM11` downloads Rocketbox avatars from GitHub, converts them with FBX2glTF, resizes the textures (colour 1024², normal 512², hair PNG 512²) and writes `public/people/<name>.glb`; then add the id to `AVATARS` in `src/world/rocketbox.js` (`sex`, optional `age: 'older'`). Avatars without clips borrow the mocap clips of a same-gender donor at runtime.
- **Generated bodies.** `node tools/gen-humans.mjs` rebuilds `src/assets/humans/people.glb` from the MakeHuman CC0 data (base mesh, macro targets, default skeleton and weights). Edit `VARIANTS` / `RACE` to add body types. Any rigged glTF that uses the same bone names can be dropped in, because the retargeter maps the procedural pose onto `Hips, Spine, Spine2, Neck, Head, Jaw, Left/Right Arm, ForeArm, Hand, UpLeg, Leg, Foot`.
- **Voices.** Change a voice in `src/data/voices.js` (or any dialogue text), then re-record: `pip install edge-tts`, `node tools/voice-lines.mjs && python tools/generate_voices.py --prune`. The first script lists every line from the game's own text in both languages, so voice and subtitle always match; the second records only new or changed lines and deletes ones no longer used.
- **Translations.** UI strings live in `src/i18n/en.js` (English) and `src/i18n/ta/ui.json` (Tamil). Content translations live in `src/i18n/ta/*.json` with the same keys as the English extraction (`node test/extract.mjs`). `node test/validate-ta.mjs <en> <ta>` checks structure, placeholders and option order.
- **Photorealistic humans (licensed).** The procedural humans are realistic-proportioned and bone-rigged. To use licensed photoreal models (for example Mixamo, Reallusion or MetaHuman exports), load a rigged GLB with `GLTFLoader` and map its bones onto the names in `world/character.js` (`hips, spine, chest, neck, head, upperArmL…`). The layered procedural animator and the facial bones (`jaw, lidL/R, browL/R, mouthL/R`) can drive any rig that uses those joints. Compress textures to KTX2/Basis for mobile.
- **Medical review.** The educational content is conservative and was cross-checked, but it should be reviewed by a qualified pharmacist for your target country before training use.

# Tamil translation guide (RxShift pharmacy training game)

You translate English JSON content from a 3D pharmacy-training game into Tamil. Players are pharmacy students and staff in Tamil Nadu. When they choose Tamil, everything they see must be Tamil.

## Rules
1. **Output.** Write the same JSON structure to `src/i18n/parts/ta/<same file name>`.
   - Keep every key exactly as it is. Translate only the values. Some keys are English sentences (for example in `strengths`, `packs`, `notes`, `storage`, `forms`, `categories`, `rules`, `packLabels`); leave those keys untouched and translate only their values.
   - Keep every array the same length and in the same order. **Order matters.** In quiz `options` and `adviceOptions`, the FIRST item is the correct answer, so never reorder them.
   - The one exception is `keywords` arrays (symptom search words). Replace them with 2–6 Tamil words or phrases a person might type to search for that symptom (for example "தலைவலி", "தலை வலி").
2. **Placeholders.** Keep placeholders like `{temp}`, `{product}`, `{batch}`, `{expiry}`, `{name}` exactly as they are.
3. **Style.**
   - Use clear, simple, natural written Tamil (எழுத்துத் தமிழ்), the kind a Tamil Nadu pharmacy student understands easily. It should not be archaic or overly Sanskritised.
   - Customer dialogue (`complaint`, `answers`) should sound like a polite person talking at a pharmacy counter. Keep it conversational, using first person.
   - Keep the medical meaning exact. This is safety education, so do not add, drop or soften warnings.
4. **Unchanged items.**
   - Units stay as they are: mg, mL, g, mcg, IU, %, °C, CFU, SPF, kg.
   - Numbers stay in Western digits.
   - Abbreviations stay in Latin script: OTC, Rx, NSAID, ORS, BP, SPF, PPI, MAOI, SSRI, ACE, INR, POS, GP, ID.
   - Use ₹ for money.
5. **Medicine names.** Transliterate active-ingredient names into Tamil script, e.g. Paracetamol → பாராசிட்டமால், Ibuprofen → இப்யூபுரூஃபன், Cetirizine → செட்டிரிசின், Loratadine → லோராடடின், Chlorphenamine → குளோர்ஃபெனிரமின், Omeprazole → ஒமேப்ரசோல், Aspirin → ஆஸ்பிரின், Warfarin → வார்ஃபரின், Amoxicillin → அமோக்ஸிசிலின், Metformin → மெட்ஃபார்மின், Insulin → இன்சுலின், Salbutamol → சால்பியூட்டமால், Pseudoephedrine → சூடோஎஃபெட்ரின், Diclofenac → டைக்ளோஃபெனாக், Clotrimazole → குளோட்ரிமசோல், Hydrocortisone → ஹைட்ரோகார்டிசோன்.
   - **Only** in the product `generic` field, add the original English name in parentheses at the end, e.g. `"பாராசிட்டமால் / அசெட்டமினோஃபென் (Paracetamol)"`, so learners connect the Tamil and English names.
6. **Person names.** Transliterate into Tamil script, e.g. "Aarav Sharma" → "ஆரவ் ஷர்மா", "Dr. Mehta" → "டாக்டர் மேத்தா".
7. **JSON quotes.** Inside JSON string values, never use a raw ASCII double quote. Use “ ” or ‘ ’ instead. The output must be valid JSON.

## Glossary (use consistently)
| English | Tamil |
|---|---|
| pharmacist | மருந்தாளர் |
| pharmacy | மருந்தகம் |
| medicine | மருந்து |
| tablet | மாத்திரை |
| capsule | கேப்சூல் |
| syrup | சிரப் |
| suspension | திரவ மருந்து |
| drops | சொட்டு மருந்து |
| cream | கிரீம் |
| ointment | களிம்பு |
| gel | ஜெல் |
| spray | ஸ்ப்ரே |
| sachet | சாஷே |
| lozenge | லோசெஞ்ச் |
| inhaler | இன்ஹேலர் |
| prescription | மருந்துச்சீட்டு |
| doctor | மருத்துவர் |
| emergency | அவசர சிகிச்சை |
| refer | பரிந்துரை / மருத்துவரிடம் அனுப்பு |
| dispense | வழங்கு |
| counselling / advice | ஆலோசனை |
| allergy | ஒவ்வாமை |
| fever | காய்ச்சல் |
| headache | தலைவலி |
| cough | இருமல் |
| cold | சளி |
| sore throat | தொண்டை வலி |
| pain | வலி |
| diarrhoea | வயிற்றுப்போக்கு |
| constipation | மலச்சிக்கல் |
| vomiting | வாந்தி |
| acidity / heartburn | அமிலத்தன்மை / நெஞ்செரிச்சல் |
| rash | தடிப்பு |
| itching | அரிப்பு |
| dose | மருந்தளவு |
| side effect | பக்க விளைவு |
| drowsiness | தூக்கக் கலக்கம் |
| interaction | மருந்து இடைவினை |
| pregnancy | கர்ப்பம் |
| breastfeeding | தாய்ப்பால் ஊட்டுதல் |
| infant / baby | கைக்குழந்தை |
| child | குழந்தை |
| elderly | முதியவர் |
| blood pressure | இரத்த அழுத்தம் |
| diabetes | நீரிழிவு (சர்க்கரை நோய்) |
| asthma | ஆஸ்துமா |
| kidney | சிறுநீரகம் |
| liver | கல்லீரல் |
| stomach | வயிறு |
| heart | இதயம் |
| ulcer | புண் |
| bleeding | இரத்தப்போக்கு |
| antibiotic | ஆன்டிபயாடிக் (நுண்ணுயிர் எதிர்ப்பி) |
| antihistamine | ஆன்டிஹிஸ்டமின் |
| painkiller / analgesic | வலி நிவாரணி |
| vitamin | வைட்டமின் |
| supplement | ஊட்டச்சத்து மருந்து |
| first aid | முதலுதவி |
| storage | சேமிப்பு |
| expiry date | காலாவதி தேதி |
| expired | காலாவதியான |
| batch | தொகுதி (Batch) |
| refrigerator | குளிர்சாதனப் பெட்டி (ஃப்ரிட்ஜ்) |
| cold chain | குளிர் சங்கிலி |
| quarantine | தனிமைப்படுத்து |
| inspection | ஆய்வு |
| inspector | ஆய்வாளர் |
| customer | வாடிக்கையாளர் |
| label | லேபிள் |
| pack | பேக் |
| generic | ஜெனரிக் |
| brand | பிராண்ட் |
| over-the-counter | மருந்துச்சீட்டு இன்றி (OTC) |
| pharmacist-only | மருந்தாளர் மட்டும் |
| prescription only | மருந்துச்சீட்டு அவசியம் |

## Validate before finishing
```bash
node test/validate-ta.mjs src/i18n/parts/en/<file> src/i18n/parts/ta/<file>
```
The validator must print `STRUCTURE OK`, and almost every string must contain Tamil script. Fix any errors and run it again. For large files, you may write two halves and merge them with a short `node -e` script. Do not modify any other project file.

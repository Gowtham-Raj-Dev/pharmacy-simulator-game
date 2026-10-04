// ─────────────────────────────────────────────────────────────────────────────
// RxShift — Predefined educational customer scenarios
//
// These are curated teaching cases. The game never "diagnoses": it compares the
// player's decision with the scenario's predefined educational outcome.
//
// correct.type: 'dispense' | 'refer' | 'advise'
// accept: product tag expressions ('a+b' = product must carry both tags)
// facts: hidden customer facts revealed by questions:
//   allergy:*  → ASK ABOUT ALLERGIES
//   med:*      → ASK ABOUT CURRENT MEDICINES
//   cond:*     → ASK ABOUT MEDICAL HISTORY
//   life:*     → ASK ABOUT LIFESTYLE / WORK
// escalate: product flags treated as unsafe (not just caution) in this case
// ─────────────────────────────────────────────────────────────────────────────

export const QUESTION_TYPES = [
  { key: 'duration', label: 'Ask about duration', icon: 'clock', prompt: 'How long have you had these symptoms?' },
  { key: 'symptoms', label: 'Ask about other symptoms', icon: 'pulse', prompt: 'Do you have any other symptoms — fever, pain anywhere else, anything unusual?' },
  { key: 'allergies', label: 'Ask about allergies', icon: 'alert', prompt: 'Are you allergic to any medicines?' },
  { key: 'meds', label: 'Ask about current medicines', icon: 'pill', prompt: 'Are you currently taking any medicines, including supplements?' },
  { key: 'history', label: 'Ask about medical history', icon: 'file', prompt: 'Do you have any medical conditions, or are you pregnant?' },
  { key: 'lifestyle', label: 'Ask about lifestyle / work', icon: 'car', prompt: 'Do you drive or operate machinery? Anything about your routine I should know?' },
];

const S = [];
const add = (o) => S.push(o);

// ═════════════ DIFFICULTY 1 — simple, low-risk cases ═════════════
add({ id: 'S01', difficulty: 1, title: 'Headache and mild fever', patient: { gender: 'M', age: 34 }, gesture: 'headache', budget: 150,
  complaint: 'I have a headache and mild fever since yesterday.',
  answers: {
    duration: 'Since yesterday evening — about a day now.',
    symptoms: 'Mild fever, around 38 °C, and some body ache. No rash, no stiff neck, no vomiting, and I\'m breathing fine.',
    allergies: 'No, I\'m not allergic to any medicine that I know of.',
    meds: 'I\'m not taking any medicines right now.',
    history: 'No medical conditions. I\'m generally healthy.',
    lifestyle: 'I work in an office. Nothing unusual.' },
  facts: [], correct: { type: 'dispense', accept: ['paracetamol', 'ibuprofen'] }, keyQuestions: ['allergies', 'meds'],
  seeDoctor: 'if the fever lasts more than 3 days, gets higher, or you develop a rash, stiff neck, confusion or difficulty breathing',
  learning: 'A short-lived headache with mild fever and no red flags is commonly managed with a simple analgesic such as paracetamol or ibuprofen, after checking allergies and current medicines.' });

add({ id: 'S02', difficulty: 1, title: 'Seasonal hay fever', patient: { gender: 'F', age: 27 }, gesture: 'sneeze', budget: 200,
  complaint: 'My nose keeps running, I\'m sneezing all the time and my eyes are itchy. It happens every spring.',
  answers: {
    duration: 'About a week. It\'s the same every year around this time.',
    symptoms: 'Itchy watery eyes and a runny nose. No fever, no wheezing or chest tightness.',
    allergies: 'Only pollen — no medicine allergies.',
    meds: 'Nothing regularly.',
    history: 'Just seasonal allergies. Not pregnant.',
    lifestyle: 'I work from home, I don\'t drive much.' },
  facts: [], correct: { type: 'dispense', accept: ['non_sedating'] }, alsoOk: { type: 'dispense', accept: ['chlorphenamine'] }, keyQuestions: ['symptoms', 'meds'],
  seeDoctor: 'if you develop wheezing or breathlessness, or your symptoms don\'t improve within a week or two',
  learning: 'Second-generation (low-sedating) antihistamines such as cetirizine, loratadine or fexofenadine are commonly used for hay fever. Wheeze or breathlessness needs referral.' });

add({ id: 'S03', difficulty: 1, title: 'Heartburn after a heavy meal', patient: { gender: 'M', age: 41 }, gesture: 'chest', budget: 150,
  complaint: 'I\'ve got a burning feeling in my chest after a big spicy dinner. I think it\'s acidity.',
  answers: {
    duration: 'Started an hour after dinner. It happens occasionally after heavy meals.',
    symptoms: 'Burning behind the breastbone that rises up. No pain in my arm or jaw, no sweating, no breathlessness, no trouble swallowing and no weight loss.',
    allergies: 'No allergies.',
    meds: 'No regular medicines.',
    history: 'No heart problems or other conditions.',
    lifestyle: 'Office job. I sometimes eat late at night.' },
  facts: [], correct: { type: 'dispense', accept: ['antacid', 'alginate', 'famotidine'] }, keyQuestions: ['symptoms'],
  seeDoctor: 'if it keeps coming back, lasts more than 2 weeks, or you have trouble swallowing, weight loss, vomiting or black stools — and call emergency services for chest pain spreading to the arm or jaw',
  learning: 'Occasional heartburn after meals without alarm features can be managed with an antacid or alginate. Always rule out cardiac-type chest pain by asking about other symptoms.' });

add({ id: 'S04', difficulty: 1, title: 'Small kitchen cut', patient: { gender: 'F', age: 30 }, gesture: 'hand', budget: 150,
  complaint: 'I cut my finger while chopping vegetables. It\'s only a small cut.',
  answers: {
    duration: 'About an hour ago.',
    symptoms: 'It\'s shallow and stopped bleeding after I pressed it. No numbness, I can move my finger normally.',
    allergies: 'No allergies.',
    meds: 'None.',
    history: 'Healthy. I\'m not diabetic.',
    lifestyle: 'I had a tetanus booster two years ago.' },
  facts: [], correct: { type: 'dispense', accept: ['antiseptic', 'plaster', 'gauze'] }, keyQuestions: ['symptoms'],
  seeDoctor: 'if it becomes red, swollen, hot or starts oozing pus, if you develop a fever, or if it won\'t stop bleeding',
  learning: 'Minor clean cuts: clean, apply antiseptic if desired, and cover with a plaster. Deep wounds, uncontrolled bleeding, numbness or signs of infection need medical care.' });

add({ id: 'S05', difficulty: 1, title: 'Dry, cracked hands', patient: { gender: 'F', age: 52 }, gesture: 'hand', budget: 250,
  complaint: 'My hands are so dry and cracked from all the washing. Can you suggest something?',
  answers: {
    duration: 'A few weeks — worse since winter started.',
    symptoms: 'Just dryness and small cracks. No weeping, crusting or signs of infection.',
    allergies: 'None.', meds: 'None.', history: 'No skin conditions.', lifestyle: 'I wash my hands a lot at work in a kitchen.' },
  facts: [], correct: { type: 'dispense', accept: ['emollient'] }, keyQuestions: ['symptoms'],
  seeDoctor: 'if the skin becomes weepy, crusted or painful, or doesn\'t improve within 2 weeks',
  learning: 'Emollients are the mainstay for dry skin — apply often and generously. Paraffin-based emollients carry a fire-risk warning.' });

add({ id: 'S06', difficulty: 1, title: 'Mild diarrhoea', patient: { gender: 'M', age: 25 }, gesture: 'stomach', budget: 120,
  complaint: 'I\'ve had loose motions since this morning. What can I take?',
  answers: {
    duration: 'Since this morning — about four times.',
    symptoms: 'Mild cramps. No blood in the stool, no high fever, and I can keep fluids down.',
    allergies: 'No allergies.', meds: 'Nothing.', history: 'Healthy.', lifestyle: 'I ate street food yesterday.' },
  facts: [], correct: { type: 'dispense', accept: ['ors'] }, alsoOk: { type: 'dispense', accept: ['loperamide'] }, keyQuestions: ['symptoms'],
  seeDoctor: 'if you notice blood in the stool, develop a high fever, show signs of dehydration (very little urine, dizziness), or it lasts more than 2 days',
  learning: 'Fluid and electrolyte replacement (ORS) is the priority in acute diarrhoea. Loperamide may be used short-term by adults only when there is no blood or fever.' });

add({ id: 'S07', difficulty: 1, title: 'Home thermometer', patient: { gender: 'F', age: 35 }, gesture: 'none', budget: 400,
  complaint: 'I need a thermometer for home, for checking my kids\' temperature.',
  answers: {
    duration: 'Nobody is unwell right now — I just want one at home.',
    symptoms: 'No symptoms, just buying ahead.',
    allergies: 'Not relevant — no allergies.', meds: 'None.', history: 'None.', lifestyle: 'I have two children, 4 and 7.' },
  facts: [], correct: { type: 'dispense', accept: ['thermometer'] }, keyQuestions: [],
  seeDoctor: 'if a child has a high fever with a rash, breathing difficulty, drowsiness, or any baby under 3 months has a fever',
  learning: 'Digital thermometers are accurate and easy to clean. A temperature of 38 °C or higher is commonly considered a fever.' });

add({ id: 'S08', difficulty: 1, title: 'Painful mouth ulcer', patient: { gender: 'M', age: 29 }, gesture: 'mouth', budget: 200,
  complaint: 'I have a painful ulcer inside my mouth. It hurts when I eat.',
  answers: {
    duration: 'Three days.',
    symptoms: 'Just one small ulcer. No fever, no other sores, I\'m otherwise well.',
    allergies: 'None.', meds: 'None.', history: 'I get one every few months, they heal in about a week.', lifestyle: 'I bit my cheek by accident last week.' },
  facts: [], correct: { type: 'dispense', accept: ['mouth_ulcer'] }, keyQuestions: ['duration'],
  seeDoctor: 'if the ulcer lasts more than 3 weeks, keeps coming back more often, or is unusually large or painless',
  learning: 'Minor mouth ulcers usually heal within 1–2 weeks. Antiseptic mouthwashes or local anaesthetic gels can ease symptoms. Any ulcer lasting > 3 weeks must be referred.' });

add({ id: 'S09', difficulty: 1, title: 'Mild sunburn', patient: { gender: 'F', age: 22 }, gesture: 'arm', budget: 200,
  complaint: 'I got a bit sunburnt at the beach yesterday. My shoulders are red and sore.',
  answers: {
    duration: 'Since yesterday afternoon.',
    symptoms: 'Red, warm skin on my shoulders. No blisters, no fever, chills or dizziness.',
    allergies: 'None.', meds: 'None.', history: 'Healthy.', lifestyle: 'I\'m going outdoors again this weekend.' },
  facts: [], correct: { type: 'dispense', accept: ['sunburn'] }, alsoOk: { type: 'dispense', accept: ['sunscreen', 'paracetamol'] }, keyQuestions: ['symptoms'],
  seeDoctor: 'if you develop blisters over a large area, fever, chills, dizziness or confusion',
  learning: 'Mild sunburn: cool the skin, moisturise with after-sun or calamine, drink fluids, and protect from further sun exposure. Extensive blistering or systemic symptoms need medical care.' });

// ═════════════ DIFFICULTY 2 — more questions needed ═════════════
add({ id: 'S10', difficulty: 2, title: 'Dry tickly cough', patient: { gender: 'M', age: 38 }, gesture: 'cough', budget: 200,
  complaint: 'I\'ve had a dry, tickly cough for three days. It\'s keeping me up at night.',
  answers: {
    duration: 'Three days.',
    symptoms: 'Dry cough, a bit of a scratchy throat. No phlegm, no breathlessness, no chest pain, no blood.',
    allergies: 'No allergies.', meds: 'No medicines.', history: 'No asthma or lung problems.', lifestyle: 'Non-smoker.' },
  facts: [], correct: { type: 'dispense', accept: ['dextromethorphan', 'linctus'] }, keyQuestions: ['symptoms', 'meds'],
  seeDoctor: 'if the cough lasts more than 3 weeks, you cough up blood, or develop breathlessness, chest pain or high fever',
  learning: 'For a short dry cough, a cough suppressant or soothing linctus can help. Expectorants are meant for chesty coughs. Coughs > 3 weeks need referral.' });

add({ id: 'S11', difficulty: 2, title: 'Chesty cough', patient: { gender: 'F', age: 45 }, gesture: 'cough', budget: 200,
  complaint: 'My chest feels heavy and I\'m coughing up phlegm. Can you give me a cough syrup?',
  answers: {
    duration: 'Four days.',
    symptoms: 'White phlegm. No fever, no blood, not breathless, no chest pain.',
    allergies: 'None.', meds: 'None.', history: 'No asthma, no heart or lung disease.', lifestyle: 'I don\'t smoke.' },
  facts: [], correct: { type: 'dispense', accept: ['guaifenesin'] }, alsoOk: { type: 'dispense', accept: ['linctus'] }, keyQuestions: ['symptoms'],
  seeDoctor: 'if the phlegm becomes green or bloody with fever, you become breathless or have chest pain, or the cough lasts more than 3 weeks',
  learning: 'Chesty (productive) coughs are commonly managed with fluids and an expectorant such as guaifenesin. Cough suppressants are generally not used for productive coughs.' });

add({ id: 'S12', difficulty: 2, title: 'Itchy, peeling feet', patient: { gender: 'M', age: 24 }, gesture: 'none', budget: 200,
  complaint: 'The skin between my toes is itchy, white and peeling. I go to the gym a lot.',
  answers: {
    duration: 'About two weeks.',
    symptoms: 'Itching and peeling between the toes. Nails look normal, no spreading redness, no fever.',
    allergies: 'None.', meds: 'None.', history: 'I\'m not diabetic and have no circulation problems.', lifestyle: 'I wear trainers all day.' },
  facts: [], correct: { type: 'dispense', accept: ['antifungal_topical'] }, keyQuestions: ['history', 'symptoms'],
  seeDoctor: 'if it spreads, affects the nails, or doesn\'t improve after 2 weeks of treatment — people with diabetes should have foot problems checked',
  learning: 'Athlete\'s foot is commonly treated with a topical antifungal (e.g., clotrimazole, terbinafine) plus keeping feet clean and dry. Diabetic foot problems need referral.' });

add({ id: 'S13', difficulty: 2, title: 'Constipation', patient: { gender: 'F', age: 33 }, gesture: 'stomach', budget: 200,
  complaint: 'I haven\'t been able to pass stools properly for four days. I feel bloated.',
  answers: {
    duration: 'Four days.',
    symptoms: 'Bloating. No blood, no weight loss, no severe pain, no vomiting.',
    allergies: 'None.', meds: 'No medicines (no iron tablets or painkillers).', history: 'Not pregnant, no bowel conditions.', lifestyle: 'I\'ve been travelling and eating less fibre and water.' },
  facts: [], correct: { type: 'dispense', accept: ['laxative'] }, keyQuestions: ['symptoms', 'meds'],
  seeDoctor: 'if you notice blood, unexplained weight loss, severe pain, or it lasts more than 2 weeks',
  learning: 'Short-term constipation: increase fluids and fibre; bulk-forming or osmotic laxatives are common first choices. Red flags such as blood or weight loss require referral.' });

add({ id: 'S14', difficulty: 2, title: 'Twisted ankle', patient: { gender: 'M', age: 28 }, gesture: 'limp', budget: 300,
  complaint: 'I twisted my ankle while jogging this morning. It\'s a bit swollen.',
  answers: {
    duration: 'This morning.',
    symptoms: 'Mild swelling. I can walk on it, no deformity, no numbness.',
    allergies: 'No medicine allergies.', meds: 'None.', history: 'No asthma, no stomach problems.', lifestyle: 'I run three times a week.' },
  facts: [], correct: { type: 'dispense', accept: ['diclofenac_gel', 'crepe_bandage', 'cold_pack'] }, alsoOk: { type: 'dispense', accept: ['paracetamol', 'ibuprofen'] }, keyQuestions: ['symptoms', 'allergies'],
  seeDoctor: 'if you can\'t bear weight, there is severe swelling or deformity, or it isn\'t improving after a few days',
  learning: 'Minor sprains: rest, ice (wrapped), compression and elevation, with topical NSAID or simple analgesia if suitable. Inability to bear weight needs assessment.' });

add({ id: 'S15', difficulty: 2, title: 'Toddler nappy rash', patient: { gender: 'F', age: 29 }, child: { gender: 'M', age: 2 }, gesture: 'none', budget: 250,
  complaint: 'My 2-year-old son has a red nappy rash. What can I use?',
  answers: {
    duration: 'Two days.',
    symptoms: 'Red skin in the nappy area. No blisters or pus, and he has no fever. He\'s eating and playing normally.',
    allergies: 'He has no known allergies.', meds: 'He isn\'t taking anything.', history: 'He\'s healthy.', lifestyle: 'We\'ve been using new wipes.' },
  facts: [], correct: { type: 'dispense', accept: ['zinc_oxide'] }, keyQuestions: ['symptoms'],
  seeDoctor: 'if the rash is severe, blistered, spreading beyond the nappy area, or the child develops a fever',
  learning: 'Mild nappy rash: frequent changes, nappy-free time and a barrier cream such as zinc oxide. Severe or spreading rash, or fever, needs referral.' });

add({ id: 'S16', difficulty: 2, title: 'Head lice', patient: { gender: 'F', age: 38 }, child: { gender: 'F', age: 7 }, gesture: 'none', budget: 400,
  complaint: 'The school called — my daughter has head lice. What should I use?',
  answers: {
    duration: 'We noticed it yesterday.',
    symptoms: 'Itchy scalp and I can see live lice. No broken or infected skin.',
    allergies: 'No allergies.', meds: 'None.', history: 'She\'s 7 and healthy.', lifestyle: 'I\'ll check the rest of the family too.' },
  facts: [], correct: { type: 'dispense', accept: ['head_lice'] }, keyQuestions: ['symptoms'],
  seeDoctor: 'if the scalp becomes infected or the treatment fails after two correct applications',
  learning: 'Head lice products (e.g., dimeticone or permethrin lotion) must be applied exactly as directed and usually repeated after 7 days; check and treat affected family members only.' });

add({ id: 'S17', difficulty: 2, title: 'Travel sickness', patient: { gender: 'M', age: 40 }, gesture: 'none', budget: 150,
  complaint: 'I\'m taking a long bus trip tomorrow and always get travel sick.',
  answers: {
    duration: 'It always happens on long journeys.',
    symptoms: 'Nausea during travel only. No other symptoms.',
    allergies: 'None.', meds: 'Nothing.', history: 'No glaucoma or prostate problems.', lifestyle: 'I\'m a passenger — I won\'t be driving.' },
  facts: [], correct: { type: 'dispense', accept: ['travel_sickness'] }, keyQuestions: ['lifestyle', 'history'],
  seeDoctor: 'if vomiting is persistent or you can\'t keep fluids down',
  learning: 'Sedating antihistamines like dimenhydrinate can prevent travel sickness but cause drowsiness — check the person isn\'t driving and has no contraindications.' });

add({ id: 'S18', difficulty: 2, title: 'Mild acne', patient: { gender: 'F', age: 17 }, gesture: 'none', budget: 250,
  complaint: 'I keep getting pimples on my face. Is there something I can use?',
  answers: {
    duration: 'A few months.',
    symptoms: 'Small spots and blackheads. No painful cysts or scarring.',
    allergies: 'None.', meds: 'None.', history: 'Healthy.', lifestyle: 'I wash my face once a day.' },
  facts: [], correct: { type: 'dispense', accept: ['acne'] }, keyQuestions: ['symptoms'],
  seeDoctor: 'if acne is severe, painful, scarring, affecting your mood, or not improving after about 2 months of treatment',
  learning: 'Mild acne is often managed with benzoyl peroxide, starting with a low strength. Severe, scarring or cystic acne needs a doctor.' });

add({ id: 'S19', difficulty: 2, title: 'Blocked ear', patient: { gender: 'M', age: 55 }, gesture: 'ear', budget: 200,
  complaint: 'My right ear feels blocked. I think it\'s wax.',
  answers: {
    duration: 'About a week.',
    symptoms: 'Muffled hearing only. No pain, no discharge, no dizziness, no fever.',
    allergies: 'None.', meds: 'None.', history: 'No ear operations or perforated eardrum.', lifestyle: 'I use cotton buds a lot.' },
  facts: [], correct: { type: 'dispense', accept: ['ear_wax'] }, keyQuestions: ['symptoms', 'history'],
  seeDoctor: 'if you have ear pain, discharge, dizziness, sudden hearing loss, or symptoms persist after treatment',
  learning: 'Ear-wax softening drops are suitable for simple wax build-up. Pain, discharge, dizziness or a possible perforated eardrum require referral. Avoid cotton buds.' });

add({ id: 'S20', difficulty: 2, title: 'Tired, dry eyes', patient: { gender: 'F', age: 31 }, gesture: 'eyes', budget: 250,
  complaint: 'My eyes feel dry and gritty, especially after work on the computer.',
  answers: {
    duration: 'A couple of months, worse in the evening.',
    symptoms: 'Gritty and tired eyes. No pain, no light sensitivity, and my vision is normal.',
    allergies: 'None.', meds: 'None.', history: 'Healthy, I don\'t wear contact lenses.', lifestyle: 'I work at a screen for 9 hours a day.' },
  facts: [], correct: { type: 'dispense', accept: ['dry_eye'] }, keyQuestions: ['symptoms'],
  seeDoctor: 'if you have eye pain, sensitivity to light, or any change in vision',
  learning: 'Lubricant eye drops and screen breaks help dry eyes. A painful red eye, light sensitivity or reduced vision must be referred urgently.' });

add({ id: 'S21', difficulty: 2, title: 'Threadworm in the family', patient: { gender: 'F', age: 34 }, child: { gender: 'M', age: 7 }, gesture: 'none', budget: 200,
  complaint: 'My son has an itchy bottom at night and I saw tiny white worms. I think it\'s threadworm.',
  answers: {
    duration: 'A few nights now.',
    symptoms: 'Itching at night. No weight loss, tummy pain or blood.',
    allergies: 'No allergies.', meds: 'Nothing.', history: 'He\'s 7. I\'m not pregnant or breastfeeding.', lifestyle: 'There are four of us at home.' },
  facts: [], correct: { type: 'dispense', accept: ['mebendazole', 'albendazole'] }, keyQuestions: ['history'],
  seeDoctor: 'if symptoms persist after treatment, or for children under 2 or anyone pregnant',
  learning: 'Threadworm: an anthelmintic such as mebendazole for household members (with age/pregnancy checks) plus strict hygiene measures.' });

add({ id: 'S22', difficulty: 2, title: 'Quitting smoking', patient: { gender: 'M', age: 46 }, gesture: 'none', budget: 300,
  complaint: 'I want to quit smoking. Is there something to help with the cravings?',
  answers: {
    duration: 'I\'ve smoked for 20 years.',
    symptoms: 'No chest pain or breathing problems.',
    allergies: 'None.', meds: 'None.', history: 'No heart attack, stroke or heart problems.', lifestyle: 'About 15 cigarettes a day.' },
  facts: [], correct: { type: 'dispense', accept: ['nrt'] }, keyQuestions: ['history'],
  seeDoctor: 'or a stop-smoking service for extra support — combining NRT with behavioural support works best',
  learning: 'Nicotine replacement therapy reduces withdrawal symptoms. Check for recent cardiovascular events, and encourage behavioural support.' });

// ═════════════ DIFFICULTY 3 — safety traps ═════════════
add({ id: 'S23', difficulty: 3, title: 'Headache — patient on warfarin', patient: { gender: 'M', age: 67 }, gesture: 'headache', budget: 150,
  complaint: 'I\'ve got a nagging tension headache. Can I have some ibuprofen?',
  answers: {
    duration: 'Since this morning.',
    symptoms: 'Dull headache across the forehead. It came on slowly. No fall or knock to the head, no drowsiness or vomiting, no vision problems, no weakness, no unusual bleeding.',
    allergies: 'No allergies.',
    meds: 'I take warfarin for my heart rhythm, and a cholesterol tablet.',
    history: 'Atrial fibrillation — that\'s why I\'m on warfarin. I get this same tension headache now and then when I\'m stressed; it feels exactly like my usual ones.', lifestyle: 'Retired.' },
  facts: ['med:warfarin'], correct: { type: 'dispense', accept: ['paracetamol'] }, keyQuestions: ['meds'],
  seeDoctor: 'if the headache is sudden and severe, follows a head injury, or you notice unusual bleeding or bruising — and mention regular paracetamol use to your anticoagulation clinic',
  learning: 'NSAIDs and aspirin increase bleeding risk with warfarin. Paracetamol at standard doses is generally preferred for occasional pain; regular use should be discussed with the anticoagulation clinic.' });

add({ id: 'S24', difficulty: 3, title: 'Back pain with asthma', patient: { gender: 'F', age: 36 }, gesture: 'back', budget: 200,
  complaint: 'I strained my lower back lifting boxes. Give me something strong, please.',
  answers: {
    duration: 'Two days.',
    symptoms: 'Muscle ache in the lower back. No numbness, no leg weakness, no problems passing urine.',
    allergies: 'Not allergic exactly — but ibuprofen made my asthma worse once.',
    meds: 'Just my blue reliever inhaler when needed.',
    history: 'I have asthma. Last time I took ibuprofen I became wheezy.', lifestyle: 'I\'m moving house.' },
  facts: ['cond:asthma_nsaid', 'allergy:nsaid'], correct: { type: 'dispense', accept: ['paracetamol'] }, keyQuestions: ['history', 'allergies'],
  seeDoctor: 'if you develop numbness, leg weakness, problems passing urine, or the pain isn\'t improving after a couple of weeks',
  learning: 'Some people with asthma are sensitive to NSAIDs (including aspirin and topical NSAIDs). Paracetamol is a safer option for them.' });

add({ id: 'S25', difficulty: 3, title: 'Blocked nose with high blood pressure', patient: { gender: 'M', age: 58 }, gesture: 'sneeze', budget: 200,
  complaint: 'I have a terribly blocked nose from a cold. I need a strong decongestant tablet.',
  answers: {
    duration: 'Three days.',
    symptoms: 'Blocked nose and mild sore throat. No high fever, no facial swelling.',
    allergies: 'No allergies.',
    meds: 'I take amlodipine for my blood pressure.',
    history: 'High blood pressure.', lifestyle: 'Office worker.' },
  facts: ['cond:hypertension', 'med:antihypertensive'], correct: { type: 'dispense', accept: ['saline', 'steam_inhalation'] }, alsoOk: { type: 'dispense', accept: ['xylometazoline'] }, keyQuestions: ['meds', 'history'],
  seeDoctor: 'if symptoms last more than 10 days, you develop severe facial pain or high fever',
  learning: 'Oral decongestants (pseudoephedrine, phenylephrine) can raise blood pressure — avoid in hypertension. Saline sprays or steam inhalation are safer alternatives.' });

add({ id: 'S26', difficulty: 3, title: 'Dry cough — diabetic customer', patient: { gender: 'F', age: 60 }, gesture: 'cough', budget: 200,
  complaint: 'I have a dry cough that won\'t settle. Can I have a cough syrup?',
  answers: {
    duration: 'Five days.',
    symptoms: 'Dry, irritating cough. No breathlessness, no blood, no fever.',
    allergies: 'None.',
    meds: 'Metformin for my diabetes.',
    history: 'Type 2 diabetes.', lifestyle: 'I watch my sugar intake carefully.' },
  facts: ['cond:diabetes'], escalate: ['contains_sugar'], correct: { type: 'dispense', accept: ['dextromethorphan+sugar_free'] }, keyQuestions: ['history', 'meds'],
  seeDoctor: 'if the cough lasts more than 3 weeks, or you develop breathlessness, chest pain or blood in the phlegm',
  learning: 'For customers with diabetes, choose sugar-free liquid formulations where possible.' });

add({ id: 'S27', difficulty: 3, title: 'Hay fever — professional driver', patient: { gender: 'M', age: 44 }, gesture: 'sneeze', budget: 200,
  complaint: 'My hay fever is bad this week — sneezing and runny nose. Something cheap that works?',
  answers: {
    duration: 'About five days.',
    symptoms: 'Sneezing, runny nose, itchy eyes. No wheeze.',
    allergies: 'None.', meds: 'None.', history: 'Only hay fever.',
    lifestyle: 'I\'m a truck driver — I\'ll be driving through the night.' },
  facts: ['life:driver'], correct: { type: 'dispense', accept: ['non_sedating'] }, keyQuestions: ['lifestyle'],
  seeDoctor: 'if you develop wheezing or breathlessness',
  learning: 'Sedating antihistamines (e.g., chlorphenamine) impair driving. Choose a low-sedating antihistamine and advise caution if any drowsiness occurs.' });

add({ id: 'S28', difficulty: 3, title: 'Child fever — parent asks for aspirin', patient: { gender: 'F', age: 35 }, child: { gender: 'M', age: 6 }, gesture: 'none', budget: 150,
  complaint: 'My 6-year-old has a fever. Can I give him some of my aspirin?',
  answers: {
    duration: 'Since last night.',
    symptoms: 'Temperature 38.4 °C. He\'s a bit tired but drinking and playing. No rash, no breathing difficulty, no stiff neck, not drowsy.',
    allergies: 'No allergies.', meds: 'Nothing.', history: 'He\'s healthy. No asthma.', lifestyle: 'He goes to school.' },
  facts: [], correct: { type: 'dispense', accept: ['paracetamol+paediatric', 'ibuprofen+paediatric'] }, keyQuestions: ['symptoms', 'allergies'],
  seeDoctor: 'if the fever lasts more than 3 days, or he develops a rash that doesn\'t fade, breathing difficulty, stiff neck, unusual drowsiness or signs of dehydration',
  learning: 'Aspirin must not be given to children under 16 (risk of Reye\'s syndrome). Use a paediatric paracetamol or ibuprofen formulation dosed by age/weight.' });

add({ id: 'S29', difficulty: 3, title: 'Already taking a paracetamol combination', patient: { gender: 'M', age: 30 }, gesture: 'headache', budget: 150,
  complaint: 'I\'m taking a cold and flu tablet but my headache is still there. Can I add some paracetamol?',
  answers: {
    duration: 'Cold started two days ago.',
    symptoms: 'Runny nose, mild headache, slight temperature. No stiff neck, rash or breathing problems.',
    allergies: 'None.',
    meds: 'A cold and flu combination tablet — the label says paracetamol, phenylephrine and chlorphenamine. Four times a day.',
    history: 'Healthy.', lifestyle: 'Desk job.' },
  facts: ['med:paracetamol_combo', 'med:sedatives', 'med:decongestant_oral'], correct: { type: 'advise' }, alsoOk: { type: 'dispense', accept: ['saline', 'steam_inhalation'] }, keyQuestions: ['meds'],
  adviceOptions: [
    { text: 'Your cold tablet already contains paracetamol, so taking more could exceed the safe daily limit. Keep to the label dose, rest and drink fluids; see a doctor if you feel worse or it lasts beyond a week.', correct: true },
    { text: 'Paracetamol is very safe, so you can take extra tablets on top of the cold & flu product.' },
    { text: 'Double your cold & flu tablets for a day to clear the headache faster.' },
  ],
  seeDoctor: 'if symptoms worsen or last more than a week',
  learning: 'Duplicate ingredients are a common cause of accidental overdose. Many cold & flu products contain paracetamol — always check the full ingredient list.' });

add({ id: 'S30', difficulty: 3, title: 'Headache in pregnancy', patient: { gender: 'F', age: 29 }, gesture: 'headache', budget: 150,
  complaint: 'I have a headache. Can I take ibuprofen?',
  answers: {
    duration: 'Since this afternoon.',
    symptoms: 'Mild headache. No blurred vision or flashing lights, no sudden swelling of my face or hands, no tummy pain.',
    allergies: 'No allergies.', meds: 'Just pregnancy vitamins with folic acid.',
    history: 'I\'m 24 weeks pregnant. Otherwise healthy.', lifestyle: 'I\'m on maternity leave soon.' },
  facts: ['cond:pregnancy'], correct: { type: 'dispense', accept: ['paracetamol'] }, keyQuestions: ['history'],
  seeDoctor: 'and let your midwife know so your blood pressure can be checked — seek urgent care for a severe headache, visual disturbances, or sudden swelling of the face, hands or feet',
  learning: 'NSAIDs such as ibuprofen are generally avoided in pregnancy unless prescribed. Paracetamol at the lowest effective dose is usually preferred. Severe headache with visual symptoms or swelling may signal pre-eclampsia.' });

add({ id: 'S31', difficulty: 3, title: 'Heartburn in pregnancy', patient: { gender: 'F', age: 31 }, gesture: 'chest', budget: 200,
  complaint: 'I get heartburn every evening. Is there something safe I can take?',
  answers: {
    duration: 'A few weeks — it started in the third trimester.',
    symptoms: 'Burning after meals and when lying down. No vomiting, no severe upper tummy pain, no headache or vision changes.',
    allergies: 'None.', meds: 'Pregnancy multivitamin.',
    history: 'I\'m 30 weeks pregnant.', lifestyle: 'I eat late dinners.' },
  facts: ['cond:pregnancy'], correct: { type: 'dispense', accept: ['antacid', 'alginate'] }, keyQuestions: ['history'],
  seeDoctor: 'and mention it to your midwife; seek urgent care for severe upper abdominal pain, headache or vision changes',
  learning: 'Heartburn is common in pregnancy; antacids and alginates are commonly used first-line. Acid-reducing tablets should be checked with the doctor.' });

add({ id: 'S32', difficulty: 3, title: 'Penicillin allergy — amoxicillin prescription', patient: { gender: 'F', age: 48 }, gesture: 'none', budget: 200,
  complaint: 'Here\'s my prescription from the clinic. I need these antibiotics.',
  prescription: { drug: 'Amoxicillin 500 mg capsules', directions: '1 capsule three times daily for 5 days', doctor: 'Dr. A. Rao (Demo Clinic)', daysAgo: 1, valid: true, baseKey: 'amoxicillin' },
  answers: {
    duration: 'The doctor diagnosed a chest infection yesterday.',
    symptoms: 'Cough with fever. No severe breathlessness.',
    allergies: 'Yes — penicillin gives me a rash and swelling. I don\'t think I told the doctor.',
    meds: 'Nothing else.', history: 'No other conditions.', lifestyle: 'I work in a bank.' },
  facts: ['allergy:penicillin'], correct: { type: 'refer', urgency: 'doctor' }, keyQuestions: ['allergies'],
  adviceOptions: [
    { text: 'Amoxicillin is a penicillin, and you\'ve reacted to penicillin before. I can\'t dispense this safely — I\'ll contact your prescriber so they can choose a suitable alternative today.', correct: true },
    { text: 'It\'s a different brand, so the allergy won\'t matter. Take it as prescribed.' },
    { text: 'Take half the dose to reduce the chance of a reaction.' },
  ],
  learning: 'Always check allergies before dispensing, even with a valid prescription. A penicillin allergy means amoxicillin must not be given; contact the prescriber for an alternative.' });

add({ id: 'S33', difficulty: 3, title: 'Elderly customer wants sleeping pills', patient: { gender: 'M', age: 74 }, gesture: 'tired', budget: 200,
  complaint: 'I can\'t sleep well these days. Give me some sleeping tablets.',
  answers: {
    duration: 'A few weeks.',
    symptoms: 'I wake up at night to pass urine and can\'t get back to sleep. No low mood, no pain, no breathing problems at night.',
    allergies: 'None.',
    meds: 'Tablets for my prostate and for blood pressure.',
    history: 'Enlarged prostate and high blood pressure.', lifestyle: 'I drink tea in the evening and nap in the afternoon.' },
  facts: ['cond:prostate', 'med:antihypertensive'], escalate: ['sedating'], correct: { type: 'advise' }, alsoOk: { type: 'refer', urgency: 'doctor' }, keyQuestions: ['meds', 'history'],
  adviceOptions: [
    { text: 'Sedating sleep aids can cause confusion, falls and urinary problems in older adults, especially with prostate issues. Let\'s try sleep-hygiene steps — less evening tea, shorter naps, a regular bedtime — and see your doctor if it continues, as the night-time urination should be reviewed.', correct: true },
    { text: 'Take two antihistamine sleep tablets every night; they\'re harmless.' },
    { text: 'Borrow a friend\'s prescription sleeping pills for a few nights.' },
  ],
  seeDoctor: 'if poor sleep continues, or the night-time urination gets worse',
  learning: 'Sedating antihistamines (e.g., diphenhydramine) are generally not recommended for older adults due to anticholinergic effects, confusion and falls risk. Address causes and sleep hygiene.' });

add({ id: 'S34', difficulty: 3, title: 'Knee pain — stomach ulcer history', patient: { gender: 'M', age: 52 }, gesture: 'limp', budget: 250,
  complaint: 'My knee aches after walking. I want some painkiller tablets.',
  answers: {
    duration: 'On and off for months.',
    symptoms: 'Aching knee after activity. No redness, no hot swollen joint, no injury, no fever.',
    allergies: 'No allergies.', meds: 'Nothing regular.',
    history: 'I had a stomach ulcer that bled two years ago.', lifestyle: 'I walk every morning.' },
  facts: ['cond:peptic_ulcer'], correct: { type: 'dispense', accept: ['paracetamol', 'diclofenac_gel'] }, keyQuestions: ['history'],
  seeDoctor: 'if the knee becomes hot, red and swollen, you can\'t bear weight, or the pain keeps getting worse',
  learning: 'Oral NSAIDs and aspirin are avoided after a peptic ulcer/GI bleed. Paracetamol or a topical NSAID (low systemic exposure) are commonly considered instead.' });

add({ id: 'S35', difficulty: 3, title: 'Toothache — patient on lithium', patient: { gender: 'F', age: 41 }, gesture: 'mouth', budget: 150,
  complaint: 'I have a toothache. Can I get ibuprofen until I see the dentist?',
  answers: {
    duration: 'Two days.',
    symptoms: 'Throbbing tooth. No facial swelling, no fever, no difficulty swallowing or opening my mouth.',
    allergies: 'None.',
    meds: 'I take lithium every day.',
    history: 'Bipolar disorder — stable on lithium.', lifestyle: 'Teacher.' },
  facts: ['med:lithium'], correct: { type: 'dispense', accept: ['paracetamol'] }, keyQuestions: ['meds'],
  seeDoctor: 'and book a dentist appointment soon — go urgently for facial swelling, fever or difficulty swallowing',
  learning: 'NSAIDs can raise lithium levels and cause toxicity. Paracetamol is preferred, and dental pain needs a dentist.' });

add({ id: 'S36', difficulty: 3, title: 'Graze — iodine allergy', patient: { gender: 'M', age: 33 }, gesture: 'arm', budget: 150,
  complaint: 'I fell off my bike and scraped my elbow. I need something to clean it.',
  answers: {
    duration: 'Half an hour ago.',
    symptoms: 'Surface graze, a little gravel I\'ve rinsed out. No deep cut, I can move my arm fine.',
    allergies: 'Yes — I react to iodine.', meds: 'None.', history: 'Healthy.', lifestyle: 'Tetanus jab is up to date.' },
  facts: ['allergy:iodine'], correct: { type: 'dispense', accept: ['chlorhexidine_antiseptic', 'plaster', 'gauze'] }, keyQuestions: ['allergies'],
  seeDoctor: 'if the wound shows signs of infection, or dirt can\'t be removed',
  learning: 'Always ask about allergies before recommending antiseptics. Povidone-iodine should be avoided in people with iodine sensitivity.' });

add({ id: 'S37', difficulty: 3, title: 'Teenager with fever — aspirin request', patient: { gender: 'F', age: 44 }, child: { gender: 'F', age: 15 }, gesture: 'none', budget: 150,
  complaint: 'My 15-year-old daughter has a fever and body aches. Can I give her aspirin?',
  answers: {
    duration: 'Since yesterday.',
    symptoms: 'Fever 38.2 °C, body aches, sore throat. No rash, no stiff neck, she\'s drinking fluids.',
    allergies: 'No allergies.', meds: 'None.', history: 'Healthy, no asthma.', lifestyle: 'She has exams this week.' },
  facts: [], correct: { type: 'dispense', accept: ['paracetamol', 'ibuprofen'] }, keyQuestions: ['symptoms'],
  seeDoctor: 'if the fever lasts more than 3 days, or she develops a rash, stiff neck, severe sore throat with difficulty swallowing, or confusion',
  learning: 'Aspirin is not given to anyone under 16 because of the risk of Reye\'s syndrome. Paracetamol or ibuprofen are suitable alternatives when there are no contraindications.' });

add({ id: 'S38', difficulty: 3, title: 'Child with cough', patient: { gender: 'M', age: 37 }, child: { gender: 'F', age: 4 }, gesture: 'none', budget: 150,
  complaint: 'My 4-year-old has a cough. Can I give her a cough suppressant syrup?',
  answers: {
    duration: 'Three days.',
    symptoms: 'Dry cough, runny nose. She\'s eating and playing. No breathing difficulty, no high fever, no wheeze.',
    allergies: 'None.', meds: 'None.', history: 'Healthy.', lifestyle: 'Goes to nursery.' },
  facts: [], correct: { type: 'dispense', accept: ['linctus'] }, alsoOk: { type: 'advise' }, keyQuestions: ['symptoms'],
  adviceOptions: [
    { text: 'For young children, cough suppressants aren\'t recommended. Warm drinks, honey (over age 1) and rest usually help; see a doctor if she has breathing difficulty, high fever or the cough lasts more than 3 weeks.', correct: true },
    { text: 'Give her an adult cough suppressant at half dose.' },
    { text: 'Antibiotics will stop the cough quickly.' },
  ],
  seeDoctor: 'if she has breathing difficulty, a high fever, or the cough lasts more than 3 weeks',
  learning: 'Many OTC cough suppressants are not recommended for young children. Simple soothing remedies (e.g., honey for children over 1 year) and fluids are preferred.' });

// ═════════════ DIFFICULTY 4 — red flags & referral ═════════════
add({ id: 'S39', difficulty: 4, title: 'Chest pain disguised as indigestion', patient: { gender: 'M', age: 56 }, gesture: 'chest', budget: 150,
  complaint: 'I\'ve got bad indigestion. Can I have an antacid?',
  answers: {
    duration: 'It started about 30 minutes ago.',
    symptoms: 'It\'s a heavy pressure in my chest spreading to my left arm and jaw. I feel sweaty and a bit sick.',
    allergies: 'None.', meds: 'Blood pressure tablets.', history: 'High blood pressure, I smoke.', lifestyle: 'I was climbing stairs when it started.' },
  facts: ['cond:hypertension'], correct: { type: 'refer', urgency: 'emergency' }, keyQuestions: ['symptoms'],
  adviceOptions: [
    { text: 'These symptoms could be a heart problem. Please sit down — I\'m calling emergency services right now. This needs urgent hospital care, not an antacid.', correct: true },
    { text: 'Take this antacid and come back tomorrow if it hasn\'t settled.' },
    { text: 'Walk around a bit to see if the pain goes away.' },
  ],
  learning: 'Chest pressure spreading to the arm or jaw with sweating or nausea may indicate a heart attack. Call emergency services immediately — never treat as indigestion.' });

add({ id: 'S40', difficulty: 4, title: 'Sudden severe headache', patient: { gender: 'F', age: 42 }, gesture: 'headache', budget: 150,
  complaint: 'I need your strongest painkiller. My head is killing me.',
  answers: {
    duration: 'It came on suddenly about an hour ago — like being hit on the head.',
    symptoms: 'It\'s the worst headache of my life. My neck is stiff and I\'ve vomited twice. Light hurts my eyes.',
    allergies: 'None.', meds: 'None.', history: 'I don\'t usually get headaches.', lifestyle: 'Office worker.' },
  facts: [], correct: { type: 'refer', urgency: 'emergency' }, keyQuestions: ['symptoms', 'duration'],
  adviceOptions: [
    { text: 'A sudden, severe headache with a stiff neck and vomiting needs emergency assessment. I\'m calling an ambulance. Please lie down here while we wait, and don\'t take any painkillers in the meantime.', correct: true },
    { text: 'Take two strong painkillers and lie down in a dark room.' },
    { text: 'It\'s probably a migraine; come back if it happens again.' },
  ],
  learning: 'A "thunderclap" (sudden, worst-ever) headache, especially with a stiff neck, vomiting or light sensitivity, is a medical emergency.' });

add({ id: 'S41', difficulty: 4, title: 'Fever in a young infant', patient: { gender: 'F', age: 28 }, child: { gender: 'M', age: 0, months: 2 }, gesture: 'none', budget: 150,
  complaint: 'My 2-month-old baby has a temperature. Can I get some infant paracetamol drops?',
  answers: {
    duration: 'Since this morning.',
    symptoms: 'His temperature is 38.4 °C. He\'s feeding less than usual and sleepier.',
    allergies: 'No allergies.', meds: 'None.', history: 'He was born full-term, healthy.', lifestyle: 'He had his first vaccines last week.' },
  facts: [], correct: { type: 'refer', urgency: 'emergency' }, alsoOk: { type: 'refer', urgency: 'doctor' }, keyQuestions: ['symptoms'],
  adviceOptions: [
    { text: 'Babies under 3 months with a temperature of 38 °C or more need to be seen by a doctor urgently today. Please take him to a doctor or emergency department now.', correct: true },
    { text: 'Give the drops every 4 hours and wait a few days.' },
    { text: 'Wrap him in warm blankets to sweat out the fever.' },
  ],
  learning: 'Any infant under 3 months with a fever of 38 °C or higher must be urgently assessed by a doctor. Do not simply sell an antipyretic.' });

add({ id: 'S42', difficulty: 4, title: 'Persistent cough with weight loss', patient: { gender: 'M', age: 35 }, gesture: 'cough', budget: 200,
  complaint: 'I need a strong cough syrup. This cough just won\'t go away.',
  answers: {
    duration: 'About four weeks now.',
    symptoms: 'I\'ve lost weight without trying, I sweat at night, and sometimes there\'s a little blood in my phlegm.',
    allergies: 'None.', meds: 'I tried two cough syrups already.', history: 'No known conditions.', lifestyle: 'I live in a crowded hostel.' },
  facts: [], correct: { type: 'refer', urgency: 'doctor' }, keyQuestions: ['duration', 'symptoms'],
  adviceOptions: [
    { text: 'A cough lasting this long with weight loss, night sweats and blood in the phlegm must be checked by a doctor promptly — it needs tests, not another cough syrup.', correct: true },
    { text: 'Try this stronger cough syrup for another two weeks.' },
    { text: 'It\'s probably just a smoker\'s cough; ignore it.' },
  ],
  learning: 'A cough lasting more than 2–3 weeks, especially with weight loss, night sweats or blood, requires medical evaluation (e.g., for tuberculosis or other serious causes).' });

add({ id: 'S43', difficulty: 4, title: 'Bloody diarrhoea with fever', patient: { gender: 'F', age: 26 }, gesture: 'stomach', budget: 150,
  complaint: 'I have bad diarrhoea. Can I get loperamide to stop it?',
  answers: {
    duration: 'Two days.',
    symptoms: 'There\'s blood in the stool and I have a high fever. Severe cramps.',
    allergies: 'None.', meds: 'None.', history: 'Healthy.', lifestyle: 'I came back from a trip last week.' },
  facts: [], correct: { type: 'refer', urgency: 'doctor' }, keyQuestions: ['symptoms'],
  adviceOptions: [
    { text: 'Blood in the stool with a high fever needs to be seen by a doctor today. Loperamide isn\'t suitable here. Keep sipping fluids or ORS on the way.', correct: true },
    { text: 'Loperamide will stop it — take double the dose.' },
    { text: 'Avoid all fluids until the diarrhoea stops.' },
  ],
  learning: 'Bloody diarrhoea and/or high fever are red flags. Antimotility drugs like loperamide should not be used; refer for medical assessment.' });

add({ id: 'S44', difficulty: 4, title: 'Antibiotics for a cold', patient: { gender: 'M', age: 31 }, gesture: 'sneeze', budget: 200,
  complaint: 'Just give me some antibiotics, I have a cold. I don\'t have time for a doctor.',
  answers: {
    duration: 'Two days.',
    symptoms: 'Runny nose, sore throat, mild temperature. No breathing difficulty, no ear pain, no severe throat pain.',
    allergies: 'None.', meds: 'None.', history: 'Healthy.', lifestyle: 'Very busy at work.' },
  facts: [], correct: { type: 'dispense', accept: ['paracetamol', 'ibuprofen', 'saline', 'lozenge', 'linctus'] }, alsoOk: { type: 'advise' }, keyQuestions: ['symptoms'],
  adviceOptions: [
    { text: 'Colds are caused by viruses, so antibiotics won\'t help and need a prescription. Rest, fluids and symptom relief are best; see a doctor if you get breathing difficulty, ear pain or it lasts over 10 days.', correct: true },
    { text: 'I\'ll give you leftover antibiotics from another customer.' },
    { text: 'Antibiotics will make the cold go away in a day.' },
  ],
  seeDoctor: 'if you develop breathing difficulty, ear or severe throat pain, or symptoms last more than 10 days',
  learning: 'Antibiotics do not work against viral infections like colds, and supplying prescription-only antibiotics without a prescription is unsafe and non-compliant. Offer symptomatic relief.' });

add({ id: 'S45', difficulty: 4, title: 'Changing mole', patient: { gender: 'F', age: 47 }, gesture: 'arm', budget: 200,
  complaint: 'I have a mole on my back that\'s itchy. Can you give me a cream?',
  answers: {
    duration: 'I noticed it changing over the last two months.',
    symptoms: 'It\'s got bigger, the edge is irregular, it has two colours now and it bled once.',
    allergies: 'None.', meds: 'None.', history: 'I had bad sunburns as a child.', lifestyle: 'I work outdoors.' },
  facts: [], correct: { type: 'refer', urgency: 'doctor' }, keyQuestions: ['duration', 'symptoms'],
  adviceOptions: [
    { text: 'A mole that\'s changing in size, shape or colour, or bleeding, should be checked by a doctor soon. A cream isn\'t appropriate until it has been assessed.', correct: true },
    { text: 'Use hydrocortisone cream on it for a month.' },
    { text: 'Try to remove it yourself at home.' },
  ],
  learning: 'Changes in a mole (asymmetry, irregular border, colour change, increasing size, bleeding) require prompt medical assessment for possible skin cancer.' });

add({ id: 'S46', difficulty: 4, title: 'Non-healing diabetic foot wound', patient: { gender: 'M', age: 63 }, gesture: 'limp', budget: 200,
  complaint: 'I have a small sore on my foot. I need an antiseptic cream.',
  answers: {
    duration: 'About two weeks — it isn\'t healing.',
    symptoms: 'The skin around it is red and warm, and I can\'t feel my toes well.',
    allergies: 'None.', meds: 'Metformin and insulin.', history: 'Type 2 diabetes for 15 years.', lifestyle: 'I walk barefoot at home.' },
  facts: ['cond:diabetes'], correct: { type: 'refer', urgency: 'doctor' }, keyQuestions: ['history', 'duration'],
  adviceOptions: [
    { text: 'With diabetes, a foot wound that isn\'t healing and looks red needs to be seen by a doctor or foot clinic promptly — today if possible. Please don\'t rely on a cream alone.', correct: true },
    { text: 'Apply this antiseptic for a few more weeks and see.' },
    { text: 'Soak the foot in very hot water every day.' },
  ],
  learning: 'Foot wounds in people with diabetes can deteriorate quickly due to poor circulation and reduced sensation. Refer promptly.' });

add({ id: 'S47', difficulty: 4, title: 'Bee sting with throat swelling', patient: { gender: 'F', age: 24 }, gesture: 'throat', budget: 150,
  complaint: 'A bee stung me ten minutes ago. Can I get an antihistamine?',
  answers: {
    duration: 'Ten minutes ago.',
    symptoms: 'My lips are swelling, my throat feels tight and it\'s getting hard to breathe. I feel dizzy.',
    allergies: 'I had a big reaction to a sting once before.', meds: 'None.', history: 'Asthma as a child.', lifestyle: 'I was in the park.' },
  facts: [], correct: { type: 'refer', urgency: 'emergency' }, keyQuestions: ['symptoms'],
  adviceOptions: [
    { text: 'This looks like a severe allergic reaction (anaphylaxis). I\'m calling emergency services now. If you carry an adrenaline auto-injector, use it immediately.', correct: true },
    { text: 'Take an antihistamine tablet and wait to see if it settles.' },
    { text: 'Put some calamine lotion on the sting.' },
  ],
  learning: 'Swelling of the lips/throat, breathing difficulty or dizziness after a sting suggests anaphylaxis — call emergency services and use adrenaline if available. Antihistamines alone are not enough.' });

add({ id: 'S48', difficulty: 4, title: 'Heartburn with difficulty swallowing', patient: { gender: 'M', age: 61 }, gesture: 'chest', budget: 200,
  complaint: 'I need something for my heartburn. The usual antacids aren\'t working.',
  answers: {
    duration: 'About three months now.',
    symptoms: 'Food feels like it gets stuck when I swallow, and I\'ve lost weight without trying.',
    allergies: 'None.', meds: 'I\'ve been taking antacids every day.', history: 'No diagnosis.', lifestyle: 'I smoke.' },
  facts: [], correct: { type: 'refer', urgency: 'doctor' }, keyQuestions: ['duration', 'symptoms'],
  adviceOptions: [
    { text: 'Difficulty swallowing and unexplained weight loss are alarm symptoms. You need to see a doctor soon for investigations rather than continue antacids.', correct: true },
    { text: 'Switch to a stronger antacid and keep taking it for a few more months.' },
    { text: 'Eat softer food and ignore it.' },
  ],
  learning: 'Alarm features with dyspepsia (difficulty swallowing, weight loss, vomiting, GI bleeding, persistent symptoms in older adults) require medical referral.' });

add({ id: 'S49', difficulty: 4, title: 'Painful red eye with blurred vision', patient: { gender: 'F', age: 39 }, gesture: 'eyes', budget: 200,
  complaint: 'My eye is red. Can I have some eye drops?',
  answers: {
    duration: 'Since yesterday.',
    symptoms: 'It\'s very painful, my vision is blurry in that eye, and light really hurts.',
    allergies: 'None.', meds: 'None.', history: 'I wear contact lenses.', lifestyle: 'I sometimes sleep with my lenses in.' },
  facts: [], correct: { type: 'refer', urgency: 'emergency' }, keyQuestions: ['symptoms'],
  adviceOptions: [
    { text: 'A painful red eye with blurred vision and light sensitivity — especially with contact lenses — needs urgent eye assessment today. Remove your lenses and go to an eye casualty or emergency department.', correct: true },
    { text: 'Use lubricant drops for a week and see.' },
    { text: 'Keep wearing your contact lenses to protect the eye.' },
  ],
  learning: 'Red-eye red flags: pain, reduced vision, photophobia, contact-lens wear. These need urgent same-day eye assessment.' });

add({ id: 'S50', difficulty: 4, title: 'Asthma reliever not working', patient: { gender: 'M', age: 19 }, gesture: 'throat', budget: 200,
  complaint: 'I need a new inhaler, mine isn\'t working. I can\'t catch my breath.',
  answers: {
    duration: 'It got worse over the last hour.',
    symptoms: 'I\'m very breathless, I can\'t finish sentences, and my lips look a bit blue. My reliever isn\'t helping.',
    allergies: 'None.', meds: 'Blue reliever inhaler — I\'ve used it many times today.', history: 'Asthma.', lifestyle: 'Student.' },
  facts: ['cond:asthma'], correct: { type: 'refer', urgency: 'emergency' }, keyQuestions: ['symptoms'],
  adviceOptions: [
    { text: 'This sounds like a severe asthma attack. I\'m calling emergency services now. Sit upright, and keep using your reliever as your asthma plan directs while we wait.', correct: true },
    { text: 'Here\'s a cough syrup; go home and rest.' },
    { text: 'Come back tomorrow with a prescription.' },
  ],
  learning: 'Inability to complete sentences, worsening breathlessness and poor response to a reliever indicate a severe asthma attack — an emergency.' });

// ═════════════ DIFFICULTY 5 — prescriptions, stock & complex care ═════════════
add({ id: 'S51', difficulty: 5, title: 'Valid metformin prescription', patient: { gender: 'F', age: 54 }, gesture: 'none', budget: 200,
  complaint: 'I\'ve been newly diagnosed with type 2 diabetes. Here is my prescription.',
  prescription: { drug: 'Metformin 500 mg tablets', directions: '1 tablet twice daily with meals', doctor: 'Dr. S. Iyer (Demo Clinic)', daysAgo: 2, valid: true, baseKey: 'metformin', tag: 'immediate_release' },
  answers: {
    duration: 'Diagnosed this week.',
    symptoms: 'I feel fine now.',
    allergies: 'No allergies.', meds: 'No other medicines.', history: 'Type 2 diabetes. My doctor checked my kidney function.', lifestyle: 'I\'m starting to exercise more.' },
  facts: [], correct: { type: 'dispense', accept: ['metformin+immediate_release'] }, keyQuestions: ['allergies', 'meds'],
  seeDoctor: 'if you have persistent vomiting, severe stomach upset, or feel very unwell',
  learning: 'For a valid prescription: verify the patient, prescriber, date, drug, strength and directions; check allergies and interactions, then counsel (metformin is taken with meals to reduce stomach upset).' });

add({ id: 'S52', difficulty: 5, title: 'Requested brand out of stock', patient: { gender: 'M', age: 36 }, gesture: 'sneeze', budget: 120,
  complaint: 'Can I get {BRAND}? It\'s for my hay fever.',
  request: { baseKey: 'cetirizine', strength: '10 mg' },
  answers: {
    duration: 'Hay fever season — a few days.',
    symptoms: 'Sneezing, runny nose. No wheeze.',
    allergies: 'None.', meds: 'None.', history: 'Only hay fever.', lifestyle: 'I take the bus to work.' },
  facts: [], correct: { type: 'dispense', accept: ['cetirizine+tablet_10mg'] }, alsoOk: { type: 'dispense', accept: ['non_sedating'] }, keyQuestions: ['meds'],
  seeDoctor: 'if you develop wheezing or breathlessness',
  learning: 'When a requested brand is out of stock, a generic alternative with the same active ingredient, strength and dosage form can usually be offered (in line with local rules), explaining it to the customer.' });

add({ id: 'S53', difficulty: 5, title: 'Elderly customer — multiple medicines', patient: { gender: 'F', age: 71 }, gesture: 'sneeze', budget: 200,
  complaint: 'I have a cold. Give me your strongest cold and flu tablets.',
  answers: {
    duration: 'Three days.',
    symptoms: 'Blocked nose, aches, mild temperature. No breathlessness or chest pain.',
    allergies: 'None.',
    meds: 'Amlodipine, metformin and atorvastatin.',
    history: 'High blood pressure and type 2 diabetes.', lifestyle: 'I live alone.' },
  facts: ['cond:hypertension', 'med:antihypertensive', 'cond:diabetes', 'age:elderly'], correct: { type: 'dispense', accept: ['paracetamol', 'saline', 'steam_inhalation'] }, keyQuestions: ['meds', 'history'],
  seeDoctor: 'if you become breathless, develop chest pain or confusion, or don\'t improve within a week',
  learning: 'Combination cold products often contain decongestants (raise blood pressure) and sedating antihistamines (falls risk in older adults). Choose single-ingredient options matched to symptoms.' });

add({ id: 'S54', difficulty: 5, title: 'Out-of-date prescription', patient: { gender: 'M', age: 45 }, gesture: 'none', budget: 200,
  complaint: 'Can you fill this prescription? I didn\'t get it filled before.',
  prescription: { drug: 'Amoxicillin 500 mg capsules', directions: '1 capsule three times daily for 7 days', doctor: 'Dr. P. Menon (Demo Clinic)', daysAgo: 270, valid: false, issue: 'Dated about 9 months ago — beyond a typical validity period', baseKey: 'amoxicillin' },
  answers: {
    duration: 'The prescription is from earlier this year.',
    symptoms: 'I have a sore throat again now.',
    allergies: 'No allergies.', meds: 'None.', history: 'Healthy.', lifestyle: 'Engineer.' },
  facts: [], correct: { type: 'refer', urgency: 'doctor' }, keyQuestions: ['symptoms'],
  adviceOptions: [
    { text: 'This prescription is out of date and was written for a past illness. I can\'t dispense it — please see your doctor so your current symptoms can be assessed.', correct: true },
    { text: 'I\'ll dispense it since the drug name is still correct.' },
    { text: 'Take the antibiotics for just three days instead.' },
  ],
  learning: 'Prescriptions have a validity period and are written for a specific clinical situation. Out-of-date prescriptions must not be dispensed; refer to the prescriber.' });

add({ id: 'S55', difficulty: 5, title: 'Breathless smoker wants cough syrup', patient: { gender: 'M', age: 66 }, gesture: 'cough', budget: 200,
  complaint: 'My cough syrup isn\'t working. I need something stronger.',
  answers: {
    duration: 'Two weeks — getting worse.',
    symptoms: 'I\'m more breathless than usual, my ankles are swollen, and I have to sleep propped up on pillows.',
    allergies: 'None.', meds: 'Blood pressure tablets.', history: 'High blood pressure, heart attack 5 years ago.', lifestyle: 'Ex-smoker.' },
  facts: ['cond:hypertension'], correct: { type: 'refer', urgency: 'doctor' }, keyQuestions: ['symptoms', 'history'],
  adviceOptions: [
    { text: 'Breathlessness, ankle swelling and needing extra pillows with your heart history need a doctor\'s assessment today — a cough syrup won\'t treat the cause.', correct: true },
    { text: 'Here\'s a stronger cough syrup — use it for another week.' },
    { text: 'Drink more water and lie flat to rest.' },
  ],
  learning: 'A cough with breathlessness, orthopnoea (needing to sleep propped up) and ankle swelling in someone with heart disease may indicate heart failure — refer promptly.' });

add({ id: 'S56', difficulty: 5, title: 'Valid prescription — check interactions', patient: { gender: 'F', age: 62 }, gesture: 'none', budget: 200,
  complaint: 'My doctor started me on a cholesterol tablet. Here\'s the prescription.',
  prescription: { drug: 'Atorvastatin 10 mg tablets', directions: '1 tablet daily', doctor: 'Dr. K. Bose (Demo Clinic)', daysAgo: 3, valid: true, baseKey: 'atorvastatin' },
  answers: {
    duration: 'Diagnosed last week.',
    symptoms: 'No symptoms.',
    allergies: 'None.', meds: 'Amlodipine for blood pressure.', history: 'High blood pressure. Not pregnant.', lifestyle: 'I drink grapefruit juice every morning.' },
  facts: ['med:antihypertensive'], correct: { type: 'dispense', accept: ['atorvastatin'] }, keyQuestions: ['meds', 'lifestyle'],
  seeDoctor: 'if you get unexplained muscle pain, tenderness or weakness — and avoid large amounts of grapefruit juice',
  learning: 'Dispense valid prescriptions after checks, and counsel: report unexplained muscle pain; avoid large quantities of grapefruit juice with atorvastatin.' });

export const SCENARIOS = S;

// Symptom guide for SMART SEARCH (educational candidate categories)
export const SYMPTOM_GUIDE = [
  { k: ['headache', 'head ache', 'migraine', 'my head'], title: 'Headache', cats: [
    { name: 'Simple analgesics (e.g., paracetamol, ibuprofen)', why: 'May relieve mild tension-type headache if suitable for the person.', q: 'paracetamol' }],
    refer: 'Sudden "worst ever" headache, stiff neck, confusion, weakness, head injury, visual disturbance, headache in pregnancy with swelling, or new headache over 50.' },
  { k: ['fever', 'temperature', 'pyrexia'], title: 'Fever', cats: [
    { name: 'Antipyretic analgesics (paracetamol, ibuprofen)', why: 'Can reduce fever and discomfort; choose age-appropriate formulations.', q: 'paracetamol' },
    { name: 'Thermometers', why: 'To monitor temperature accurately.', q: 'thermometer' }],
    refer: 'Infant under 3 months with ≥38 °C, fever > 3 days, non-blanching rash, breathing difficulty, stiff neck, drowsiness, or dehydration.' },
  { k: ['sore throat', 'throat'], title: 'Sore throat', cats: [
    { name: 'Throat lozenges / sprays', why: 'May soothe throat discomfort temporarily.', q: 'sore throat' },
    { name: 'Simple analgesics', why: 'May ease pain and fever if suitable.', q: 'paracetamol' }],
    refer: 'Difficulty swallowing or breathing, drooling, high fever, symptoms > 1 week, or immunocompromised.' },
  { k: ['dry cough', 'tickly cough'], title: 'Dry cough', cats: [
    { name: 'Cough suppressants (e.g., dextromethorphan)', why: 'Considered for short-term dry cough in adults.', q: 'dextromethorphan' },
    { name: 'Soothing linctus (glycerin/honey)', why: 'Demulcent; can soothe an irritated throat.', q: 'linctus' }],
    refer: 'Cough > 3 weeks, blood in phlegm, breathlessness, chest pain, weight loss, night sweats.' },
  { k: ['chesty cough', 'productive cough', 'phlegm', 'mucus'], title: 'Chesty cough', cats: [
    { name: 'Expectorants (e.g., guaifenesin)', why: 'May help loosen mucus.', q: 'guaifenesin' }],
    refer: 'Green/bloody sputum with fever, breathlessness, chest pain, cough > 3 weeks.' },
  { k: ['cough'], title: 'Cough', cats: [
    { name: 'Dry cough products', why: 'Suppressants/demulcents for non-productive cough.', q: 'dry cough' },
    { name: 'Chesty cough products', why: 'Expectorants for productive cough.', q: 'chesty cough' }],
    refer: 'Cough > 3 weeks, blood, breathlessness, chest pain, weight loss, night sweats.' },
  { k: ['blocked nose', 'nasal congestion', 'stuffy nose', 'sinus'], title: 'Nasal congestion', cats: [
    { name: 'Saline sprays/drops', why: 'Gentle; suitable for most people.', q: 'saline' },
    { name: 'Topical decongestants', why: 'Short-term (≤ 7 days) use only.', q: 'xylometazoline' },
    { name: 'Steam inhalation (menthol/eucalyptus)', why: 'May relieve the feeling of congestion.', q: 'menthol' }],
    refer: 'Symptoms > 10 days, severe facial pain, high fever. Oral decongestants: avoid in high blood pressure.' },
  { k: ['runny nose', 'sneezing', 'hay fever', 'allergy', 'itchy eyes'], title: 'Allergic rhinitis (hay fever)', cats: [
    { name: 'Low-sedating antihistamines (cetirizine, loratadine, fexofenadine)', why: 'Commonly used for hay fever; less drowsiness.', q: 'non-sedating' },
    { name: 'Sedating antihistamines', why: 'Cause drowsiness — avoid when driving.', q: 'chlorphenamine' }],
    refer: 'Wheeze, breathlessness, or no improvement with treatment.' },
  { k: ['heartburn', 'acidity', 'indigestion', 'acid reflux'], title: 'Heartburn / indigestion', cats: [
    { name: 'Antacids', why: 'Neutralise stomach acid for quick relief.', q: 'antacid' },
    { name: 'Alginates', why: 'Form a protective raft over stomach contents.', q: 'alginate' },
    { name: 'Acid reducers (H2 blockers, PPIs)', why: 'Short-term reduction of acid production.', q: 'famotidine' }],
    refer: 'Chest pain spreading to arm/jaw, difficulty swallowing, weight loss, vomiting blood, black stools, age > 55 with new symptoms.' },
  { k: ['diarrhoea', 'diarrhea', 'loose motions'], title: 'Diarrhoea', cats: [
    { name: 'Oral rehydration salts (ORS)', why: 'Replaces fluids and electrolytes — first priority.', q: 'ors' },
    { name: 'Antimotility (loperamide) — adults only', why: 'Short-term symptom relief if no blood or fever.', q: 'loperamide' }],
    refer: 'Blood in stool, high fever, signs of dehydration, infants/elderly, > 48 hours, recent travel with severe symptoms.' },
  { k: ['constipation', 'pass stools', 'hard stools'], title: 'Constipation', cats: [
    { name: 'Bulk-forming laxatives (ispaghula)', why: 'Increase stool bulk; take with water.', q: 'ispaghula' },
    { name: 'Osmotic laxatives (lactulose)', why: 'Soften stools.', q: 'lactulose' }],
    refer: 'Blood in stool, weight loss, severe pain, change in bowel habit > 2 weeks, age > 50 with new symptoms.' },
  { k: ['cut', 'wound', 'graze', 'scrape', 'scraped'], title: 'Minor cuts & grazes', cats: [
    { name: 'Antiseptics', why: 'Clean the wound to reduce infection risk.', q: 'antiseptic' },
    { name: 'Plasters & dressings', why: 'Protect the wound.', q: 'plaster' }],
    refer: 'Deep or gaping wounds, uncontrolled bleeding, animal bites, numbness, signs of infection.' },
  { k: ['burn', 'scald'], title: 'Minor burns', cats: [
    { name: 'Burn dressings / hydrogels', why: 'Cover after cooling the burn for ~20 minutes under cool running water.', q: 'burn' }],
    refer: 'Large, deep, facial, hand, genital, electrical or chemical burns; burns in young children.' },
  { k: ['sprain', 'strain', 'strained', 'twisted', 'ankle', 'knee', 'muscle pain', 'back pain'], title: 'Sprains & muscle pain', cats: [
    { name: 'Topical NSAIDs', why: 'Local pain relief if no NSAID contraindications.', q: 'diclofenac' },
    { name: 'Support bandages & cold packs', why: 'Compression and cooling.', q: 'crepe' }],
    refer: 'Cannot bear weight, deformity, severe swelling, numbness, back pain with leg weakness or bladder problems.' },
  { k: ['athlete\'s foot', 'fungal', 'ringworm', 'between my toes'], title: 'Fungal skin infection', cats: [
    { name: 'Topical antifungals', why: 'E.g., clotrimazole, terbinafine.', q: 'antifungal' }],
    refer: 'Nail involvement, widespread infection, diabetes, no improvement after 2 weeks.' },
  { k: ['itch', 'itching', 'insect bite', 'rash', 'stung', 'sting'], title: 'Itching & bites', cats: [
    { name: 'Calamine / soothing lotions', why: 'Soothe itchy skin.', q: 'calamine' },
    { name: 'Mild hydrocortisone', why: 'Short-term for inflammation (not on face/infected skin).', q: 'hydrocortisone' },
    { name: 'Antihistamines', why: 'May reduce itching.', q: 'cetirizine' }],
    refer: 'Swelling of lips/throat or breathing difficulty (emergency), spreading redness, fever.' },
  { k: ['sunburn', 'sunburnt'], title: 'Sunburn', cats: [
    { name: 'After-sun / calamine', why: 'Cooling and soothing.', q: 'sunburn' }],
    refer: 'Extensive blistering, fever, chills, dizziness or confusion.' },
  { k: ['mouth ulcer', 'canker', 'ulcer inside my mouth'], title: 'Mouth ulcers', cats: [
    { name: 'Antiseptic mouthwash / local anaesthetic gel', why: 'Ease pain and keep area clean.', q: 'mouth ulcer' }],
    refer: 'Ulcer > 3 weeks, unexplained recurrent ulcers, painless or unusual ulcers.' },
  { k: ['head lice', 'lice', 'nits'], title: 'Head lice', cats: [
    { name: 'Head-lice lotions (dimeticone, permethrin)', why: 'Applied as directed, repeated after 7 days.', q: 'head lice' }],
    refer: 'Infected scalp, treatment failure.' },
  { k: ['nappy rash', 'diaper rash'], title: 'Nappy rash', cats: [
    { name: 'Barrier creams (zinc oxide)', why: 'Protect skin from moisture.', q: 'zinc oxide' }],
    refer: 'Severe, blistered or spreading rash, or fever.' },
  { k: ['acne', 'pimples'], title: 'Acne', cats: [{ name: 'Benzoyl peroxide gels', why: 'For mild to moderate acne.', q: 'benzoyl' }], refer: 'Severe, cystic or scarring acne.' },
  { k: ['dry eyes', 'gritty eyes', 'gritty'], title: 'Dry eyes', cats: [{ name: 'Lubricant eye drops', why: 'Artificial tears.', q: 'lubricant' }], refer: 'Pain, light sensitivity, reduced vision, contact-lens wearers with red eye.' },
  { k: ['ear wax', 'blocked ear', 'wax'], title: 'Ear wax', cats: [{ name: 'Ear-wax softening drops', why: 'Soften wax.', q: 'ear wax' }], refer: 'Ear pain, discharge, dizziness, possible perforation.' },
  { k: ['travel sickness', 'motion sickness', 'travel sick'], title: 'Travel sickness', cats: [{ name: 'Antihistamines for motion sickness', why: 'Taken before travel; cause drowsiness.', q: 'travel' }], refer: 'Persistent vomiting.' },
  { k: ['dry skin', 'eczema', 'cracked skin', 'cracked'], title: 'Dry skin', cats: [{ name: 'Emollients', why: 'Moisturise and protect.', q: 'emollient' }], refer: 'Infected (weeping/crusted) skin, widespread eczema not controlled.' },
  { k: ['smoking', 'quit smoking'], title: 'Stopping smoking', cats: [{ name: 'Nicotine replacement therapy', why: 'Reduces cravings and withdrawal.', q: 'nicotine' }], refer: 'Recent heart attack/stroke, pregnancy — seek advice.' },
  { k: ['worms', 'threadworm'], title: 'Threadworm', cats: [{ name: 'Anthelmintics', why: 'E.g., mebendazole with hygiene measures.', q: 'mebendazole' }], refer: 'Children under 2, pregnancy, persistent symptoms.' },
  { k: ['toothache'], title: 'Toothache', cats: [{ name: 'Simple analgesics', why: 'Short-term until dental review.', q: 'paracetamol' }], refer: 'Dentist for all toothache; urgently for facial swelling, fever or difficulty swallowing.' },
  { k: ['insomnia', 'sleep'], title: 'Sleep problems', cats: [{ name: 'Sleep hygiene advice', why: 'First-line for most people.', q: '' }, { name: 'Short-term sedating antihistamines (adults)', why: 'Not for older adults; short term only.', q: 'diphenhydramine' }], refer: 'Persistent insomnia, low mood, sleep apnoea symptoms.' },
  { k: ['chest pain'], title: 'Chest pain', cats: [], refer: 'EMERGENCY: chest pain, especially spreading to arm/jaw with sweating, nausea or breathlessness — call emergency services.' },
  { k: ['breathless', 'shortness of breath', 'wheeze', 'catch my breath', 'cant breathe'], title: 'Breathlessness', cats: [], refer: 'Breathlessness, wheeze not relieved by inhaler, or inability to complete sentences — urgent medical/emergency care.' },
  // Added for stock suggestions — Tamil text is inline (`ta`) because ta/misc.json is index-matched.
  { k: ['common cold', 'cold', 'flu'], title: 'Common cold', cats: [
    { name: 'Cold combinations (paracetamol + phenylephrine + chlorphenamine)', why: 'Short-term relief of several cold symptoms. Check blood pressure, driving, and other paracetamol products.', q: 'phenylephrine' },
    { name: 'Saline nasal spray / drops', why: 'Gentle and suitable for most people, including children.', q: 'saline' },
    { name: 'Steam inhalation', why: 'May ease the blocked feeling.', q: 'menthol' }],
    refer: 'Symptoms > 10 days, high fever, breathlessness, ear pain, chest pain, or a very unwell child.',
    ta: { title: 'சளி / ஜலதோஷம்', keywords: ['ஜலதோஷம்', 'சளி பிடித்து', 'ஃப்ளூ', 'சளி'], cats: [
      { name: 'சளி மருந்து கலவைகள் (பாராசிட்டமால் + ஃபினைலெஃப்ரின் + குளோர்பெனிரமின்)', why: 'பல சளி அறிகுறிகளுக்குக் குறுகிய கால நிவாரணம். இரத்த அழுத்தம், வாகனம் ஓட்டுதல், வேறு பாராசிட்டமால் மருந்துகளைச் சரிபார்க்கவும்.' },
      { name: 'உப்பு நீர் (சலைன்) மூக்கு ஸ்ப்ரே / சொட்டு', why: 'மென்மையானது; குழந்தைகள் உட்படப் பெரும்பாலானோருக்கு ஏற்றது.' },
      { name: 'ஆவி பிடித்தல்', why: 'மூக்கடைப்பு உணர்வைக் குறைக்கலாம்.' }],
      refer: '10 நாட்களுக்கு மேல் அறிகுறிகள், அதிக காய்ச்சல், மூச்சுத் திணறல், காது வலி, நெஞ்சு வலி, அல்லது மிகவும் சோர்வான குழந்தை.' } },
  { k: ['body ache', 'body pain', 'period pain', 'period cramps', 'menstrual pain'], title: 'Body ache / period pain', cats: [
    { name: 'Paracetamol', why: 'First choice for most people, including in pregnancy (as advised).', q: 'paracetamol' },
    { name: 'Ibuprofen (NSAID)', why: 'Helps period cramps; avoid with ulcers, NSAID-sensitive asthma, kidney disease, blood thinners or pregnancy.', q: 'ibuprofen' }],
    refer: 'Severe or unusual pain, very heavy bleeding, pain with high fever, or pain that keeps coming back.',
    ta: { title: 'உடல் வலி / மாதவிடாய் வலி', keywords: ['உடல் வலி', 'கை கால் வலி', 'மாதவிடாய் வலி', 'பீரியட்ஸ் வலி'], cats: [
      { name: 'பாராசிட்டமால்', why: 'பெரும்பாலானோருக்கு முதல் தேர்வு; கர்ப்ப காலத்திலும் (ஆலோசனைப்படி).' },
      { name: 'இப்யூபுரூஃபன் (NSAID)', why: 'மாதவிடாய் வலிக்கு உதவும்; அல்சர், NSAID ஆஸ்துமா, சிறுநீரக நோய், இரத்தம் உறையாமைக்கான மருந்து அல்லது கர்ப்பம் இருந்தால் தவிர்க்கவும்.' }],
      refer: 'கடுமையான அல்லது வழக்கத்துக்கு மாறான வலி, அதிக இரத்தப்போக்கு, அதிக காய்ச்சலுடன் வலி, அல்லது திரும்பத் திரும்ப வரும் வலி.' } },
  { k: ['vomiting', 'vomit', 'nausea', 'throwing up'], title: 'Vomiting / nausea', cats: [
    { name: 'Oral rehydration salts (ORS)', why: 'Small, frequent sips replace lost fluids — first priority.', q: 'ors' },
    { name: 'Anti-sickness tablets (ondansetron) — prescription only', why: 'Only on a doctor\'s prescription.', q: 'ondansetron' }],
    refer: 'Blood in vomit, severe tummy pain, signs of dehydration, vomiting > 24 hours (sooner in babies/elderly), head injury, or pregnancy.',
    ta: { title: 'வாந்தி / குமட்டல்', keywords: ['வாந்தி', 'குமட்டல்', 'ஓக்காளம்'], cats: [
      { name: 'வாய்வழி நீரேற்ற உப்புகள் (ORS)', why: 'சிறிது சிறிதாக அடிக்கடி குடித்தால் இழந்த நீர் ஈடுசெய்யப்படும் — இதுவே முதன்மை.' },
      { name: 'வாந்தி நிறுத்தும் மாத்திரை (ஒன்டான்செட்ரான்) — மருந்துச்சீட்டு மட்டும்', why: 'மருத்துவரின் மருந்துச்சீட்டு இருந்தால் மட்டுமே.' }],
      refer: 'வாந்தியில் இரத்தம், கடும் வயிற்று வலி, நீரிழப்பு அறிகுறிகள், 24 மணி நேரத்துக்கு மேல் வாந்தி (கைக்குழந்தை/முதியோரில் விரைவில்), தலைக் காயம், அல்லது கர்ப்பம்.' } },
  { k: ['gas', 'bloating', 'bloated', 'flatulence'], title: 'Gas / bloating', cats: [
    { name: 'Simethicone (anti-gas)', why: 'Breaks up gas bubbles.', q: 'simethicone' },
    { name: 'Antacids', why: 'If there is acidity with the bloating.', q: 'antacid' }],
    refer: 'Severe or persistent pain, weight loss, vomiting, blood in stool, or age > 55 with new symptoms.',
    ta: { title: 'வாயு / வயிறு உப்புசம்', keywords: ['வாயு', 'வயிறு உப்புசம்', 'வயிற்று உப்புசம்', 'கேஸ்'], cats: [
      { name: 'சிமெத்திகோன் (வாயு நீக்கி)', why: 'வாயுக் குமிழ்களை உடைக்கும்.' },
      { name: 'அமில நீக்கிகள் (ஆன்டாசிட்)', why: 'உப்புசத்துடன் அசிடிட்டியும் இருந்தால்.' }],
      refer: 'கடுமையான அல்லது தொடர்ந்த வலி, எடை குறைதல், வாந்தி, மலத்தில் இரத்தம், அல்லது 55 வயதுக்கு மேல் புதிய அறிகுறிகள்.' } },
];

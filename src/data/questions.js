// ─────────────────────────────────────────────────────────────────────────────
// RxShift — Inspection question bank (predefined, curated)
// Each question: q, options[4], a (index of correct option), m (module), x (explanation)
// The inspection draws 20 at random (balanced across modules) and shuffles options.
// ─────────────────────────────────────────────────────────────────────────────

export const MODULES = [
  { id: 'pain', title: 'Pain & Fever', icon: 'thermo', facts: [
    'Paracetamol relieves pain and reduces fever; it has little anti-inflammatory effect.',
    'Paracetamol overdose can cause serious liver damage, sometimes with few early symptoms — urgent help is needed even if the person feels well.',
    'Many combination cold & flu products contain paracetamol — check for duplicate ingredients.',
    'Ibuprofen, naproxen and aspirin are NSAIDs: take with food; avoid with stomach ulcers, NSAID allergy or NSAID-sensitive asthma.',
    'Aspirin must not be given to children and teenagers under 16 (risk of Reye\'s syndrome).',
    'Fever is commonly defined as a temperature of 38 °C (100.4 °F) or higher.',
  ] },
  { id: 'allergy', title: 'Allergy & Antihistamines', icon: 'flower', facts: [
    'Second-generation antihistamines (cetirizine, loratadine, fexofenadine) cause less drowsiness than first-generation ones.',
    'First-generation antihistamines (chlorphenamine, diphenhydramine) cause drowsiness — counsel about driving and alcohol.',
    'Sedating antihistamines have anticholinergic effects: caution in glaucoma, prostate enlargement and older adults.',
    'Swelling of the lips or throat, or difficulty breathing after exposure to an allergen, may be anaphylaxis — call emergency services.',
  ] },
  { id: 'gi', title: 'Digestive Health', icon: 'stomach', facts: [
    'Antacids neutralise stomach acid; separate them from other medicines by about 2 hours.',
    'Proton pump inhibitors (e.g., omeprazole) reduce acid production.',
    'ORS replaces fluids and electrolytes — the priority in acute diarrhoea.',
    'Loperamide is for short-term acute diarrhoea in adults; avoid if there is blood in the stool or fever.',
    'Bulk-forming laxatives (ispaghula) must be taken with plenty of water.',
    'Alarm symptoms with indigestion: difficulty swallowing, weight loss, vomiting blood, black stools.',
  ] },
  { id: 'resp', title: 'Cough, Cold & Throat', icon: 'lungs', facts: [
    'Antibiotics do not work against viral infections like the common cold.',
    'Dextromethorphan is a cough suppressant for dry cough; guaifenesin is an expectorant for chesty cough.',
    'Topical nasal decongestants should not be used for more than about 7 days (rebound congestion).',
    'Oral decongestants can raise blood pressure — avoid in uncontrolled hypertension.',
    'A cough lasting more than about 3 weeks, or with blood, weight loss or night sweats, needs medical evaluation.',
    'Salbutamol is a short-acting "reliever" inhaler; a spacer can improve delivery from a metered-dose inhaler.',
  ] },
  { id: 'skin', title: 'Skin & First Aid', icon: 'bandage', facts: [
    'Cool a minor burn under cool running water for about 20 minutes; do not apply ice, butter or toothpaste.',
    'Clotrimazole and terbinafine are topical antifungals used for athlete\'s foot.',
    'Hydrocortisone 1% is a mild topical steroid for short-term use — not on broken or infected skin.',
    'SPF mainly indicates protection against UVB rays; reapply sunscreen about every 2 hours.',
    'Paraffin-based emollients soaked into fabric are a fire hazard.',
    'Permethrin is used for scabies; dimeticone and permethrin lotions are used for head lice.',
  ] },
  { id: 'special', title: 'Children, Pregnancy & Older Adults', icon: 'family', facts: [
    'Infants under 3 months with a temperature of 38 °C or more need urgent medical assessment.',
    'Paediatric doses are based on age and/or weight as on the label.',
    'NSAIDs are generally avoided in pregnancy unless prescribed; paracetamol is usually preferred for pain.',
    'Folic acid is recommended before conception and in early pregnancy to reduce the risk of neural tube defects.',
    'Older adults are more sensitive to sedating medicines (falls, confusion).',
    'Honey should not be given to infants under 1 year old.',
  ] },
  { id: 'interact', title: 'Interactions & Contraindications', icon: 'link', facts: [
    'NSAIDs and aspirin increase bleeding risk with warfarin.',
    'NSAIDs can increase lithium levels, risking toxicity.',
    'Avoid alcohol with metronidazole (risk of a severe reaction).',
    'Antacids, calcium and iron reduce absorption of ciprofloxacin and tetracyclines — separate doses.',
    'Amoxicillin is a penicillin — contraindicated in penicillin allergy.',
    'Dextromethorphan and decongestants interact dangerously with MAO inhibitors.',
  ] },
  { id: 'redflags', title: 'Red Flags & Referral', icon: 'flag', facts: [
    'Chest pain spreading to the arm or jaw with sweating or nausea: call emergency services.',
    'Sudden "worst ever" headache with stiff neck or vomiting: emergency.',
    'Bloody diarrhoea or high fever with diarrhoea: refer.',
    'Mouth ulcer lasting more than 3 weeks: refer.',
    'A changing, bleeding mole: refer for assessment.',
    'Painful red eye with reduced vision or light sensitivity: urgent eye assessment.',
  ] },
  { id: 'storage', title: 'Storage, Cold Chain & Compliance', icon: 'snow', facts: [
    'Refrigerated medicines (e.g., insulin, vaccines) are stored at 2–8 °C and must not be frozen.',
    'A fridge temperature excursion must be recorded, affected stock quarantined, and the excursion procedure followed.',
    'FEFO = First Expiry, First Out.',
    'Expired medicines must be removed from saleable stock, quarantined and disposed of properly.',
    'Prescription-only medicines must only be supplied against a valid prescription.',
    'Look-alike / sound-alike medicines increase selection errors — double-check every item.',
    'Suspected adverse drug reactions should be reported to the pharmacovigilance system.',
  ] },
  { id: 'devices', title: 'Devices & Monitoring', icon: 'device', facts: [
    'Measure blood pressure seated after 5 minutes\' rest, back supported, arm at heart level, with the right cuff size.',
    'Glucose test strips must be kept in their original container, tightly closed.',
    'Lancets are single-use and should go into a sharps container.',
    'Clean thermometer tips before and after each use.',
    'Pulse oximeter readings can be affected by cold fingers, movement and nail polish.',
  ] },
];

const Q = [];
const q = (m, text, options, a, x) => Q.push({ id: 'Q' + String(Q.length + 1).padStart(3, '0'), m, q: text, options, a, x });

// ── Pain & Fever
q('pain', 'What is the main educational use of paracetamol?', ['Relief of mild-to-moderate pain and fever', 'Treating bacterial infections', 'Lowering blood pressure', 'Reducing stomach acid'], 0, 'Paracetamol is an analgesic and antipyretic.');
q('pain', 'Which organ is most at risk from paracetamol overdose?', ['Liver', 'Lungs', 'Skin', 'Eyes'], 0, 'Paracetamol overdose can cause severe liver damage.');
q('pain', 'Ibuprofen belongs to which class of medicines?', ['NSAIDs', 'Antibiotics', 'Antihistamines', 'Proton pump inhibitors'], 0, 'Ibuprofen is a non-steroidal anti-inflammatory drug.');
q('pain', 'Why is aspirin avoided in children and teenagers under 16?', ['Risk of Reye\'s syndrome', 'It is ineffective in children', 'It causes drowsiness', 'It stains teeth'], 0, 'Aspirin in under-16s is linked to Reye\'s syndrome.');
q('pain', 'A customer takes a cold & flu tablet containing paracetamol and asks for extra paracetamol. What is the main risk?', ['Accidental overdose from duplicate ingredients', 'Antibiotic resistance', 'Low blood sugar', 'Rebound congestion'], 0, 'Duplicate paracetamol is a common cause of accidental overdose.');
q('pain', 'NSAIDs such as ibuprofen are best taken:', ['With or after food', 'Only on an empty stomach', 'With alcohol', 'Crushed into eye drops'], 0, 'Taking NSAIDs with food reduces stomach irritation.');
q('pain', 'A temperature commonly regarded as a fever is:', ['38 °C (100.4 °F) or higher', '35 °C or higher', '36.5 °C exactly', '34 °C or lower'], 0, 'Fever is commonly defined as ≥ 38 °C.');

// ── Allergy
q('allergy', 'Which antihistamine is classed as second-generation (low-sedating)?', ['Cetirizine', 'Chlorphenamine', 'Diphenhydramine', 'Dimenhydrinate'], 0, 'Cetirizine is a second-generation antihistamine.');
q('allergy', 'The most common side effect of first-generation antihistamines like chlorphenamine is:', ['Drowsiness', 'Hair growth', 'High blood sugar', 'Tooth staining'], 0, 'First-generation antihistamines are sedating.');
q('allergy', 'A professional driver with hay fever should preferably be offered:', ['A low-sedating antihistamine', 'A sedating antihistamine at night and day', 'An oral antibiotic', 'A sleeping aid'], 0, 'Sedating antihistamines impair driving.');
q('allergy', 'Lip swelling and difficulty breathing minutes after a bee sting suggest:', ['Anaphylaxis — call emergency services', 'Mild irritation — apply calamine', 'Sunburn', 'A fungal infection'], 0, 'These are signs of a severe allergic reaction.');
q('allergy', 'Sedating antihistamines should be used with caution in people with:', ['Glaucoma or prostate enlargement', 'Dry skin', 'Hay fever', 'Short-sightedness'], 0, 'Anticholinergic effects can worsen glaucoma and urinary retention.');

// ── GI
q('gi', 'How do antacids relieve heartburn?', ['They neutralise stomach acid', 'They kill bacteria', 'They numb the throat', 'They increase acid production'], 0, 'Antacids neutralise existing stomach acid.');
q('gi', 'Omeprazole belongs to which class?', ['Proton pump inhibitor', 'Antihistamine', 'NSAID', 'Laxative'], 0, 'Omeprazole is a PPI that reduces acid production.');
q('gi', 'What is the first priority in managing acute diarrhoea?', ['Replacing fluids and electrolytes (ORS)', 'Starting antibiotics', 'Stopping all food and drink', 'Taking a laxative'], 0, 'ORS prevents and treats dehydration.');
q('gi', 'Loperamide should NOT be used when diarrhoea is accompanied by:', ['Blood in the stool or high fever', 'Mild cramps', 'Recent spicy food', 'Feeling tired'], 0, 'These are red flags needing referral.');
q('gi', 'Ispaghula husk (psyllium) must be taken with:', ['Plenty of water', 'Alcohol', 'Nothing at all', 'Antacids only'], 0, 'Bulk-forming laxatives need adequate fluid.');
q('gi', 'Which symptom with heartburn requires referral to a doctor?', ['Difficulty swallowing with weight loss', 'Burning after a spicy meal', 'Occasional bloating', 'Mild burping'], 0, 'Dysphagia and weight loss are alarm symptoms.');
q('gi', 'Why should antacids be separated from other medicines by about 2 hours?', ['They can reduce absorption of other medicines', 'They make other medicines toxic', 'They cause drowsiness', 'They raise blood pressure'], 0, 'Antacids can bind or affect absorption of some drugs.');

// ── Respiratory
q('resp', 'Antibiotics are NOT effective against:', ['Viral infections like the common cold', 'Certain bacterial infections', 'Bacterial skin infections', 'Bacterial urinary infections'], 0, 'Antibiotics act on bacteria, not viruses.');
q('resp', 'Dextromethorphan is used for:', ['Dry, non-productive cough', 'Chesty cough with mucus', 'Diarrhoea', 'Fungal infections'], 0, 'It is a cough suppressant.');
q('resp', 'Guaifenesin is classed as:', ['An expectorant', 'An antihistamine', 'A decongestant', 'An antacid'], 0, 'Guaifenesin helps loosen mucus.');
q('resp', 'Prolonged use of xylometazoline nasal spray (more than about 7 days) can cause:', ['Rebound congestion', 'Liver damage', 'Hair loss', 'Low blood sugar'], 0, 'Known as rhinitis medicamentosa.');
q('resp', 'Oral decongestants such as pseudoephedrine should be avoided in:', ['Uncontrolled high blood pressure', 'Dry skin', 'Mild acne', 'Athlete\'s foot'], 0, 'They can raise blood pressure.');
q('resp', 'Salbutamol inhalers are classed as:', ['Short-acting bronchodilators (relievers)', 'Antibiotics', 'Antihistamines', 'Cough suppressants'], 0, 'Salbutamol relieves bronchospasm quickly.');
q('resp', 'A spacer used with a metered-dose inhaler:', ['Improves delivery of medicine to the lungs', 'Replaces the need for medicine', 'Is only for nebulisers', 'Increases side effects'], 0, 'Spacers reduce coordination problems and throat deposition.');
q('resp', 'A cough lasting more than about 3 weeks with weight loss and night sweats should be:', ['Referred for medical evaluation', 'Treated with more cough syrup', 'Ignored', 'Treated with antacids'], 0, 'This may indicate a serious cause such as TB.');

// ── Skin & first aid
q('skin', 'First aid for a minor burn is to cool it under cool running water for about:', ['20 minutes', '10 seconds', '1 minute', '2 hours with ice'], 0, 'About 20 minutes of cool running water is recommended.');
q('skin', 'Clotrimazole cream is mainly used for:', ['Fungal skin infections', 'Bacterial pneumonia', 'Acne scars', 'Sunburn'], 0, 'Clotrimazole is an antifungal.');
q('skin', 'Hydrocortisone 1% cream should NOT be applied to:', ['Broken or infected skin', 'Mild insect bite reactions', 'Mild irritant dermatitis', 'Small itchy patches on the arm'], 0, 'Steroids on infected/broken skin can worsen infection.');
q('skin', 'SPF on a sunscreen mainly measures protection against:', ['UVB radiation', 'Insect bites', 'Infrared heat', 'Fungal infection'], 0, 'SPF relates to UVB; look for UVA ratings too.');
q('skin', 'Which is a key safety warning for paraffin-based emollients?', ['Fire risk when soaked into fabric', 'They cause drowsiness', 'They raise blood pressure', 'They interact with warfarin'], 0, 'Fabric with paraffin residue can ignite easily.');
q('skin', 'Permethrin 5% cream is used to treat:', ['Scabies', 'Dandruff', 'Acne', 'Dry eyes'], 0, 'Permethrin 5% is a scabies treatment.');
q('skin', 'Povidone-iodine antiseptic should be avoided in people with:', ['Iodine sensitivity', 'Hay fever', 'Short hair', 'Mild constipation'], 0, 'Iodine allergy/sensitivity is a contraindication.');

// ── Special groups
q('special', 'A 2-month-old baby has a temperature of 38.4 °C. The correct action is:', ['Refer urgently to a doctor', 'Sell infant drops and wait 3 days', 'Give adult paracetamol', 'Advise a warm bath only'], 0, 'Infants under 3 months with fever need urgent assessment.');
q('special', 'Paediatric medicine doses are usually based on:', ['The child\'s age and/or weight', 'The parent\'s weight', 'The time of day', 'The price of the product'], 0, 'Follow age/weight dosing on the label.');
q('special', 'For mild pain in pregnancy, which is usually preferred over NSAIDs?', ['Paracetamol', 'High-dose aspirin', 'Ibuprofen', 'Naproxen'], 0, 'NSAIDs are generally avoided in pregnancy unless prescribed.');
q('special', 'Folic acid is recommended before and in early pregnancy to reduce the risk of:', ['Neural tube defects', 'Hay fever', 'Tooth decay', 'Sunburn'], 0, 'Folic acid lowers neural tube defect risk.');
q('special', 'Why are sedating antihistamine sleep aids generally not recommended for older adults?', ['Increased risk of confusion and falls', 'They are too expensive', 'They are ineffective in everyone', 'They cause hair loss'], 0, 'Anticholinergic and sedative effects increase falls risk.');
q('special', 'Honey-containing cough remedies should not be given to:', ['Infants under 1 year', 'Adults', 'Teenagers', 'Older adults'], 0, 'Honey carries a risk of infant botulism under 1 year.');

// ── Interactions
q('interact', 'A patient on warfarin asks for pain relief. Which should be avoided unless prescribed?', ['NSAIDs such as ibuprofen or aspirin', 'Saline nasal spray', 'Emollient cream', 'ORS'], 0, 'NSAIDs/aspirin increase bleeding risk with warfarin.');
q('interact', 'NSAIDs can increase blood levels of which medicine, risking toxicity?', ['Lithium', 'Vitamin C', 'Saline', 'Calamine'], 0, 'NSAIDs reduce lithium clearance.');
q('interact', 'Patients taking metronidazole should be advised to avoid:', ['Alcohol', 'Water', 'Bread', 'Sunlight entirely'], 0, 'Alcohol can cause a severe disulfiram-like reaction.');
q('interact', 'Ciprofloxacin absorption is reduced when taken together with:', ['Antacids, calcium or iron', 'Water', 'Paracetamol', 'Saline'], 0, 'Polyvalent cations bind fluoroquinolones.');
q('interact', 'A customer is allergic to penicillin. Which medicine must be avoided?', ['Amoxicillin', 'Azithromycin', 'Paracetamol', 'Cetirizine'], 0, 'Amoxicillin is a penicillin.');
q('interact', 'Dextromethorphan should not be used with which class of medicines?', ['MAO inhibitors', 'Emollients', 'Vitamins', 'ORS'], 0, 'Risk of serotonin toxicity.');
q('interact', 'Which product type is a concern for a customer with diabetes buying cough syrup?', ['Syrups containing sugar', 'Sugar-free syrups', 'Saline sprays', 'Thermometers'], 0, 'Choose sugar-free formulations where possible.');

// ── Red flags
q('redflags', 'A customer has chest pressure spreading to the left arm with sweating. What should the pharmacist do?', ['Call emergency services immediately', 'Sell an antacid', 'Advise rest for a week', 'Recommend a cough syrup'], 0, 'These may be signs of a heart attack.');
q('redflags', 'A sudden, "worst ever" headache with a stiff neck requires:', ['Emergency referral', 'Strong painkillers and rest', 'An antihistamine', 'A follow-up next month'], 0, 'This may indicate a serious condition such as a brain bleed or meningitis.');
q('redflags', 'A mouth ulcer that has lasted more than 3 weeks should be:', ['Referred to a doctor or dentist', 'Treated with more gel', 'Ignored', 'Covered with a plaster'], 0, 'Persistent ulcers need assessment.');
q('redflags', 'A mole that has changed shape and colour and has bled should be:', ['Referred for prompt medical assessment', 'Treated with hydrocortisone', 'Removed at home', 'Covered with sunscreen only'], 0, 'Possible skin cancer warning signs.');
q('redflags', 'A painful red eye with blurred vision and light sensitivity needs:', ['Urgent same-day eye assessment', 'Lubricant drops for a month', 'Antihistamine tablets', 'No action'], 0, 'These are red-eye red flags.');
q('redflags', 'An asthmatic who cannot complete sentences and whose reliever is not helping is:', ['A medical emergency', 'Suitable for cough syrup', 'Suitable for antihistamines', 'Fine to wait until tomorrow'], 0, 'Signs of a severe asthma attack.');
q('redflags', 'A person with diabetes has a foot wound that is not healing and looks red. The best action is:', ['Refer promptly to a doctor/foot clinic', 'Sell antiseptic and review in a month', 'Advise walking barefoot', 'Soak in very hot water'], 0, 'Diabetic foot wounds can deteriorate quickly.');

// ── Storage & compliance
q('storage', 'At what temperature range should unopened insulin and vaccines be stored?', ['2–8 °C (refrigerated, not frozen)', 'Below 0 °C (frozen)', '25–30 °C', '40 °C'], 0, 'Cold-chain products are stored at 2–8 °C.');
q('storage', 'The pharmacy fridge reads 14 °C. What should the pharmacist do first?', ['Record it, quarantine affected stock and follow the excursion procedure', 'Ignore it if it was short', 'Move all items to the freezer', 'Sell the items quickly at a discount'], 0, 'Temperature excursions must be documented and managed.');
q('storage', 'FEFO stands for:', ['First Expiry, First Out', 'First Entry, Final Order', 'Fast Expiry, Free Offer', 'Final Expiry, First Order'], 0, 'Stock with the earliest expiry is used first.');
q('storage', 'Expired medicines found on the shelf should be:', ['Removed, quarantined and disposed of properly', 'Sold at a discount', 'Moved to the back of the shelf', 'Given away free'], 0, 'Expired stock must never be supplied.');
q('storage', 'A prescription-only medicine may be supplied:', ['Only against a valid prescription', 'To anyone who asks politely', 'If the customer pays extra', 'If the customer used it before'], 0, 'Legal and safety requirement.');
q('storage', 'Why are look-alike/sound-alike medicines a safety concern?', ['They increase the risk of selection errors', 'They are always counterfeit', 'They expire faster', 'They need refrigeration'], 0, 'Double-check names, strengths and forms.');
q('storage', 'Reporting suspected adverse drug reactions is part of:', ['Pharmacovigilance', 'Stock rotation', 'Marketing', 'Price control'], 0, 'Pharmacovigilance monitors medicine safety.');
q('storage', '"Store below 25 °C" on a label means:', ['Keep at room temperature not exceeding 25 °C', 'Freeze the product', 'Keep in the fridge only', 'Store in direct sunlight'], 0, 'Do not exceed 25 °C.');
q('storage', 'A prescription dated about 9 months ago for an old illness should generally be:', ['Referred back to the prescriber', 'Dispensed as written', 'Dispensed at half quantity', 'Photocopied and reused'], 0, 'Prescriptions have validity periods and clinical context.');

// ── Devices
q('devices', 'For an accurate home blood pressure reading, the arm should be:', ['Supported at heart level after 5 minutes\' rest', 'Raised above the head', 'Hanging down while standing', 'Measured right after exercise'], 0, 'Correct posture and rest improve accuracy.');
q('devices', 'Blood glucose test strips should be stored:', ['In their original container, tightly closed', 'Loose in a wallet', 'In the freezer', 'In a humid bathroom'], 0, 'Moisture and heat damage strips.');
q('devices', 'Used lancets should be:', ['Disposed of in a sharps container', 'Reused several times', 'Shared with family', 'Thrown loose in household waste'], 0, 'Lancets are single-use sharps.');
q('devices', 'Which can make pulse oximeter readings less reliable?', ['Cold fingers, movement or nail polish', 'Clean, warm hands', 'Sitting still', 'Good lighting'], 0, 'These factors affect signal quality.');
q('devices', 'A digital thermometer tip should be cleaned:', ['Before and after each use', 'Once a year', 'Never', 'Only when it stops working'], 0, 'Hygiene prevents cross-infection.');

export const QUESTION_BANK = Q;

/** Draw n questions balanced across modules, shuffle each question's options. */
export function drawInspection(n = 20, rnd = Math.random) {
  const byMod = {};
  for (const item of Q) (byMod[item.m] ||= []).push(item);
  for (const k in byMod) byMod[k].sort(() => rnd() - 0.5);
  const mods = Object.keys(byMod).sort(() => rnd() - 0.5);
  const chosen = [];
  let i = 0;
  while (chosen.length < n) {
    const m = mods[i % mods.length];
    const item = byMod[m].pop();
    if (item) chosen.push(item);
    i++;
    if (i > 2000) break;
  }
  return chosen.sort(() => rnd() - 0.5).map((item) => {
    const order = [0, 1, 2, 3].sort(() => rnd() - 0.5);
    return { ...item, options: order.map((o) => item.options[o]), a: order.indexOf(item.a) };
  });
}

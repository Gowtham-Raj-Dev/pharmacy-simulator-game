// ─────────────────────────────────────────────────────────────────────────────
// RxShift — Hospital pharmacy stock list (real brand names)
//
// This is the list trainees see on the shelves. Edit it to match the brands your
// hospital pharmacy actually stocks — nothing else in the game needs to change.
//
//   b(name, manufacturer, only)  a branded product. `only` = indexes into that
//                                ingredient's `variants` in products.js (which
//                                strengths/forms this brand comes in). Omit for all.
//   gen(name, manufacturer)      the generic (non-branded) version; priced lower.
//
// Keys match the ingredient `key` in products.js. Brand/manufacturer pairs are
// common Indian-market examples — have your pharmacist verify them against the
// hospital formulary before training use.
// ─────────────────────────────────────────────────────────────────────────────

const b = (n, m, only = null) => ({ n, m, only });
const gen = (n, m = 'Generic') => ({ n, m, only: null, g: true });
const JA = 'Jan Aushadhi (PMBI)';

export const BRANDS = {
  // ── Pain / fever
  // paracetamol variants: 0 500 mg tab · 1 650 mg tab · 2 syrup · 3 sugar-free syrup · 4 infant drops
  paracetamol: [b('Dolo', 'Micro Labs', [1, 2]), b('Crocin', 'Haleon', [0, 1, 4]), b('Calpol', 'GSK', [0, 1, 2, 4]), b('Pacimol', 'Ipca', [0, 1]), b('Paracip', 'Cipla', [0, 1]), gen('Paracetamol', JA)],
  ibuprofen: [b('Brufen', 'Abbott', [1, 2]), b('Ibugesic', 'Cipla', [1, 2]), gen('Ibuprofen', JA)],
  aspirin: [b('Disprin', 'Reckitt', [0]), b('Ecosprin', 'USV', [1]), gen('Aspirin')],
  naproxen: [b('Naprosyn', 'RPG Life Sciences'), gen('Naproxen')],

  // ── Allergy
  cetirizine: [b('Okacet', 'Cipla'), b('Alerid', 'Cipla'), b('Cetzine', "Dr. Reddy's"), gen('Cetirizine', JA)],
  loratadine: [b('Lorfast', 'Zydus'), gen('Loratadine')],
  fexofenadine: [b('Allegra', 'Sanofi'), gen('Fexofenadine')],
  chlorphenamine: [b('Cadistin', 'Zydus', [0]), gen('Chlorphenamine', JA)],
  diphenhydramine: [gen('Diphenhydramine')],

  // ── Stomach
  antacid: [b('Digene', 'Abbott', [0, 1]), b('Gelusil MPS', 'Pfizer', [0, 1]), gen('Antacid', JA)],
  alginate: [b('Gaviscon', 'Reckitt'), gen('Alginate antacid')],
  famotidine: [b('Famocid', 'Sun Pharma'), gen('Famotidine')],
  omeprazole: [b('Omez', "Dr. Reddy's"), b('Ocid', 'Zydus'), gen('Omeprazole', JA)],
  loperamide: [b('Eldoper', 'Micro Labs'), gen('Loperamide')],
  ors: [b('Electral', 'FDC'), gen('ORS (WHO)', JA)],
  zinc: [gen('Zinc')],
  simethicone: [gen('Simethicone')],
  lactulose: [b('Duphalac', 'Abbott'), gen('Lactulose')],
  ispaghula: [b('Sat-Isabgol', 'Sidhpur Sat-Isabgol', [1]), gen('Isabgol')],
  bisacodyl: [b('Dulcolax', 'Sanofi'), gen('Bisacodyl')],
  senna: [gen('Senna')],

  // ── Cough / cold / throat
  dextromethorphan: [gen('Dextromethorphan')],
  guaifenesin: [gen('Guaifenesin')],
  linctus: [b('Honitus', 'Dabur'), gen('Honey linctus')],
  lozenge: [b('Strepsils', 'Reckitt'), gen('Throat lozenge')],
  benzydamine: [gen('Benzydamine')],
  saline: [b('Nasoclear', 'Cipla'), gen('Saline')],
  xylometazoline: [b('Otrivin', 'Haleon'), gen('Xylometazoline')],
  pseudoephedrine: [gen('Pseudoephedrine')],
  coldCombo: [b('Sinarest', 'Centaur'), b('Wikoryl', 'Alembic'), gen('Cold tablet')],
  menthol: [b('Vicks VapoRub', 'P&G', [1]), gen('Steam inhalant')],
  dimenhydrinate: [gen('Dimenhydrinate')],
  nicotine: [b('Nicotex', 'Cipla'), gen('Nicotine gum')],

  // ── Mouth
  chlorhexMouth: [b('Hexidine', 'ICPA'), gen('Chlorhexidine')],
  lidoGel: [gen('Lidocaine')],

  // ── Skin
  clotrimazole: [b('Candid', 'Glenmark'), gen('Clotrimazole', JA)],
  terbinafine: [b('Terbicip', 'Cipla'), gen('Terbinafine')],
  hydrocortisone: [gen('Hydrocortisone')],
  calamine: [gen('Calamine')],
  aloe: [gen('Aloe vera')],
  emollient: [gen('Emollient')],
  urea: [gen('Urea')],
  diclofenacGel: [b('Voveran Emulgel', "Dr. Reddy's"), gen('Diclofenac', JA)],
  salicylateRub: [b('Iodex', 'Haleon', [0]), b('Moov', 'Reckitt'), gen('Pain balm')],
  benzoyl: [b('Benzac AC', 'Galderma'), gen('Benzoyl peroxide')],
  sunscreen: [gen('Sunscreen')],
  permethrin: [b('Permite', 'Glenmark', [0]), gen('Permethrin')],
  dimeticone: [gen('Dimeticone')],
  ketoShampoo: [b('Nizral', 'Kenvue'), gen('Ketoconazole')],

  // ── Antiseptics / first aid
  iodine: [b('Betadine', 'Win-Medicare'), gen('Povidone-iodine', JA)],
  chlorhexAntiseptic: [b('Savlon', 'ITC'), gen('Antiseptic')],
  plaster: [b('Band-Aid', 'Kenvue'), b('Hansaplast', 'Beiersdorf'), gen('Plaster')],
  gauze: [gen('Gauze')],
  crepe: [gen('Crepe bandage')],
  cotton: [gen('Cotton')],
  tape: [b('Micropore', '3M'), gen('Surgical tape')],
  coldPack: [gen('Cold pack')],
  burnGel: [gen('Burn dressing')],
  wipes: [gen('Alcohol swab')],
  firstAidKit: [gen('First-aid kit')],

  // ── Eye / ear
  lubricantEye: [b('Refresh Tears', 'AbbVie'), gen('CMC eye drops')],
  earWax: [gen('Ear-wax drops')],

  // ── Vitamins / supplements / tonics
  folic: [b('Folvite', 'Pfizer'), gen('Folic acid', JA)],
  vitD: [gen('Vitamin D3')],
  calciumD: [b('Shelcal', 'Torrent'), gen('Calcium + D3', JA)],
  iron: [gen('Ferrous fumarate', JA)],
  multivit: [b('Supradyn', 'Bayer', [0]), b('Revital H', 'Sun Pharma', [1]), gen('Multivitamin')],
  vitC: [b('Limcee', 'Abbott'), gen('Vitamin C')],
  omega3: [b('Maxepa', 'Merck'), gen('Omega-3')],
  probiotic: [gen('Probiotic')],
  glucose: [b('Glucon-D', 'Zydus Wellness', [0]), gen('Glucose')],
  bcomplexTonic: [b('Polybion', 'P&G Health', [0]), gen('B-complex')],
  ironTonic: [b('Dexorange', 'Franco-Indian'), gen('Iron tonic')],
  calciumTonic: [b('Ostocalcium', 'GSK'), gen('Calcium syrup')],
  kidsMultiTonic: [gen('Kids multivitamin')],

  // ── Devices
  thermometer: [b('Omron', 'Omron'), b('Dr Trust', 'Nureca')],
  irThermo: [b('Dr Trust', 'Nureca')],
  bpArm: [b('Omron', 'Omron'), b('Dr Trust', 'Nureca', [0])],
  bpWrist: [b('Omron', 'Omron')],
  glucometer: [b('Accu-Chek', 'Roche'), b('OneTouch', 'LifeScan')],
  strips: [b('Accu-Chek', 'Roche', [0]), b('OneTouch', 'LifeScan', [1])],
  lancets: [b('Accu-Chek Softclix', 'Roche'), gen('Lancets')],
  oximeter: [b('Dr Trust', 'Nureca')],
  nebulizer: [b('Omron', 'Omron')],
  spacer: [gen('Spacer')],

  // ── Personal / baby care
  sanitizer: [b('Dettol', 'Reckitt', [0]), b('Lifebuoy', 'HUL', [1])],
  mask: [gen('3-ply mask')],
  toothpaste: [b('Sensodyne', 'Haleon')],
  lipBalm: [b('Vaseline', 'HUL')],
  pads: [b('Whisper', 'P&G'), b('Stayfree', 'Kenvue')],
  zincOxide: [gen('Zinc oxide')],
  diapers: [b('Pampers', 'P&G'), b('Huggies', 'Kimberly-Clark')],
  babyWipes: [b("Johnson's Baby", 'Kenvue'), b('Himalaya', 'Himalaya Wellness')],
  babyLotion: [b("Johnson's Baby", 'Kenvue'), b('Himalaya', 'Himalaya Wellness')],

  // ── Prescription only
  amoxicillin: [b('Mox', 'Sun Pharma'), b('Novamox', 'Cipla'), gen('Amoxicillin', JA)],
  coamox: [b('Augmentin', 'GSK'), b('Clavam', 'Alkem'), b('Moxikind-CV', 'Mankind'), gen('Amoxicillin + Clavulanate', JA)],
  azithromycin: [b('Azithral', 'Alembic'), b('Azee', 'Cipla'), gen('Azithromycin', JA)],
  ciprofloxacin: [b('Ciplox', 'Cipla'), b('Cifran', 'Sun Pharma'), gen('Ciprofloxacin', JA)],
  metronidazole: [b('Flagyl', 'Abbott'), b('Metrogyl', 'J.B. Chemicals'), gen('Metronidazole', JA)],
  metformin: [b('Glycomet', 'USV'), b('Glyciphage', 'Franco-Indian'), gen('Metformin', JA)],
  glimepiride: [b('Amaryl', 'Sanofi'), gen('Glimepiride', JA)],
  amlodipine: [b('Amlong', 'Micro Labs'), b('Stamlo', "Dr. Reddy's"), b('Amlokind', 'Mankind'), gen('Amlodipine', JA)],
  losartan: [b('Losacar', 'Zydus'), b('Repace', 'Sun Pharma'), gen('Losartan', JA)],
  atorvastatin: [b('Atorva', 'Zydus'), b('Storvas', 'Sun Pharma'), gen('Atorvastatin', JA)],
  levothyroxine: [b('Thyronorm', 'Abbott'), b('Eltroxin', 'GSK'), gen('Levothyroxine')],
  salbutamol: [b('Asthalin', 'Cipla'), gen('Salbutamol')],
  budesonide: [b('Budecort', 'Cipla'), gen('Budesonide')],
  prednisolone: [b('Wysolone', 'Pfizer'), b('Omnacortil', 'Macleods'), gen('Prednisolone', JA)],
  warfarin: [b('Warf', 'Cipla'), b('Uniwarfin', 'Unichem'), gen('Warfarin')],
  clopidogrel: [b('Clopilet', 'Sun Pharma'), b('Deplatt', 'Torrent'), b('Plavix', 'Sanofi'), gen('Clopidogrel', JA)],
  sertraline: [b('Daxid', 'Pfizer'), b('Zosert', 'Sun Pharma'), gen('Sertraline')],
  codeineSyrup: [gen('Codeine linctus')],
  ondansetron: [b('Emeset', 'Cipla'), b('Ondem', 'Alkem'), b('Vomikind', 'Mankind'), gen('Ondansetron', JA)],
  albendazole: [b('Zentel', 'GSK'), b('Bandy', 'Mankind'), gen('Albendazole', JA)],
  mebendazole: [b('Mebex', 'Cipla'), gen('Mebendazole')],
  ssd: [b('Silverex', 'Ipca'), gen('Silver sulfadiazine')],
  mupirocin: [b('T-Bact', 'GSK'), gen('Mupirocin')],
  fusidic: [b('Fucidin', 'Leo Pharma'), gen('Fusidic acid')],
  chloramphenicolEye: [gen('Chloramphenicol')],
  insulinHuman: [b('Actrapid', 'Novo Nordisk'), b('Huminsulin R', 'Lilly')],
  insulinGlargine: [b('Lantus', 'Sanofi'), b('Basalog', 'Biocon')],
  latanoprost: [b('Xalatan', 'Pfizer'), b('Latoprost', 'Sun Pharma')],
  tetanus: [gen('Tetanus toxoid', 'Serum Institute of India')],
  probioticCold: [gen('Probiotic drops')],
};

/** Brands that come in variant `vi` of ingredient `key`. */
export function brandsFor(key, vi) {
  return (BRANDS[key] || [gen('Generic')]).filter((x) => !x.only || x.only.includes(vi));
}

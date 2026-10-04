// RxShift — Training levels & unlocks
// objective types: visit, inspectShelf, serve, viewDetails, search, restock, event, modules, practice, inspection

export const LEVELS = [
  { n: 1, title: 'Basic Pharmacy Navigation', rank: 'Trainee Pharmacist',
    intro: 'Welcome to your first shift! Learn your way around the pharmacy. Use the joystick to walk, swipe to look around, and tap things to interact.',
    objectives: [
      { type: 'visit', target: 'counter', label: 'Walk to the dispensing counter' },
      { type: 'inspectShelf', label: 'Inspect any medicine shelf' },
      { type: 'visit', target: 'fridge', label: 'Check the medicine refrigerator' },
    ], unlock: ['Customer service'] },
  { n: 2, title: 'Simple Customer Interactions', rank: 'Trainee Pharmacist', difficulties: [1], queueMax: 1,
    intro: 'Customers are arriving. Listen, ask questions, and choose a suitable product.',
    objectives: [{ type: 'serve', count: 2, label: 'Serve 2 customers' }], unlock: ['Uniform: Teal scrubs'] },
  { n: 3, title: 'Medicine Information', rank: 'Pharmacy Intern', difficulties: [1, 2], queueMax: 1,
    intro: 'Always read the medicine information before dispensing. Use the search to find products by name, ingredient or symptom.',
    objectives: [
      { type: 'viewDetails', count: 3, label: 'View full details of 3 products' },
      { type: 'search', label: 'Use symptom search' },
      { type: 'serve', count: 2, label: 'Serve 2 customers' },
    ], unlock: ['Skin care & vitamin catalog'] },
  { n: 4, title: 'Multiple Customer Conditions', rank: 'Pharmacy Intern', difficulties: [2], queueMax: 2,
    intro: 'Customers now have more varied problems. Ask the right questions before deciding.',
    objectives: [{ type: 'serve', count: 3, label: 'Serve 3 customers' }], unlock: ['Baby care & devices catalog'] },
  { n: 5, title: 'Safety Checks', rank: 'Junior Pharmacist', difficulties: [3], queueMax: 2,
    intro: 'Some customers have allergies, conditions or medicines that make certain products unsafe. The safety check is your last line of defence.',
    objectives: [{ type: 'serve', count: 3, safe: true, label: 'Serve 3 customers safely' }], unlock: ['Uniform: Navy coat', 'Prescription cabinet'] },
  { n: 6, title: 'Inventory Management', rank: 'Junior Pharmacist', difficulties: [1, 2, 3], queueMax: 2,
    intro: 'Keep stock healthy: restock low items, remove expired stock and protect the cold chain.',
    objectives: [
      { type: 'restock', label: 'Place a restock order at the POS' },
      { type: 'event', event: 'expired', label: 'Handle the expired stock in storage' },
      { type: 'event', event: 'fridge', label: 'Respond to the refrigerator alarm' },
      { type: 'serve', count: 2, label: 'Serve 2 customers' },
    ], unlock: ['Evening shift lighting'] },
  { n: 7, title: 'Difficult Customer Scenarios', rank: 'Pharmacist', difficulties: [4, 3], queueMax: 2,
    intro: 'Not every problem can be solved over the counter. Recognise red flags and refer when needed.',
    objectives: [{ type: 'serve', count: 3, label: 'Serve 3 customers (red-flag cases)' }], unlock: ['Pharmacy expansion wing'] },
  { n: 8, title: 'Advanced Pharmacy Simulation', rank: 'Pharmacist', difficulties: [3, 4, 5], queueMax: 3, events: true,
    intro: 'A busy shift with prescriptions, stock problems and random events. Stay safe under pressure.',
    objectives: [{ type: 'serve', count: 4, label: 'Serve 4 customers' }], unlock: ['Uniform: Charcoal coat'] },
  { n: 9, title: 'Inspection Preparation', rank: 'Senior Pharmacist',
    intro: 'Inspections require 20/20. Study the training modules and pass a practice quiz before the official inspection.',
    objectives: [
      { type: 'modules', count: 3, label: 'Complete 3 training modules' },
      { type: 'practice', score: 8, label: 'Score 8/10 or more in a practice quiz' },
    ], unlock: ['Hospital pharmacy theme'] },
  { n: 10, title: '20-Question Inspection', rank: 'Senior Pharmacist',
    intro: 'The official pharmacy inspection. Every answer must be correct.',
    objectives: [{ type: 'inspection', label: 'Pass the official inspection (20/20)' }], unlock: ['Career mode', 'Certified pharmacy plaque'] },
];

export const RANKS = ['Trainee Pharmacist', 'Pharmacy Intern', 'Junior Pharmacist', 'Pharmacist', 'Senior Pharmacist', 'Pharmacy Manager'];

export const UPGRADES = [
  { id: 'outfit_teal', type: 'outfit', name: 'Teal scrubs', desc: 'A modern teal scrub top under your coat.', cost: 0, level: 2, color: 0x1c9c8c },
  { id: 'outfit_navy', type: 'outfit', name: 'Navy coat', desc: 'A professional navy pharmacist coat.', cost: 300, level: 5, color: 0x23345c },
  { id: 'outfit_charcoal', type: 'outfit', name: 'Charcoal coat', desc: 'A premium charcoal coat.', cost: 500, level: 8, color: 0x3a3f46 },
  { id: 'fridge_pro', type: 'equipment', name: 'Medical-grade refrigerator', desc: 'Data-logging fridge with fewer temperature alarms.', cost: 1200, level: 6 },
  { id: 'pos_pro', type: 'equipment', name: 'Pro POS terminal', desc: 'Faster checkout; +5% customer satisfaction on payment.', cost: 900, level: 4 },
  { id: 'signage', type: 'equipment', name: 'Digital section signage', desc: 'Illuminated section signs for easier navigation.', cost: 600, level: 3 },
  { id: 'expansion', type: 'environment', name: 'Expansion wing', desc: 'Open the extra aisle with more shelves and products.', cost: 1500, level: 7 },
  { id: 'theme_evening', type: 'environment', name: 'Evening shift', desc: 'Warm evening lighting preset.', cost: 0, level: 6 },
  { id: 'theme_hospital', type: 'environment', name: 'Hospital pharmacy theme', desc: 'Clinical white-and-blue interior.', cost: 800, level: 9 },
];

export const ACHIEVEMENTS = [
  { id: 'first', name: 'First Customer', desc: 'Serve your first customer.' },
  { id: 'detective', name: 'Thorough Consultation', desc: 'Ask all six questions before deciding.' },
  { id: 'safe5', name: 'Safety First', desc: 'Five safe decisions in a row.' },
  { id: 'referral', name: 'Life Saver', desc: 'Correctly refer an emergency case.' },
  { id: 'generic', name: 'Generic Guru', desc: 'Offer a generic alternative for an out-of-stock brand.' },
  { id: 'coldchain', name: 'Cold Chain Guardian', desc: 'Handle a refrigerator alarm correctly.' },
  { id: 'expired', name: 'FEFO Hero', desc: 'Quarantine expired stock.' },
  { id: 'certified', name: 'Certified Pharmacy', desc: 'Pass a 20/20 inspection.' },
  { id: 'scholar', name: 'Knowledge Seeker', desc: 'Complete all training modules.' },
  { id: 'served25', name: 'Busy Counter', desc: 'Serve 25 customers.' },
];

import { mapBi } from '../i18n/i18n.js';
// Pharmacy random events (predefined, educational). Text templates use {placeholders}.
export const EVENTS = {
  fridge: {
    title: 'Refrigerator temperature alarm', icon: 'snow', where: 'fridge', toast: 'Refrigerator alarm! Temperature out of range.',
    objective: 'Respond to the refrigerator alarm',
    text: 'The medicine refrigerator reads {temp} °C (required range 2–8 °C). It has been out of range for about 25 minutes. It holds insulin and other cold-chain products.',
    options: [
      { t: 'Record the reading, quarantine the cold-chain stock pending assessment, fix the cause (door seal/setting) and follow the temperature-excursion procedure.', correct: true },
      { t: 'Ignore it — the temperature will come back down by itself.' },
      { t: 'Move all insulin and vaccines into the freezer compartment to cool them quickly.' },
      { t: 'Sell the insulin quickly at a discount before it spoils.' },
    ],
    learn: 'Cold-chain medicines (e.g., insulin, vaccines) must be kept at 2–8 °C and never frozen. Excursions are documented, affected stock is quarantined and assessed (e.g., with the manufacturer) before any use, and the cause is fixed.',
  },
  expired: {
    title: 'Expired stock discovered', icon: 'box', where: 'storage', toast: 'Expired stock found in storage.',
    objective: 'Handle the expired stock in storage',
    text: 'During a stock check you find a carton of {product} (batch {batch}) with expiry {expiry}. It is past its expiry date.',
    options: [
      { t: 'Remove it from saleable stock, label it, place it in the quarantine bin and record it for proper disposal/return.', correct: true },
      { t: 'Move it to the front of the shelf so it sells first (FEFO).' },
      { t: 'Sell it at a discount — a few weeks past expiry is fine.' },
      { t: 'Put it at the back of the shelf behind newer stock.' },
    ],
    learn: 'Expired medicines must never be supplied. Remove, segregate (quarantine), document and dispose of them through the proper route. FEFO (First Expiry, First Out) applies to in-date stock only.',
  },
  misplaced: {
    title: 'Product in the wrong location', icon: 'alert', where: 'shelf', toast: 'A product was found on the wrong shelf.',
    objective: 'Check the misplaced product on the vitamins shelf',
    text: 'A {product} pen — a refrigerated prescription medicine — has been found on the Vitamins shelf at room temperature. Nobody knows how long it has been there.',
    options: [
      { t: 'Remove it from sale, quarantine it as a possible cold-chain breach, record the incident and check the rest of the shelf.', correct: true },
      { t: 'Put it back in the fridge and sell it as normal.' },
      { t: 'Leave it on the vitamins shelf so customers can find it.' },
      { t: 'Give it to the next customer who asks for vitamins.' },
    ],
    learn: 'Products in the wrong location are a dispensing-error and storage risk. Cold-chain items left at room temperature must be quarantined and assessed, and Rx items must never be on open self-selection shelves.',
  },
};


export function fillEvent(ev) {
  return mapBi(ev.text, (x) => x.replace('{temp}', ev.temp != null ? ev.temp.toFixed(1) : '').replace('{product}', ev.product ? String(ev.product.name) : '').replace('{batch}', ev.product ? ev.product.batch : '').replace('{expiry}', ev.expiry || ''));
}

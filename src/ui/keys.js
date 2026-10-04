// PC keyboard shortcuts. Any button with data-key="x y" inside the active scope
// (top modal → dialogue sheet → HUD) is clicked when one of its keys is pressed.
// Buttons also carry data-kbd="X", shown as a small key badge on keyboard devices.
export function initShortcuts(ui) {
  const root = document.documentElement;
  const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)');
  const setKbd = (on) => root.classList.toggle('kbd', !!on);
  // desktop = mouse + keyboard device → on-screen touch controls (joystick, RUN, camera bar) are hidden.
  // A real touch anywhere brings them back (touch-screen laptops, tablets with a mouse).
  const setDesk = (on) => { root.classList.toggle('touch', !on); if (root.classList.contains('desktop') !== !!on) { root.classList.toggle('desktop', !!on); window.dispatchEvent(new Event('rx-input-mode')); } };
  setKbd(fine?.matches);
  setDesk(fine?.matches);
  fine?.addEventListener?.('change', (e) => { setKbd(e.matches); setDesk(e.matches); });
  window.addEventListener('touchstart', () => { setDesk(false); if (!fine?.matches) setKbd(false); }, { passive: true, capture: true });
  window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && fine?.matches) setDesk(true); }, { passive: true, capture: true });

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (!root.classList.contains('kbd') && e.key !== 'Shift') setKbd(true);
    const tag = e.target?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (typing && key !== 'Escape' && key !== 'Enter') return;
    const scope = ui.keyScope();
    if (!scope) return;
    if (key === '/' ) {
      const inp = scope.querySelector?.('input[type=search]');
      if (inp) { e.preventDefault(); inp.focus(); inp.select(); return; }
    }
    if (typing && key === 'Enter') { e.target.blur(); return; }
    const btns = scope.querySelectorAll('[data-key]');
    for (const b of btns) {
      if (!b.dataset.key.split(' ').includes(key)) continue;
      if (b.disabled || b.offsetParent === null) continue;
      e.preventDefault(); e.stopImmediatePropagation();
      b.click();
      flash(b);
      return;
    }
    if (key === 'Escape') {
      const x = scope.querySelector?.('.xbtn');
      if (x && x.offsetParent !== null) { e.preventDefault(); e.stopImmediatePropagation(); x.click(); }
    }
  }, true);
}
function flash(b) { b.classList.add('kb-hit'); setTimeout(() => b.classList.remove('kb-hit'), 160); }
/** Attributes helper: k('Enter', '↵') → { 'data-key': 'enter', 'data-kbd': '↵' } */
export const K = (keys, badge) => ({ 'data-key': keys, 'data-kbd': badge ?? keys.split(' ')[0].toUpperCase() });

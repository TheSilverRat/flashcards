/**
 * Phone vs desktop layout.
 *
 * "Automatic" picks the desktop layout when the browser reports a wide window (M3 "expanded",
 * 840px+) and a mouse/trackpad as the main pointer. The S24 (touch, narrow) always gets the phone
 * layout; a PC browser gets the desktop one, and shrinking the window falls back to phone.
 * The choice can be forced in Settings; it's stored per browser, not in backups.
 */

export type LayoutPref = 'auto' | 'phone' | 'desktop';

const KEY = 'layout';
const mq = window.matchMedia('(min-width: 840px) and (hover: hover) and (pointer: fine)');

function readPref(): LayoutPref {
  let v: string | null = null;
  try {
    v = localStorage.getItem(KEY);
  } catch {
    /* storage blocked: use automatic */
  }
  return v === 'phone' || v === 'desktop' ? v : 'auto';
}

export const device = $state({ pref: readPref(), desktop: false });

function apply() {
  device.desktop = device.pref === 'auto' ? mq.matches : device.pref === 'desktop';
  document.documentElement.classList.toggle('desktop', device.desktop);
}

export function setLayout(pref: LayoutPref) {
  device.pref = pref;
  try {
    if (pref === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* not remembered, still applied for this visit */
  }
  apply();
}

mq.addEventListener('change', apply);
apply();

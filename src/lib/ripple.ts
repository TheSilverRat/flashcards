// Material ripple: one delegated listener adds an expanding circle to any pressable element.
const SELECTOR = '.btn, .icon-btn, .fab, .list-item, .grade, .tool, .chip, [data-ripple]';

let installed = false;

export function installRipple() {
  if (installed) return;
  installed = true;
  document.addEventListener(
    'pointerdown',
    (e) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(SELECTOR);
      if (!el || (el as HTMLButtonElement).disabled) return;
      const r = el.getBoundingClientRect();
      const size = Math.hypot(r.width, r.height) * 2;
      const span = document.createElement('span');
      span.className = 'ripple';
      span.style.width = span.style.height = `${size}px`;
      span.style.left = `${e.clientX - r.left - size / 2}px`;
      span.style.top = `${e.clientY - r.top - size / 2}px`;
      el.appendChild(span);

      const release = () => {
        window.removeEventListener('pointerup', release);
        window.removeEventListener('pointercancel', release);
        setTimeout(() => {
          span.classList.add('out');
          setTimeout(() => span.remove(), 320);
        }, 150);
      };
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', release);
    },
    { passive: true },
  );

  // Top app bar changes color once content scrolls under it.
  window.addEventListener('scroll', updateScrolled, { passive: true });
}

export function updateScrolled() {
  document.body.classList.toggle('scrolled', window.scrollY > 4);
}

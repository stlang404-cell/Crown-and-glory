/**
 * Keyboard access for scroll containers (WCAG 2.1.1, axe "scrollable-region-focusable"): a container whose content
 * overflows becomes a focusable, labelled region so keyboard users can scroll it with the arrow keys. Containers
 * that do not overflow get no extra tab stop. Use as a ref: `<div style={{ overflowX: 'auto' }} ref={scrollRegion('Standings table')}>`.
 */
const tracked = new Map<HTMLElement, string>();
let ro: ResizeObserver | null = null;

function update(el: HTMLElement, label: string): void {
  const scrolls = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
  if (scrolls) {
    if (el.getAttribute('tabindex') !== '0') el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', label);
    el.classList.add('scroll-region');
  } else if (el.hasAttribute('tabindex')) {
    el.removeAttribute('tabindex'); el.removeAttribute('role'); el.removeAttribute('aria-label'); el.classList.remove('scroll-region');
  }
}

function observer(): ResizeObserver | null {
  if (ro || typeof ResizeObserver === 'undefined') return ro;
  ro = new ResizeObserver(() => {
    for (const [el, label] of tracked) {
      if (!el.isConnected) { tracked.delete(el); ro!.unobserve(el); continue; }
      update(el, label);
    }
  });
  return ro;
}

const refs = new Map<string, (el: HTMLElement | null) => void>();
export function scrollRegion(label: string): (el: HTMLElement | null) => void {
  let f = refs.get(label);
  if (!f) {
    f = (el: HTMLElement | null) => {
      if (!el) return;
      tracked.set(el, label);
      const o = observer();
      if (o) { o.observe(el); if (el.firstElementChild) o.observe(el.firstElementChild); }
      update(el, label);
    };
    refs.set(label, f);
  }
  return f;
}

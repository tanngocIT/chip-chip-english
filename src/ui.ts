import { h } from './lib/dom';
import type { Word } from './lib/content';
import { imgUrl } from './lib/content';

const svg = (path: string, vb = '0 0 24 24') => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', vb);
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = path;
  return s;
};

const stroke = (d: string) =>
  `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;

export const icon = {
  back: () => svg(stroke('M14.5 5 8 12l6.5 7')),
  next: () => svg(stroke('M9.5 5 16 12l-6.5 7')),
  home: () => svg(stroke('M4 11.5 12 5l8 6.5M6.5 10v8.5h11V10')),
  again: () => svg(stroke('M19 12a7 7 0 1 1-2.1-5M19 4.5V8h-3.5')),
  speaker: () =>
    svg(
      `<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor"/>` +
        stroke('M15.5 9.2a4 4 0 0 1 0 5.6M18 7a7 7 0 0 1 0 10'),
    ),
  mic: () =>
    svg(
      `<rect x="9" y="3.5" width="6" height="11" rx="3" fill="currentColor"/>` +
        stroke('M6 11.5a6 6 0 0 0 12 0M12 17.5V21'),
    ),
  // speech bubble with a play mark: "hear my voice"
  voice: () =>
    svg(
      stroke('M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z') +
        `<path d="M10 8.6v5.8l4.8-2.9z" fill="currentColor"/>`,
    ),
  lock: () =>
    svg(`<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5" fill="currentColor"/>` + stroke('M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5')),
  star: () =>
    svg(
      `<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`,
    ),
};

/** The picture for a word, drawn as a die-cut sticker. Numbers show that many stars. */
export function picture(w: Word, cls = ''): HTMLElement {
  if (w.kind === 'number' && w.count) {
    const n = w.count;
    const cols = n <= 2 ? n : n <= 4 ? 2 : n <= 6 ? 3 : n <= 8 ? 4 : 5;
    const big = n > 10;
    return h(
      'div',
      { class: `pic count ${big ? 'many' : ''} ${cls}`, role: 'img', 'aria-label': w.word },
      h('span', { class: 'numeral' }, String(n)),
      h(
        'div',
        { class: 'grid', style: `--cols:${cols}` },
        Array.from({ length: n }, () => h('img', { src: w.img, alt: '', draggable: false })),
      ),
    );
  }
  return h(
    'div',
    { class: `pic ${cls}`, role: 'img', 'aria-label': w.word },
    h('img', { src: w.img, alt: '', draggable: false }),
  );
}

export function starsRow(n: number, max = 3, cls = '') {
  return h(
    'div',
    { class: `stars ${cls}`, 'aria-label': `${n} / ${max}` },
    Array.from({ length: max }, (_, i) => h('span', { class: i < n ? 'on' : 'off' }, icon.star())),
  );
}

export const mascot = (cls = '') => h('img', { class: `mascot ${cls}`, src: imgUrl('mascot'), alt: 'Chip', draggable: false });

export function roundBtn(ic: SVGElement, label: string, onclick: () => void, cls = '') {
  return h('button', { class: `round ${cls}`, 'aria-label': label, onclick }, ic);
}

export function progressDots(total: number, done: number) {
  return h(
    'div',
    { class: 'dots', 'aria-label': `${done} / ${total}` },
    Array.from({ length: total }, (_, i) => h('i', { class: i < done ? 'done' : i === done ? 'now' : '' })),
  );
}

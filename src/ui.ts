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
  // bánh răng: nút vào phần dành cho bố mẹ
  gear: () => svg(`<path d="M19.27 9.78L21.85 10.26L21.85 13.74L19.27 14.22L18.71 15.57L20.19 17.74L17.74 20.19L15.57 18.71L14.22 19.27L13.74 21.85L10.26 21.85L9.78 19.27L8.43 18.71L6.26 20.19L3.81 17.74L5.29 15.57L4.73 14.22L2.15 13.74L2.15 10.26L4.73 9.78L5.29 8.43L3.81 6.26L6.26 3.81L8.43 5.29L9.78 4.73L10.26 2.15L13.74 2.15L14.22 4.73L15.57 5.29L17.74 3.81L20.19 6.26L18.71 8.43zM12 8.6a3.4 3.4 0 1 0 0 6.8a3.4 3.4 0 1 0 0-6.8z" fill="currentColor" fill-rule="evenodd"/>`),
  // nút Chia sẻ của iOS, dùng trong hướng dẫn cài app
  share: () => svg(stroke('M12 15V3.5M8 7l4-3.5L16 7M7 11H5.5v9.5h13V11H17')),
  check: () => svg(stroke('M5 12.5l4.5 4.5L19 7.5')),
  // a framed picture: the child's own sticker picture
  picture: () => svg(stroke('M4.5 5.5h15v13h-15zM4.5 15.5l4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5') + `<circle cx="15.5" cy="9" r="1.4" fill="currentColor"/>`),
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
    // Few stars in few columns would be taller than the square they sit in (three stars in two
    // columns are two rows of half the width each), so the grid is narrowed until the rows fit.
    const rows = Math.ceil(n / cols);
    const width = big ? '' : `; width:${Math.min(100, Math.round((62 * cols) / rows))}%`;
    return h(
      'div',
      { class: `pic count ${big ? 'many' : ''} ${cls}`, role: 'img', 'aria-label': w.word },
      h('span', { class: 'numeral' }, String(n)),
      h(
        'div',
        { class: 'grid', style: `--cols:${cols}${width}` },
        Array.from({ length: n }, () => h('img', { src: w.img, alt: '', draggable: false })),
      ),
    );
  }
  if (w.kind === 'letter') {
    return h(
      'div',
      { class: `pic letter ${cls}`, role: 'img', 'aria-label': `letter ${w.word}` },
      h('span', { class: 'glyph' }, w.word, h('small', {}, w.word.toLowerCase())),
      h('img', { src: w.img, alt: '', draggable: false }),
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

let chipLook: string | null = null;

/** What Chip wears from now on (an id from LOOKS in progress.ts), or null for nothing. */
export const setChipLook = (id: string | null) => {
  chipLook = id;
};

/** Chip, wearing the chosen thing. Everything that shows Chip goes through here. */
export function chip(cls = '') {
  return h(
    'span',
    { class: `chip ${cls}`, role: 'img', 'aria-label': 'Chip' },
    h('img', { class: 'chip-body', src: imgUrl('mascot'), alt: '', draggable: false }),
    chipLook && h('img', { class: `chip-look look-${chipLook}`, src: imgUrl(`look-${chipLook}`), alt: '', draggable: false }),
  );
}

export const mascot = (cls = '') => chip(`mascot ${cls}`);

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

/** Chip pops up from the bottom edge, wiggles with joy and drops back. Touches nothing on the screen. */
export function chipCheer() {
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelector('.chip-peek')?.remove();
  const el = chip('chip-peek');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1150);
}

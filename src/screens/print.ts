// Printed flashcards for one topic: nine cards to a page, with lines to cut along.
// The sheet lives outside #app and only shows on paper (see `@media print` in style.css).

import { h } from '../lib/dom';
import { wordsIn, type Topic } from '../lib/content';
import { picture } from '../ui';

export const CARDS_PER_PAGE = 9;

export async function printCards(t: Topic) {
  document.querySelector('.print-sheet')?.remove();
  const list = wordsIn(t.id);
  const pages: HTMLElement[] = [];
  for (let i = 0; i < list.length; i += CARDS_PER_PAGE) {
    pages.push(
      h(
        'div',
        { class: 'print-page' },
        list.slice(i, i + CARDS_PER_PAGE).map((w) => h('div', { class: 'pcard' }, picture(w), h('b', {}, w.example ?? w.word), h('span', {}, w.vi))),
      ),
    );
  }
  const sheet = h('div', { class: 'print-sheet', 'aria-hidden': 'true' }, pages);
  document.body.appendChild(sheet);
  // every picture has to be loaded before the print dialog takes its snapshot
  await Promise.all([...sheet.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));
  window.addEventListener('afterprint', () => sheet.remove(), { once: true });
  window.print();
}

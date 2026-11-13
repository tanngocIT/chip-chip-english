// Keyboard control for computers: everything a tap can do, a key can do.
//   1–9          pick the Nth answer, card, game or topic on the screen
//   Enter        the main button (start, next, open the gift, the microphone)
//   Space        hear it again
//   Esc          back
//   ← →          previous / next flashcard, play again / next on the result screen
//   arrow keys   otherwise move the focus to the nearest button that way; Enter presses it
// Number hints show only while a keyboard is in use (body.keys); a tap or click hides them.

import { nextInDirection, type Direction } from '../lib/focus';

/** The things on a screen that the number keys pick, in the order they are numbered. */
const NUMBERED = ['.option', '.spot', '.flip', '.activity', '.numpad button', '.topic', '.tray-item'];

const visible = (el: Element) => (el as HTMLElement).offsetParent !== null || getComputedStyle(el).position === 'fixed';

const first = (root: Element, selectors: string[]) => {
  for (const s of selectors) {
    const el = root.querySelector<HTMLElement>(s);
    if (el && visible(el) && !(el as HTMLButtonElement).disabled) return el;
  }
  return null;
};

const ARROWS: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

export function initKeys(app: HTMLElement) {
  document.addEventListener('pointerdown', () => document.body.classList.remove('keys'));

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const screen = app.firstElementChild;
    if (!screen) return;
    const target = e.target as HTMLElement;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    const onButton = target !== document.body && screen.contains(target) && !typing;
    const press = (el: HTMLElement | null) => {
      if (!el) return false;
      e.preventDefault();
      el.click();
      return true;
    };

    if (e.key === 'Escape') {
      document.body.classList.add('keys');
      press(first(screen, ['.bar .round']));
      return;
    }
    if (typing) return;
    document.body.classList.add('keys');

    if (/^[1-9]$/.test(e.key)) {
      for (const sel of NUMBERED) {
        const items = [...screen.querySelectorAll<HTMLElement>(sel)];
        if (items.length) {
          press(items[Number(e.key) - 1] ?? null);
          return;
        }
      }
      return;
    }

    // Enter and Space on a focused button already press it; from nowhere they are shortcuts.
    if (!onButton && e.key === 'Enter') {
      press(first(screen, ['.play-big', '.gift', '.pager .go', '.mic', '.quick.today']));
      return;
    }
    if (!onButton && e.key === ' ') {
      press(first(screen, ['.bar .round.soft', '.target-word', 'button.flash', '.pager .round.soft:not(.mine)', '.play-big', '.gift', '.pager .go']));
      return;
    }

    const dir = ARROWS[e.key];
    if (!dir) return;
    // Flashcards and the result screen: left and right are previous and next.
    if (!onButton && (dir === 'left' || dir === 'right') && screen.querySelector('.pager .go') && !screen.querySelector('.mic')) {
      press(first(screen, [dir === 'right' ? '.pager .go' : '.pager .round:not(.go)']));
      return;
    }
    const buttons = [...screen.querySelectorAll<HTMLElement>('button, input, select, textarea')].filter(
      (b) => visible(b) && !(b as HTMLButtonElement).disabled,
    );
    if (!buttons.length) return;
    e.preventDefault();
    const at = buttons.indexOf(target);
    // the first arrow press lands on the first answer or tile, not on the Back button
    const start = buttons.findIndex((b) => NUMBERED.some((sel) => b.matches(sel)));
    const next = at < 0 ? Math.max(0, start) : nextInDirection(buttons.map((b) => b.getBoundingClientRect()), at, dir);
    if (next >= 0) buttons[next].focus();
  });
}

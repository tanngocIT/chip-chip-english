// My picture: the child puts the stickers they own on a background. Free play, no score.
//   tap a sticker in the tray   -> it lands on the picture
//   drag it out of the tray     -> it lands where it is dropped
//   drag a sticker on the picture to move it; drop it outside the picture to take it off
//   tap a sticker on the picture -> it says its name

import { h, pulse } from '../lib/dom';
import { stickers } from '../lib/content';
import { SCENE_MAX, SCENE_BACKGROUNDS, type ScenePiece } from '../lib/progress';
import { say } from '../lib/voice';
import { sfx } from '../lib/sfx';
import { icon, roundBtn } from '../ui';
import { P, show, persist } from './core';
import { stickerBook } from './home';

type Sticker = (typeof stickers)[number];

const clamp = (v: number) => Math.round(Math.min(96, Math.max(4, v)) * 10) / 10;

export function stickerScene() {
  const owned = stickers.filter((s) => P.stickers.includes(s.id));
  const board = h('div', { class: `board bg${P.sceneBg}` });
  // each piece on the board with its element, in the order they were put down
  const pieces: { piece: ScenePiece; el: HTMLElement }[] = [];

  const store = () => {
    P.scene = pieces.map((p) => p.piece);
    persist();
  };

  const inside = (x: number, y: number) => {
    const r = board.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
  const toPercent = (x: number, y: number): [number, number] => {
    const r = board.getBoundingClientRect();
    return [clamp(((x - r.left) / r.width) * 100), clamp(((y - r.top) / r.height) * 100)];
  };

  const remove = (entry: { piece: ScenePiece; el: HTMLElement }) => {
    entry.el.remove();
    pieces.splice(pieces.indexOf(entry), 1);
  };

  const put = (s: Sticker, x: number, y: number, isNew: boolean) => {
    const piece: ScenePiece = [s.id, x, y];
    const el = h('button', { class: `placed ${isNew ? 'pop-in' : ''}`, style: `left:${x}%; top:${y}%`, 'aria-label': s.name }, h('img', { src: s.img, alt: '', draggable: false }));
    const entry = { piece, el };
    pieces.push(entry);
    board.appendChild(el);
    drag(el, {
      tap: () => {
        pulse(el, 'wiggle');
        void say(s.name);
      },
      move: (cx, cy) => {
        // follows the finger even outside the board, so the child sees it leave
        const r = board.getBoundingClientRect();
        el.style.left = `${((cx - r.left) / r.width) * 100}%`;
        el.style.top = `${((cy - r.top) / r.height) * 100}%`;
        el.classList.toggle('leaving', !inside(cx, cy));
      },
      drop: (cx, cy) => {
        if (!inside(cx, cy)) {
          sfx.flip();
          remove(entry);
        } else {
          [piece[1], piece[2]] = toPercent(cx, cy);
          el.style.left = `${piece[1]}%`;
          el.style.top = `${piece[2]}%`;
          // the one just moved goes on top
          board.appendChild(el);
          pieces.push(...pieces.splice(pieces.indexOf(entry), 1));
        }
        store();
      },
    });
    if (pieces.length > SCENE_MAX) remove(pieces[0]);
  };

  for (const [id, x, y] of P.scene) {
    const s = owned.find((o) => o.id === id);
    if (s) put(s, x, y, false);
  }

  const tray = h(
    'div',
    { class: 'tray' },
    owned.map((s) => {
      const b = h('button', { class: 'tray-item', 'aria-label': s.name }, h('img', { src: s.img, alt: '', draggable: false }));
      let ghost: HTMLElement | null = null;
      const land = (x: number, y: number) => {
        sfx.sticker();
        put(s, x, y, true);
        store();
        void say(s.name);
      };
      drag(b, {
        // a tap puts the sticker somewhere in the middle part of the picture
        tap: () => land(clamp(15 + Math.random() * 70), clamp(20 + Math.random() * 60)),
        move: (cx, cy) => {
          if (!ghost) {
            ghost = h('img', { class: 'drag-ghost', src: s.img, alt: '' });
            document.body.appendChild(ghost);
          }
          ghost.style.left = `${cx}px`;
          ghost.style.top = `${cy}px`;
        },
        drop: (cx, cy) => {
          ghost?.remove();
          ghost = null;
          if (inside(cx, cy)) land(...toPercent(cx, cy));
        },
      });
      return b;
    }),
  );

  const bgBtn = roundBtn(icon.picture(), 'Change the background', () => {
    sfx.flip();
    board.classList.remove(`bg${P.sceneBg}`);
    P.sceneBg = (P.sceneBg + 1) % SCENE_BACKGROUNDS;
    board.classList.add(`bg${P.sceneBg}`);
    persist();
  }, 'soft');

  show(
    h(
      'main',
      { class: 'screen scene-screen' },
      h(
        'header',
        { class: 'bar' },
        roundBtn(icon.back(), 'Back', () => {
          sfx.tap();
          stickerBook();
        }),
        h('span', { class: 'spacer' }),
        bgBtn,
      ),
      board,
      tray,
    ),
    () => document.querySelectorAll('.drag-ghost').forEach((g) => g.remove()),
  );
}

/**
 * One pointer handler for taps and drags. A press that barely moves is a tap; anything else
 * calls `move` while the finger is down and `drop` when it lifts.
 */
function drag(el: HTMLElement, on: { tap: () => void; move: (x: number, y: number) => void; drop: (x: number, y: number) => void }) {
  let id = -1;
  let sx = 0;
  let sy = 0;
  let dragging = false;
  el.addEventListener('pointerdown', (e) => {
    id = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
    dragging = false;
    // hold the pointer from the start: a quick mouse flick leaves a small sticker before it has
    // moved far enough to count as a drag, and the moves would go to whatever is under it
    try {
      el.setPointerCapture(id);
    } catch {
      /* the pointer is already gone */
    }
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    if (!dragging && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) {
      dragging = true;
      el.classList.add('dragging');
    }
    if (dragging) on.move(e.clientX, e.clientY);
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = -1;
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging', 'leaving');
    // the click that follows a drag is not a tap
    const swallow = (c: Event) => c.stopImmediatePropagation();
    el.addEventListener('click', swallow, { capture: true, once: true });
    // if no click follows (the finger lifted somewhere else), do not eat the next real tap
    setTimeout(() => el.removeEventListener('click', swallow, true), 60);
    on.drop(e.clientX, e.clientY);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  // taps (and the keyboard) arrive as clicks
  el.addEventListener('click', () => on.tap());
}

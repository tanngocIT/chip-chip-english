// Moving the keyboard focus with the arrow keys: from one button to the nearest one in that direction.

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const centre = (b: Box) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });

/**
 * Index of the box to go to from `from` in direction `dir`, or -1 if there is none that way.
 * A box counts as "that way" when its centre lies beyond the current centre; among those, the
 * closest wins, and drifting sideways costs more than distance straight ahead, so "right" in a
 * grid stays in the same row when it can.
 */
export function nextInDirection(boxes: Box[], from: number, dir: Direction): number {
  const here = boxes[from];
  if (!here) return -1;
  const c = centre(here);
  let best = -1;
  let bestScore = Infinity;
  boxes.forEach((b, i) => {
    if (i === from) return;
    const p = centre(b);
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const ahead = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy;
    const aside = Math.abs(dir === 'left' || dir === 'right' ? dy : dx);
    if (ahead < 1) return;
    const score = ahead + aside * 3;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

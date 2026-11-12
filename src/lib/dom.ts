type Attrs = Record<string, any> & { class?: string; style?: string };
type Child = Node | string | number | false | null | undefined | Child[];

/** Tiny element builder: h('button', { class: 'x', onclick }, 'Hi') */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'class') {
      el.className = v;
    } else if (k === 'style') {
      el.setAttribute('style', v);
    } else if (k in el && typeof v !== 'string') {
      (el as any)[k] = v;
    } else {
      el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const reducedMotion = () =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Re-trigger a CSS animation class. */
export function pulse(el: Element, cls: string) {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
}

/** A short, quiet burst of pastel dots from an element. */
export function confetti(from: Element, count = 14) {
  if (reducedMotion()) return;
  const r = from.getBoundingClientRect();
  const colors = ['#FFC54D', '#7FD1A8', '#8CC8F5', '#F7A8BC', '#B9A5F2'];
  for (let i = 0; i < count; i++) {
    const d = document.createElement('i');
    d.className = 'dot';
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const dist = 70 + Math.random() * 60;
    d.style.left = `${r.left + r.width / 2}px`;
    d.style.top = `${r.top + r.height / 2}px`;
    d.style.background = colors[i % colors.length];
    d.style.setProperty('--dx', `${Math.cos(a) * dist}px`);
    d.style.setProperty('--dy', `${Math.sin(a) * dist}px`);
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }
}

/** Confetti falling over the whole screen, for the big moments (three stars, a new sticker). */
export function confettiRain(count = 40) {
  if (reducedMotion()) return;
  const colors = ['#FFC54D', '#7FD1A8', '#8CC8F5', '#F7A8BC', '#B9A5F2'];
  for (let i = 0; i < count; i++) {
    const d = document.createElement('i');
    d.className = 'rain';
    d.style.left = `${Math.random() * 100}vw`;
    d.style.background = colors[i % colors.length];
    d.style.animationDelay = `${Math.random() * 0.7}s`;
    d.style.animationDuration = `${1.6 + Math.random() * 1.2}s`;
    d.style.setProperty('--sway', `${(Math.random() - 0.5) * 120}px`);
    if (i % 3 === 0) d.style.borderRadius = '50%';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 3700);
  }
}

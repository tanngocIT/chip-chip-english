// Small, soft sound effects made with the Web Audio API (no files needed).

let ctx: AudioContext | null = null;
let muted = false;

export function unlockAudio() {
  const AC = (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
  if (!AC) return;
  ctx ??= new AC();
  if (ctx!.state === 'suspended') void ctx!.resume();
}

export const setMuted = (m: boolean) => {
  muted = m;
};

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.18, slideTo?: number) {
  if (!ctx || muted) return null;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
  return osc;
}

/** Note names used by the Sing along tune. */
const NOTE: Record<string, number> = { C: 261.63, D: 293.66, E: 329.63, F: 349.23, G: 392.0, A: 440.0 };

/**
 * Play a few notes, one per beat ('-' is a rest), with a soft bass note under the first.
 * Returns a function that silences whatever has not sounded yet (used when the child leaves the screen).
 */
export function playNotes(notes: string[], beat: number): () => void {
  const oscs: OscillatorNode[] = [];
  notes.forEach((n, i) => {
    const f = NOTE[n];
    if (!f) return;
    const o = tone(f * 2, i * beat, beat * 0.9, 'triangle', 0.07);
    if (o) oscs.push(o);
  });
  const first = NOTE[notes[0]];
  if (first) {
    const b = tone(first / 2, 0, beat * notes.length * 0.9, 'sine', 0.06);
    if (b) oscs.push(b);
  }
  return () => {
    for (const o of oscs) {
      try {
        o.stop();
        o.disconnect();
      } catch {
        /* already ended */
      }
    }
  };
}

export const sfx = {
  tap() {
    tone(660, 0, 0.08, 'sine', 0.08, 880);
  },
  right() {
    tone(784, 0, 0.18, 'sine', 0.16);
    tone(988, 0.1, 0.18, 'sine', 0.16);
    tone(1319, 0.2, 0.32, 'sine', 0.14);
  },
  oops() {
    tone(330, 0, 0.22, 'triangle', 0.12, 260);
  },
  star(i = 0) {
    tone(880 + i * 220, 0, 0.25, 'sine', 0.14);
    tone(1760 + i * 440, 0.05, 0.2, 'sine', 0.05);
  },
  sticker() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.28, 'sine', 0.13));
  },
  flip() {
    tone(520, 0, 0.1, 'sine', 0.06, 700);
  },
  listen() {
    tone(600, 0, 0.12, 'sine', 0.1);
    tone(900, 0.1, 0.14, 'sine', 0.1);
  },
};

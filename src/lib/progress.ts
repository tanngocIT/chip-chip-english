// Scoring, word mastery (simple Leitner boxes) and saved progress.

export type Activity = 'learn' | 'listen' | 'match' | 'say';
export type AgeLevel = 'small' | 'middle' | 'big'; // 2–3, 4–5, 6

export interface WordStat {
  box: number; // 0..4, higher = better known
  right: number;
  wrong: number;
  seen: number;
}

export interface Settings {
  age: AgeLevel;
  rate: number; // speech rate
  vietnamese: boolean; // also say the Vietnamese meaning on flashcards
  limitMinutes: number; // 0 = no limit
}

export interface Progress {
  words: Record<string, WordStat>;
  best: Record<string, number>; // `${topic}:${activity}` -> best stars
  stickers: string[];
  settings: Settings;
  minutesToday: { date: string; minutes: number };
}

export const MAX_BOX = 4;

export const defaultSettings = (): Settings => ({
  age: 'small',
  rate: 0.85,
  vietnamese: false,
  limitMinutes: 20,
});

export const emptyProgress = (): Progress => ({
  words: {},
  best: {},
  stickers: [],
  settings: defaultSettings(),
  minutesToday: { date: '', minutes: 0 },
});

/**
 * How many answer pictures and questions a game has for each age group.
 * `rounds` is for Listen and tap / Find the shadow, `sayRounds` for Say it
 * (speaking is more tiring, so it has fewer).
 */
export function levelConfig(age: AgeLevel) {
  switch (age) {
    case 'small':
      return { choices: 2, rounds: 8, sayRounds: 6, learnCount: 10 };
    case 'middle':
      return { choices: 3, rounds: 10, sayRounds: 8, learnCount: 12 };
    case 'big':
      return { choices: 4, rounds: 12, sayRounds: 10, learnCount: 15 };
  }
}

/** Stars from the share of rounds answered right on the first try. Always at least 1. */
export function starsFor(firstTry: number, rounds: number): 1 | 2 | 3 {
  if (rounds <= 0) return 1;
  const r = firstTry / rounds;
  if (r >= 0.85) return 3;
  if (r >= 0.5) return 2;
  return 1;
}

export function stat(p: Progress, id: string): WordStat {
  return p.words[id] ?? { box: 0, right: 0, wrong: 0, seen: 0 };
}

/** Record one answer. firstTry=false means the child needed more than one tap. */
export function recordAnswer(p: Progress, id: string, firstTry: boolean): void {
  const s = { ...stat(p, id) };
  s.seen++;
  if (firstTry) {
    s.right++;
    s.box = Math.min(MAX_BOX, s.box + 1);
  } else {
    s.wrong++;
    s.box = 0;
  }
  p.words[id] = s;
}

export function recordSeen(p: Progress, id: string): void {
  const s = { ...stat(p, id) };
  s.seen++;
  p.words[id] = s;
}

/**
 * Quiz weight: words the child has met but keeps missing come up most,
 * well-known words least. Words never shown yet are possible but less likely,
 * so quizzes mostly ask what Look and listen has already taught.
 */
export const weightOf = (s: WordStat) => (s.seen === 0 ? 0.4 : MAX_BOX + 1 - s.box);

/**
 * Words for one Look and listen round: first words the child keeps missing,
 * then words never shown, then the rest from least to best known.
 * Ties are shuffled so each round feels new.
 */
export function pickLearnSet<T extends { id: string }>(
  pool: T[],
  n: number,
  p: Progress,
  rand: () => number = Math.random,
): T[] {
  const rank = (w: T) => {
    const s = stat(p, w.id);
    if (s.wrong > 0 && s.box <= 1) return 0;
    if (s.seen === 0) return 1;
    return 2 + s.box;
  };
  return shuffle(pool, rand)
    .map((w) => ({ w, r: rank(w) }))
    .sort((a, b) => a.r - b.r)
    .slice(0, n)
    .map((x) => x.w);
}

/**
 * Pick `n` target words, weighted toward words the child knows less,
 * never the same word twice in a row.
 */
export function pickTargets<T extends { id: string }>(
  pool: T[],
  n: number,
  p: Progress,
  rand: () => number = Math.random,
): T[] {
  if (pool.length === 0) return [];
  const out: T[] = [];
  const used = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const prev = out[out.length - 1];
    const candidates = pool.length > 1 ? pool.filter((w) => w !== prev) : pool;
    // discourage repeats within one game
    const weights = candidates.map((w) => weightOf(stat(p, w.id)) / (1 + 2 * (used.get(w.id) ?? 0)));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    let pick = candidates[candidates.length - 1];
    for (let j = 0; j < candidates.length; j++) {
      r -= weights[j];
      if (r <= 0) {
        pick = candidates[j];
        break;
      }
    }
    out.push(pick);
    used.set(pick.id, (used.get(pick.id) ?? 0) + 1);
  }
  return out;
}

/** Target plus distinct distractors from the same pool, shuffled. */
export function choicesFor<T extends { id: string }>(
  target: T,
  pool: T[],
  count: number,
  rand: () => number = Math.random,
): T[] {
  const others = shuffle(
    pool.filter((w) => w.id !== target.id),
    rand,
  ).slice(0, Math.max(0, count - 1));
  return shuffle([target, ...others], rand);
}

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Save best stars; returns true if this beat the previous best. */
export function recordStars(p: Progress, topic: string, activity: Activity, stars: number): boolean {
  const key = `${topic}:${activity}`;
  const prev = p.best[key] ?? 0;
  if (stars > prev) {
    p.best[key] = stars;
    return true;
  }
  return false;
}

/** Give a new sticker the child does not have yet. Returns its id, or null if all collected. */
export function awardSticker(p: Progress, all: string[], rand: () => number = Math.random): string | null {
  const left = all.filter((s) => !p.stickers.includes(s));
  if (left.length === 0) return null;
  const s = left[Math.floor(rand() * left.length)];
  p.stickers.push(s);
  return s;
}

export function topicStars(p: Progress, topic: string): number {
  return (['learn', 'listen', 'match', 'say'] as Activity[]).reduce(
    (sum, a) => sum + (p.best[`${topic}:${a}`] ?? 0),
    0,
  );
}

/** Words with box >= 3 count as learned. */
export function learnedCount(p: Progress, ids: string[]): number {
  return ids.filter((id) => stat(p, id).box >= 3).length;
}

const KEY = 'be-hoc-tieng-anh:v1';

export function load(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): Progress {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as Partial<Progress>;
    const e = emptyProgress();
    return {
      ...e,
      ...parsed,
      settings: { ...e.settings, ...(parsed.settings ?? {}) },
      minutesToday: parsed.minutesToday ?? e.minutesToday,
    };
  } catch {
    return emptyProgress();
  }
}

export function save(p: Progress, storage: Pick<Storage, 'setItem'> | undefined = safeStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage full or blocked: progress just isn't kept */
  }
}

function safeStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Add play time; resets each day. */
export function addMinutes(p: Progress, minutes: number, date = today()): void {
  if (p.minutesToday.date !== date) p.minutesToday = { date, minutes: 0 };
  p.minutesToday.minutes += minutes;
}

export function overLimit(p: Progress, date = today()): boolean {
  const lim = p.settings.limitMinutes;
  if (!lim) return false;
  return p.minutesToday.date === date && p.minutesToday.minutes >= lim;
}

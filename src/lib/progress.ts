// Scoring, word mastery (simple Leitner boxes) and saved progress.

export type Activity = 'learn' | 'listen' | 'match' | 'say' | 'find' | 'sing' | 'memory';
export const ACTIVITY_IDS: Activity[] = ['learn', 'listen', 'match', 'say', 'find', 'sing', 'memory'];
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
  playback: boolean; // play the child's own voice back in Say it
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
  playback: true,
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
 * (speaking is more tiring, so it has fewer). `sceneItems` / `finds` are for
 * Find it (pictures in the scene / how many the child is asked to find),
 * `singCount` is how many words one Sing along has, `pairs` how many pairs Memory has.
 * Sentences is only for the older two groups: `sentenceRounds` is 0 for the youngest.
 */
export function levelConfig(age: AgeLevel) {
  switch (age) {
    case 'small':
      return { choices: 2, rounds: 8, sayRounds: 6, learnCount: 10, sceneItems: 6, finds: 4, singCount: 6, pairs: 3, sentenceRounds: 0, sentenceChoices: 2 };
    case 'middle':
      return { choices: 3, rounds: 10, sayRounds: 8, learnCount: 12, sceneItems: 9, finds: 6, singCount: 8, pairs: 4, sentenceRounds: 6, sentenceChoices: 2 };
    case 'big':
      return { choices: 4, rounds: 12, sayRounds: 10, learnCount: 15, sceneItems: 12, finds: 8, singCount: 8, pairs: 6, sentenceRounds: 8, sentenceChoices: 3 };
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

/**
 * Stars for Memory, from how many times two cards were turned over. Finding pairs is partly
 * luck, so it is generous: up to two turns per pair is 3 stars, up to three is 2 stars.
 */
export function memoryStars(tries: number, pairs: number): 1 | 2 | 3 {
  if (pairs <= 0 || tries <= pairs * 2) return 3;
  if (tries <= pairs * 3) return 2;
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

/** Review needs at least this many words to be worth a game. */
export const REVIEW_MIN = 4;

/**
 * Words for a Review game, from every topic: only words the child has met and does not know
 * well yet (box below 3). Words they keep missing come first, then the least known.
 * The chosen words are shuffled so the hard ones are not all at the start.
 */
export function pickReviewSet<T extends { id: string }>(
  pool: T[],
  n: number,
  p: Progress,
  rand: () => number = Math.random,
): T[] {
  const rank = (w: T) => {
    const s = stat(p, w.id);
    return s.wrong > 0 && s.box <= 1 ? 0 : 1 + s.box;
  };
  const picked = shuffle(pool, rand)
    .filter((w) => {
      const s = stat(p, w.id);
      return s.seen > 0 && s.box < 3;
    })
    .map((w) => ({ w, r: rank(w) }))
    .sort((a, b) => a.r - b.r)
    .slice(0, n)
    .map((x) => x.w);
  return shuffle(picked, rand);
}

/**
 * Topic for the one-tap "today" session: keep going with the topic the child is in the
 * middle of (the one with most words met), else open the next untouched topic,
 * else go back to the topic they know least.
 */
export function pickTodayTopic<T>(topics: T[], idsOf: (t: T) => string[], p: Progress): T {
  const info = topics.map((t) => {
    const ids = idsOf(t);
    const seen = ids.filter((id) => stat(p, id).seen > 0).length;
    const boxes = ids.reduce((sum, id) => sum + stat(p, id).box, 0);
    return { t, seen, total: ids.length, avg: ids.length ? boxes / ids.length : 0 };
  });
  const started = info.filter((x) => x.seen > 0 && x.seen < x.total).sort((a, b) => b.seen - a.seen);
  if (started.length) return started[0].t;
  const fresh = info.find((x) => x.seen === 0);
  if (fresh) return fresh.t;
  return info.slice().sort((a, b) => a.avg - b.avg)[0].t;
}

/**
 * One Find it scene: `items` distinct words to show (shuffled) and which `finds`
 * of them to ask for, in order. Targets are weighted like pickTargets, without repeats.
 */
export function pickScene<T extends { id: string }>(
  pool: T[],
  items: number,
  finds: number,
  p: Progress,
  rand: () => number = Math.random,
): { items: T[]; targets: T[] } {
  const left = pool.slice();
  const targets: T[] = [];
  const nItems = Math.min(items, pool.length);
  const nFinds = Math.min(finds, nItems);
  while (targets.length < nFinds) {
    const weights = left.map((w) => weightOf(stat(p, w.id)));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    let j = left.length - 1;
    for (let k = 0; k < left.length; k++) {
      r -= weights[k];
      if (r <= 0) {
        j = k;
        break;
      }
    }
    targets.push(left.splice(j, 1)[0]);
  }
  const others = shuffle(left, rand).slice(0, nItems - nFinds);
  return { items: shuffle([...targets, ...others], rand), targets };
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
  return ACTIVITY_IDS.reduce(
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

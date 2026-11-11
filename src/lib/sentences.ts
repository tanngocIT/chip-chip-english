// Short sentences for the older children, built from words the app already teaches.
// Every sentence can be shown with the existing pictures: several of one thing,
// two things side by side, or one thing drawn big or small.

import { wordById, nounPhrase, type Word } from './content';
import { shuffle } from './progress';

export type SentenceKind = 'count' | 'pair' | 'size';

export interface ScenePart {
  word: Word;
  /** how many times the picture is drawn */
  n: number;
  size?: 'big' | 'small';
}

export interface Sentence {
  text: string;
  kind: SentenceKind;
  parts: ScenePart[];
}

/** Everyday things with a regular plural ("cats") and a picture that is clear when small. */
export const SENTENCE_NOUNS = ['cat', 'dog', 'duck', 'frog', 'pig', 'cow', 'apple', 'banana', 'egg', 'ball', 'car', 'book'];

const COUNTS: [string, number][] = [
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
];

let cache: Sentence[] | null = null;

/** The fixed list of sentences. It is fixed because each one needs its own voice file. */
export function allSentences(): Sentence[] {
  if (cache) return cache;
  const nouns = SENTENCE_NOUNS.map((id) => wordById(id)).filter(Boolean) as Word[];
  const out: Sentence[] = [];
  for (const w of nouns) {
    for (const [name, n] of COUNTS) {
      out.push({ text: `I see ${name} ${w.word}s.`, kind: 'count', parts: [{ word: w, n }] });
    }
  }
  nouns.forEach((a, i) => {
    for (const step of [1, 5]) {
      const b = nouns[(i + step) % nouns.length];
      out.push({
        text: `I see ${nounPhrase(a)} and ${nounPhrase(b)}.`,
        kind: 'pair',
        parts: [
          { word: a, n: 1 },
          { word: b, n: 1 },
        ],
      });
    }
  });
  for (const w of nouns) {
    for (const size of ['big', 'small'] as const) {
      out.push({ text: `The ${w.word} is ${size}.`, kind: 'size', parts: [{ word: w, n: 1, size }] });
    }
  }
  cache = out;
  return out;
}

/** How much two sentences have in common: a shared word, the same number or the same size. */
function closeness(a: Sentence, b: Sentence): number {
  let score = 0;
  for (const p of a.parts) {
    for (const q of b.parts) {
      if (p.word.id === q.word.id) score++;
      if (a.kind === 'count' && p.n === q.n) score++;
      if (p.size && p.size === q.size) score++;
    }
  }
  return score;
}

/**
 * The target plus wrong pictures of the same kind. Wrong ones that share something with the
 * target come first ("three cats" against "two cats" or "three dogs"), so the child has to
 * understand the whole sentence and not only one word of it.
 */
export function sentenceOptions(target: Sentence, count: number, rand: () => number = Math.random): Sentence[] {
  const sharesWord = (s: Sentence) => s.parts.some((p) => target.parts.some((q) => q.word.id === p.word.id));
  const pool = shuffle(
    allSentences().filter((s) => s.kind === target.kind && s.text !== target.text),
    rand,
  )
    .map((s) => ({ s, c: closeness(target, s) }))
    .sort((a, b) => b.c - a.c)
    .map((x) => x.s);
  // The first wrong picture always shows the same thing ("two cats" for "three cats", a small dog
  // for a big dog), the second one a different thing, so knowing the noun alone is not enough.
  const same = pool.filter(sharesWord);
  const different = pool.filter((s) => !sharesWord(s));
  const others: Sentence[] = [];
  for (let i = 0; others.length < count - 1 && (i < same.length || i < different.length); i++) {
    if (same[i]) others.push(same[i]);
    if (different[i] && others.length < count - 1) others.push(different[i]);
  }
  return shuffle([target, ...others], rand);
}

/** `n` different sentences for one game, the three kinds taking turns. */
export function pickSentences(n: number, rand: () => number = Math.random): Sentence[] {
  const kinds: SentenceKind[] = shuffle(['count', 'pair', 'size'] as SentenceKind[], rand);
  const piles = kinds.map((k) =>
    shuffle(
      allSentences().filter((s) => s.kind === k),
      rand,
    ),
  );
  const out: Sentence[] = [];
  for (let i = 0; out.length < n && piles.some((p) => p.length); i++) {
    const next = piles[i % piles.length].pop();
    if (next) out.push(next);
  }
  return out;
}

// Odd one out: a few pictures from one topic and one that does not belong.
// The child has to know what the things are, not only match a sound to a picture.

import { wordsIn, type Word } from './content';
import { shuffle } from './progress';

/**
 * For each topic, the topics its odd picture may come from. Only pairs that are plainly
 * different are listed: food never meets fruit (both are eaten), nature never meets animals
 * (it has a bee and a butterfly), actions never meet vehicles ("row" shows a boat).
 * Letters and numbers meet each other on purpose: telling them apart is worth learning.
 */
export const ODD_FROM: Record<string, string[]> = {
  animals: ['vehicles', 'fruits', 'food', 'toys'],
  fruits: ['animals', 'vehicles', 'toys'],
  colors: ['animals', 'vehicles'],
  numbers: ['abc', 'animals', 'vehicles'],
  vehicles: ['animals', 'fruits', 'food'],
  body: ['animals', 'vehicles', 'fruits', 'food'],
  family: ['animals', 'vehicles', 'fruits', 'food'],
  food: ['animals', 'vehicles'],
  toys: ['animals', 'fruits'],
  nature: ['vehicles', 'food', 'toys'],
  shapes: ['animals', 'vehicles'],
  feelings: ['animals', 'vehicles', 'fruits'],
  actions: ['animals', 'fruits', 'food'],
  abc: ['numbers', 'shapes'],
};

/** Pictures that sit between two groups (a toy that is an animal), left out of this game. */
const SKIP = new Set(['teddy bear', 'robot', 'chicken leg']);

export interface OddRound {
  /** all the pictures, shuffled */
  options: Word[];
  odd: Word;
}

/** `n` rounds for a topic, each with `choices` pictures. Empty when the topic has no odd topics. */
export function pickOddRounds(topicId: string, n: number, choices: number, rand: () => number = Math.random): OddRound[] {
  const usable = (id: string) => wordsIn(id).filter((w) => !SKIP.has(w.id));
  const own = usable(topicId);
  const from = (ODD_FROM[topicId] ?? []).filter((id) => usable(id).length);
  if (own.length < choices - 1 || !from.length) return [];
  const rounds: OddRound[] = [];
  let deck: Word[] = [];
  let lastOdd = '';
  for (let i = 0; i < n; i++) {
    // deal from a shuffled deck, so every word of the topic turns up before any comes back
    const same: Word[] = [];
    while (same.length < choices - 1) {
      if (!deck.length) deck = shuffle(own, rand);
      const next = deck.pop()!;
      if (!same.includes(next)) same.push(next);
    }
    const pool = shuffle(usable(from[Math.floor(rand() * from.length)]), rand);
    const odd = pool.find((w) => w.id !== lastOdd) ?? pool[0];
    lastOdd = odd.id;
    rounds.push({ options: shuffle([...same, odd], rand), odd });
  }
  return rounds;
}

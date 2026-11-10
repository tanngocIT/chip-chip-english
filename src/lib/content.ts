import data from '../data/words.json';
import stickerNames from '../data/stickers.json';

export interface Topic {
  id: string;
  en: string;
  vi: string;
  icon: string;
  color: string;
}

export type WordKind = 'thing' | 'color' | 'number' | 'person';

export interface Word {
  id: string;
  /** What is spoken and what the child should say. */
  word: string;
  topic: string;
  vi: string;
  img: string;
  kind: WordKind;
  count?: number;
  plural?: boolean;
  mass?: boolean;
  the?: boolean;
}

interface RawWord {
  id: string;
  word?: string;
  topic: string;
  vi: string;
  asset: string;
  kind?: string;
  count?: number;
  plural?: boolean;
  mass?: boolean;
  the?: boolean;
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const base = import.meta.env?.BASE_URL ?? './';

export const imgUrl = (name: string) => `${base}img/${name}.svg`;

export const topics: Topic[] = data.topics;

export const words: Word[] = (data.words as RawWord[]).map((w) => ({
  id: w.id,
  word: w.word ?? w.id,
  topic: w.topic,
  vi: w.vi,
  img: imgUrl(slug(w.asset)),
  kind: (w.kind as WordKind) ?? 'thing',
  count: w.count,
  plural: w.plural,
  mass: w.mass,
  the: w.the,
}));

export const stickers = (stickerNames as string[]).map((s) => ({
  id: slug(s),
  img: `${base}img/stickers/${slug(s)}.svg`,
}));

export const wordsIn = (topicId: string) => words.filter((w) => w.topic === topicId);
export const wordById = (id: string) => words.find((w) => w.id === id);
export const topicById = (id: string) => topics.find((t) => t.id === id);

const startsWithVowelSound = (s: string) => /^[aeiou]/i.test(s);

/** "a cat", "an apple", "the sun", "grapes", "milk", "mom" */
export function nounPhrase(w: Word): string {
  if (w.kind === 'person' || w.plural || w.mass || w.kind === 'color' || w.kind === 'number') {
    return w.word;
  }
  if (w.the) return `the ${w.word}`;
  return `${startsWithVowelSound(w.word) ? 'an' : 'a'} ${w.word}`;
}

/** Sentence spoken on a flashcard after the word itself. */
export function describe(w: Word): string {
  switch (w.kind) {
    case 'color':
      return `It's ${w.word}.`;
    case 'number':
      return `${capitalize(w.word)}!`;
    case 'person':
      return `This is ${w.word}.`;
  }
  if (w.plural) return `They're ${w.word}.`;
  return `It's ${nounPhrase(w)}.`;
}

/** Question for the listen-and-tap game. */
export function question(w: Word): string {
  switch (w.kind) {
    case 'color':
      return `Which one is ${w.word}?`;
    case 'number':
      return `Find ${w.word}.`;
    case 'person':
      return `Where is ${w.word}?`;
  }
  if (w.plural) return `Where are the ${w.word}?`;
  return `Where is the ${w.word}?`;
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

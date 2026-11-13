import data from '../data/words.json';
import stickerNames from '../data/stickers.json';
import stickerArt from '../data/sticker-art.json';

export interface Topic {
  id: string;
  en: string;
  vi: string;
  icon: string;
  color: string;
  /** Pictures in this topic share one outline (faces), so Find the shadow is left out. */
  noShadow?: boolean;
}

export type WordKind = 'thing' | 'color' | 'number' | 'person' | 'job' | 'feeling' | 'action' | 'letter';

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
  /** for a letter: the word it stands for ("apple" for A); the picture is that word's */
  example?: string;
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
  example?: string;
  /** drawn for this app: the picture is public/img/art/<id>.webp instead of the emoji in `asset` */
  art?: boolean;
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const base = import.meta.env?.BASE_URL ?? './';

/** Chip, the things Chip wears, the gift box and the flame are drawn in the app's own style. */
const UI_ART = new Set(['mascot', 'mascot-sleepy', 'look-ribbon', 'look-cap', 'look-glasses', 'look-hat', 'look-crown', 'gift', 'fire']);

export const imgUrl = (name: string) => (UI_ART.has(name) ? `${base}img/art/ui/${name}.webp` : `${base}img/${name}.svg`);

export const topics: Topic[] = data.topics;

const artUrl = (id: string) => `${base}img/art/${slug(id)}.webp`;

/** A letter shows the picture of its example word, in whichever set that word is drawn. */
function pictureOf(w: RawWord): string {
  if (w.art) return artUrl(w.id);
  const example = w.example && (data.words as RawWord[]).find((x) => x.id === w.example);
  return example && example.art ? artUrl(example.id) : imgUrl(slug(w.asset));
}

export const words: Word[] = (data.words as RawWord[]).map((w) => ({
  id: w.id,
  word: w.word ?? w.id,
  topic: w.topic,
  vi: w.vi,
  img: pictureOf(w),
  kind: (w.kind as WordKind) ?? 'thing',
  count: w.count,
  plural: w.plural,
  mass: w.mass,
  the: w.the,
  example: w.example,
}));

/** What Chip says for a sticker, where the picture's own name is not a child's word. */
const STICKER_NAMES: Record<string, string> = {
  'T-rex': 'T-rex',
  Sauropod: 'dinosaur',
  'Spouting whale': 'whale',
  'Lady beetle': 'ladybug',
  'Hatching chick': 'chick',
  'Party popper': 'party',
  Doughnut: 'donut',
  Shortcake: 'cake',
  Hibiscus: 'flower',
  'Four leaf clover': 'clover',
  'Teacup without handle': 'tea',
  'Carousel horse': 'carousel',
};

export const stickers = (stickerNames as string[]).map((s) => ({
  id: slug(s),
  name: STICKER_NAMES[s] ?? s.toLowerCase(),
  // drawn in the app's own style where that picture exists, else the emoji
  img: (stickerArt as string[]).includes(slug(s)) ? `${base}img/art/stickers/${slug(s)}.webp` : `${base}img/stickers/${slug(s)}.svg`,
}));

export const wordsIn = (topicId: string) => words.filter((w) => w.topic === topicId);
export const wordById = (id: string) => words.find((w) => w.id === id);
export const topicById = (id: string) => topics.find((t) => t.id === id);

const startsWithVowelSound = (s: string) => /^[aeiou]/i.test(s);

/** "a cat", "an apple", "the sun", "grapes", "milk", "mom" */
export function nounPhrase(w: Word): string {
  // a job takes an article like any thing ("a doctor"); a family name does not ("mom")
  if ((w.kind !== 'thing' && w.kind !== 'job') || w.plural || w.mass) {
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
    case 'job':
      return `This is ${nounPhrase(w)}.`;
    case 'letter':
      return `${w.word} is for ${w.example}.`;
    case 'feeling':
      return `I am ${w.word}.`;
    case 'action':
      return `I can ${w.word}.`;
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
    case 'letter':
      return `Find the letter ${w.word}.`;
    case 'feeling':
      return `Who is ${w.word}?`;
    case 'action':
      return `Who can ${w.word}?`;
  }
  if (w.plural) return `Where are the ${w.word}?`;
  return `Where is the ${w.word}?`;
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

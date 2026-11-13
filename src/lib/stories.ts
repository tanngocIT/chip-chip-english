// Picture stories for the older children: four short sentences that follow each other,
// each shown with pictures the app already has, then two questions about the story.
// The list is fixed because every line needs its own voice file.

import { wordById, type Word } from './content';
import { shuffle } from './progress';

export interface StoryPage {
  text: string;
  pics: Word[];
}

export interface StoryQuestion {
  text: string;
  answer: Word;
  /** wrong pictures, the most tempting first */
  wrong: Word[];
}

export interface Story {
  id: string;
  title: string;
  cover: Word;
  pages: StoryPage[];
  questions: StoryQuestion[];
}

interface RawStory {
  id: string;
  title: string;
  cover: string;
  pages: [string, string[]][];
  questions: [string, string, string[]][];
}

const RAW: RawStory[] = [
  {
    id: 'hungry-cat',
    title: 'The hungry cat',
    cover: 'cat',
    pages: [
      ['The cat is hungry.', ['cat', 'hungry']],
      ['The cat sees milk.', ['milk']],
      ['The cat drinks the milk.', ['cat', 'milk']],
      ['Now the cat is happy.', ['cat', 'happy']],
    ],
    questions: [
      ['What does the cat drink?', 'milk', ['cake', 'apple']],
      ['Is the cat happy or sad?', 'happy', ['sad', 'angry']],
    ],
  },
  {
    id: 'frog-rain',
    title: 'The frog and the rain',
    cover: 'frog',
    pages: [
      ['The sun is hot.', ['sun']],
      ['The frog is sad.', ['frog', 'sad']],
      ['Look! It is raining.', ['rain']],
      ['Now the frog is happy.', ['frog', 'happy']],
    ],
    questions: [
      ['Who is in the story?', 'frog', ['dog', 'pig']],
      ['What makes the frog happy?', 'rain', ['sun', 'snow']],
    ],
  },
  {
    id: 'bear-bed',
    title: 'Good night, bear',
    cover: 'bear',
    pages: [
      ['The moon is in the sky.', ['moon', 'star']],
      ['The bear is sleepy.', ['bear', 'sleepy']],
      ['The bear goes to bed.', ['bear', 'bed']],
      ['Good night, bear!', ['bed', 'moon']],
    ],
    questions: [
      ['Who is sleepy?', 'bear', ['lion', 'monkey']],
      ['Where does the bear sleep?', 'bed', ['car', 'tree']],
    ],
  },
  {
    id: 'monkey-banana',
    title: 'The monkey and the banana',
    cover: 'monkey',
    pages: [
      ['The monkey is hungry.', ['monkey', 'hungry']],
      ['It sees a banana in the tree.', ['banana', 'tree']],
      ['The monkey can climb the tree.', ['monkey', 'tree']],
      ['Yum! The monkey eats the banana.', ['monkey', 'banana']],
    ],
    questions: [
      ['What does the monkey eat?', 'banana', ['apple', 'egg']],
      ['Where is the banana?', 'tree', ['house', 'boat']],
    ],
  },
  {
    id: 'little-duck',
    title: 'The little duck',
    cover: 'duck',
    pages: [
      ['The duck can swim.', ['duck', 'wave']],
      ['The duck sees a boat.', ['duck', 'boat']],
      ['A dog is on the boat.', ['dog', 'boat']],
      ['The duck and the dog are friends.', ['duck', 'dog']],
    ],
    questions: [
      ['Who is on the boat?', 'dog', ['cat', 'cow']],
      ['What does the duck see?', 'boat', ['bus', 'train']],
    ],
  },
  {
    id: 'birthday-gift',
    title: 'The birthday gift',
    cover: 'gift',
    pages: [
      ['Today is my birthday.', ['cake']],
      ['I have a balloon.', ['balloon']],
      ['Mom gives me a gift.', ['mom', 'gift']],
      ['It is a teddy bear! I am happy.', ['teddy bear', 'happy']],
    ],
    questions: [
      ['What is the gift?', 'teddy bear', ['ball', 'kite']],
      ['Who gives me the gift?', 'mom', ['dad', 'grandma']],
    ],
  },
];

const need = (id: string): Word => {
  const w = wordById(id);
  if (!w) throw new Error(`story uses an unknown word: ${id}`);
  return w;
};

export const stories: Story[] = RAW.map((s) => ({
  id: s.id,
  title: s.title,
  cover: need(s.cover),
  pages: s.pages.map(([text, pics]) => ({ text, pics: pics.map(need) })),
  questions: s.questions.map(([text, answer, wrong]) => ({ text, answer: need(answer), wrong: wrong.map(need) })),
}));

/** What Chip says when a story opens. Three words or more, so the clip is spoken whole. */
export const spokenTitle = (s: Story) => `${s.title}.`;

/** The answer and `count - 1` wrong pictures, shuffled. */
export function questionOptions(q: StoryQuestion, count: number, rand: () => number = Math.random): Word[] {
  return shuffle([q.answer, ...q.wrong.slice(0, Math.max(1, count - 1))], rand);
}

/** Every line a story needs a voice file for. */
export function storyPhrases(): string[] {
  return stories.flatMap((s) => [spokenTitle(s), ...s.pages.map((p) => p.text), ...s.questions.map((q) => q.text)]);
}

// Off-screen challenges: after a Play session Chip asks the child to do something away from
// the screen with the words of that topic ("Find something red!", "Touch your nose!").
// The list is fixed because every line needs its own voice file.

import { wordById, nounPhrase, type Word } from './content';
import { stat, type Progress } from './progress';

export interface Challenge {
  /** what Chip says, in English */
  text: string;
  /** one line for the grown-up beside the child */
  vi: string;
  topic: string;
  /** the word it practises; its picture is shown */
  word?: Word;
}

const NUMBER_NAMES = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

// [word id, English, Vietnamese]
const BODY: [string, string, string][] = [
  ['nose', 'Touch your nose!', 'Bé chạm vào mũi.'],
  ['ear', 'Touch your ear!', 'Bé chạm vào tai.'],
  ['leg', 'Touch your leg!', 'Bé chạm vào chân.'],
  ['arm', 'Touch your arm!', 'Bé chạm vào cánh tay.'],
  ['foot', 'Touch your foot!', 'Bé chạm vào bàn chân.'],
  ['hand', 'Show me your hand!', 'Bé giơ bàn tay lên.'],
  ['tongue', 'Show me your tongue!', 'Bé lè lưỡi.'],
  ['finger', 'Show me your finger!', 'Bé giơ một ngón tay.'],
  ['thumb', 'Show me your thumb!', 'Bé giơ ngón cái.'],
  ['mouth', 'Open your mouth!', 'Bé há miệng.'],
  ['eye', 'Close your eyes!', 'Bé nhắm mắt.'],
  ['tooth', 'Show me your teeth!', 'Bé nhe răng.'],
];

const ANIMAL_SOUNDS = ['cat', 'dog', 'cow', 'pig', 'duck', 'chicken', 'sheep', 'horse', 'lion', 'frog', 'bird', 'snake'];
const ANIMAL_MOVES: [string, string, string][] = [
  ['rabbit', 'jump', 'nhảy'],
  ['kangaroo', 'jump', 'nhảy'],
  ['frog', 'jump', 'nhảy'],
  ['penguin', 'walk', 'đi'],
  ['elephant', 'walk', 'đi'],
  ['crab', 'walk', 'đi'],
];

const ACTIONS = ['run', 'walk', 'dance', 'sleep', 'sit', 'stand', 'clap', 'hug'];
const FEELINGS = ['happy', 'sad', 'angry', 'scared', 'sleepy', 'surprised', 'silly'];
const SHAPES = ['circle', 'square', 'triangle', 'rectangle', 'star-shape', 'heart-shape'];
const HOME_THINGS = ['ball', 'book', 'pencil', 'chair', 'door', 'clock', 'key', 'shoe', 'hat', 'spoon', 'window', 'toothbrush'];

// topics whose words are not things a child can fetch or act out: a few open tasks instead
const GENERAL: [string, string, string][] = [
  ['fruits', 'What fruit do you like?', 'Hỏi bé thích quả gì, khuyến khích bé nói tên quả bằng tiếng Anh.'],
  ['fruits', 'Find a fruit in the kitchen!', 'Bé tìm một loại quả trong bếp.'],
  ['food', 'What do you like to eat?', 'Hỏi bé thích ăn gì, khuyến khích bé trả lời bằng tiếng Anh.'],
  ['food', 'What do you like to drink?', 'Hỏi bé thích uống gì, khuyến khích bé trả lời bằng tiếng Anh.'],
  ['vehicles', 'Find something with wheels!', 'Bé tìm một vật có bánh xe.'],
  ['vehicles', 'Can you fly like an airplane?', 'Bé dang tay giả làm máy bay.'],
  ['vehicles', 'Find a toy car!', 'Bé tìm một chiếc xe đồ chơi.'],
  ['nature', 'Go to the window. What do you see?', 'Bé ra cửa sổ và kể những gì bé thấy.'],
  ['nature', 'Can you find a flower?', 'Bé tìm một bông hoa (hoa thật hoặc hình vẽ).'],
  ['nature', 'Can you find a tree?', 'Bé tìm một cái cây (nhìn qua cửa sổ cũng được).'],
  ['family', 'Give someone a big hug!', 'Bé ôm một người trong nhà.'],
  ['family', 'Give someone a high five!', 'Bé đập tay với một người trong nhà.'],
  ['family', 'Say hello to your family!', 'Bé nói "Hello" với người trong nhà.'],
  ['abc', 'Find a letter in a book!', 'Bé tìm một chữ cái trong sách hoặc trên đồ vật.'],
  ['abc', 'Sing the alphabet song!', 'Bé hát bài hát chữ cái (ABC).'],
  ['abc', 'Can you say your name?', 'Bé nói tên mình.'],
];

let cache: Challenge[] | null = null;

/** Every challenge. Fixed, because each one needs a voice file. */
export function allChallenges(): Challenge[] {
  if (cache) return cache;
  const out: Challenge[] = [];
  const add = (id: string, text: string, vi: string) => {
    const word = wordById(id);
    if (word) out.push({ text, vi, topic: word.topic, word });
  };
  for (const id of ['red', 'blue', 'green', 'yellow', 'orange-color', 'purple', 'pink', 'brown', 'black', 'white', 'gray', 'light blue']) {
    const w = wordById(id);
    if (w) add(id, `Find something ${w.word}!`, `Bé tìm một vật ${w.vi} quanh nhà.`);
  }
  NUMBER_NAMES.forEach((name, i) => add(name, `Show me ${name} ${i ? 'fingers' : 'finger'}!`, `Bé giơ ${i + 1} ngón tay.`));
  for (const name of NUMBER_NAMES.slice(1, 5)) add(name, `Clap ${name} times!`, `Bé vỗ tay ${NUMBER_NAMES.indexOf(name) + 1} lần.`);
  for (const [id, text, vi] of BODY) add(id, text, vi);
  for (const id of ANIMAL_SOUNDS) {
    const w = wordById(id);
    if (w) add(id, `What does the ${w.word} say?`, `Bé bắt chước tiếng kêu của ${w.vi}.`);
  }
  for (const [id, verb, viVerb] of ANIMAL_MOVES) {
    const w = wordById(id);
    if (w) add(id, `Can you ${verb} like ${nounPhrase(w)}?`, `Bé ${viVerb} giống ${w.vi}.`);
  }
  for (const id of ACTIONS) {
    const w = wordById(id);
    if (w) add(id, `Can you ${w.word}?`, `Bé làm động tác: ${w.vi}.`);
  }
  for (const id of FEELINGS) {
    const w = wordById(id);
    if (w) add(id, `Show me ${nounPhrase({ ...w, kind: 'thing' })} face!`, `Bé làm mặt ${w.vi}.`);
  }
  for (const id of SHAPES) {
    const w = wordById(id);
    if (w) add(id, `Find ${nounPhrase(w)}!`, `Bé tìm một vật có ${w.vi} quanh nhà.`);
  }
  for (const id of HOME_THINGS) {
    const w = wordById(id);
    if (w) add(id, `Find ${nounPhrase(w)}!`, `Bé tìm ${w.vi} trong nhà.`);
  }
  for (const [topic, text, vi] of GENERAL) out.push({ text, vi, topic });
  cache = out;
  return out;
}

/**
 * A challenge for a topic. One whose word the child has already met comes first, so the task
 * uses a word they have just heard; `not` is the last one given, so it does not repeat.
 */
export function pickChallenge(topicId: string, p: Progress, not = '', rand: () => number = Math.random): Challenge | null {
  const all = allChallenges().filter((c) => c.topic === topicId);
  if (!all.length) return null;
  const fresh = all.filter((c) => c.text !== not);
  const pool = fresh.length ? fresh : all;
  const met = pool.filter((c) => !c.word || stat(p, c.word.id).seen > 0);
  const from = met.length ? met : pool;
  return from[Math.floor(rand() * from.length)];
}

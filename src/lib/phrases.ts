import { words, topics, stickers, describe, question } from './content';
import { allSentences } from './sentences';
import { allChallenges } from './challenges';
import { storyPhrases } from './stories';

/** Câu cố định app đọc (ngoài từ, câu mô tả và câu hỏi sinh từ words.json). */
export const FIXED_PHRASES = [
  "Hi! I'm Chip. Let's play!",
  'Hello!',
  'Pick a picture!',
  'My stickers',
  'Which one fits the shadow?',
  'Well done!',
  'Try again.',
  'Great job!',
  'Good try!',
  'Can you say',
  'Good try! Let’s play again!',
  'A new sticker for you!',
  'Time to rest.',
  'See you later!',
  'Where is the cat?',
  "Let's play!",
  "Let's play again!",
  // things Chip can wear (hat and crown already have a clip)
  'ribbon',
  'cap',
  'glasses',
  'My words',
  'My picture',
  'Which one is different?',
  'Now it is your turn!',
  "Let's read a story!",
];

/** Mọi câu tiếng Anh cần có file âm thanh. Dùng cho script sinh giọng. */
export function allPhrases(): string[] {
  const set = new Set<string>(FIXED_PHRASES);
  for (const t of topics) set.add(t.en);
  for (const w of words) {
    set.add(w.word);
    set.add(describe(w));
    set.add(question(w));
  }
  for (const s of stickers) set.add(s.name);
  for (const s of allSentences()) set.add(s.text);
  for (const c of allChallenges()) set.add(c.text);
  for (const line of storyPhrases()) set.add(line);
  return [...set];
}

/** Tên file (không có đuôi) cho một câu. Phải khớp giữa script sinh và app. */
export function phraseKey(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  // Dấu cuối câu làm ngữ điệu khác đi ("One" và "One!"), nên tách thành file riêng.
  const end = text.trim().slice(-1);
  const suffix = end === '!' ? '_e' : end === '?' ? '_q' : end === '.' ? '_p' : '';
  return (base || 'x') + suffix;
}

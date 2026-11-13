import { describe as group, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  starsFor,
  recordAnswer,
  emptyProgress,
  pickTargets,
  choicesFor,
  awardSticker,
  recordStars,
  levelConfig,
  load,
  save,
  addMinutes,
  overLimit,
  stat,
  pickLearnSet,
  recordSeen,
  pickScene,
  pickReviewSet,
  pickTodayTopic,
  REVIEW_MIN,
  memoryStars,
  isDue,
  weightOf,
  weekReport,
  dueCount,
  INTERVAL_DAYS,
  markDay,
  currentStreak,
  LOOKS,
  unlockedLooks,
  exportCode,
  importCode,
  topicStars,
} from './progress';
import { passes, scoreHeard, levenshtein } from './match';
import { words, topics, wordsIn, nounPhrase, describe, question, stickers } from './content';
import { viNumber } from './vi';
import { isIos, isStandalone } from './install';
import { nextInDirection } from './focus';
import { allSentences, sentenceOptions, pickSentences, SENTENCE_NOUNS, type Sentence } from './sentences';
import { pickOddRounds, ODD_FROM } from './odd';
import { allChallenges, pickChallenge } from './challenges';
import { stories, questionOptions, storyPhrases } from './stories';
import { cleanScene, SCENE_MAX, ACTIVITY_IDS } from './progress';

const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

group('content', () => {
  it('every word has a picture file', () => {
    for (const w of words) {
      const file = path.join(process.cwd(), 'public', w.img.replace(/^\.?\/*/, ''));
      expect(fs.existsSync(file), `${w.id} -> ${file}`).toBe(true);
    }
    for (const s of stickers) {
      const file = path.join(process.cwd(), 'public', s.img.replace(/^\.?\/*/, ''));
      expect(fs.existsSync(file), s.id).toBe(true);
    }
  });

  it('ids are unique and every topic has enough words for 4 choices', () => {
    expect(new Set(words.map((w) => w.id)).size).toBe(words.length);
    for (const t of topics) expect(wordsIn(t.id).length, t.id).toBeGreaterThanOrEqual(12);
    expect(words.length).toBeGreaterThan(280);
  });

  it('builds natural phrases', () => {
    const w = (id: string) => words.find((x) => x.id === id)!;
    expect(nounPhrase(w('cat'))).toBe('a cat');
    expect(nounPhrase(w('apple'))).toBe('an apple');
    expect(nounPhrase(w('umbrella'))).toBe('an umbrella');
    expect(describe(w('sun'))).toBe("It's the sun.");
    expect(describe(w('grapes'))).toBe("They're grapes.");
    expect(describe(w('milk'))).toBe("It's milk.");
    expect(describe(w('mom'))).toBe('This is mom.');
    // family names stand alone, jobs take an article
    expect(question(w('mom'))).toBe('Where is mom?');
    expect(describe(w('doctor'))).toBe('This is a doctor.');
    expect(describe(w('artist'))).toBe('This is an artist.');
    expect(question(w('scientist'))).toBe('Where is the scientist?');
    expect(describe(w('baby'))).toBe('This is a baby.');
    expect(describe(w('red'))).toBe("It's red.");
    expect(describe(w('three'))).toBe('Three!');
    expect(question(w('grapes'))).toBe('Where are the grapes?');
    expect(question(w('orange-color'))).toBe('Which one is orange?');
    expect(question(w('five'))).toBe('Find five.');
  });
});

group('scoring', () => {
  it('gives at least one star, three for near-perfect', () => {
    expect(starsFor(0, 5)).toBe(1);
    expect(starsFor(3, 6)).toBe(2);
    expect(starsFor(5, 6)).toBe(2);
    expect(starsFor(5, 5)).toBe(3);
    expect(starsFor(7, 8)).toBe(3);
  });

  it('moves words between boxes', () => {
    const p = emptyProgress();
    recordAnswer(p, 'cat', true);
    recordAnswer(p, 'cat', true);
    expect(stat(p, 'cat').box).toBe(2);
    recordAnswer(p, 'cat', false);
    expect(stat(p, 'cat').box).toBe(0);
    expect(stat(p, 'cat').wrong).toBe(1);
  });

  it('keeps best stars only', () => {
    const p = emptyProgress();
    expect(recordStars(p, 'animals', 'listen', 2)).toBe(true);
    expect(recordStars(p, 'animals', 'listen', 1)).toBe(false);
    expect(p.best['animals:listen']).toBe(2);
  });

  it('level config matches age', () => {
    expect(levelConfig('small').choices).toBe(2);
    expect(levelConfig('big').choices).toBe(4);
    for (const a of ['small', 'middle', 'big'] as const) {
      const c = levelConfig(a);
      expect(c.rounds).toBeGreaterThanOrEqual(8);
      expect(c.sayRounds).toBeLessThan(c.rounds);
    }
  });
});

group('picking', () => {
  const pool = wordsIn('animals');

  it('never repeats a word back to back', () => {
    const p = emptyProgress();
    const t = pickTargets(pool, 40, p, seeded(7));
    for (let i = 1; i < t.length; i++) expect(t[i].id).not.toBe(t[i - 1].id);
  });

  it('prefers words the child keeps missing', () => {
    const p = emptyProgress();
    for (const w of pool) for (let i = 0; i < 4; i++) recordAnswer(p, w.id, true);
    recordAnswer(p, 'frog', false);
    const t = pickTargets(pool, 400, p, seeded(3));
    const frog = t.filter((w) => w.id === 'frog').length;
    expect(frog).toBeGreaterThan(400 / pool.length);
  });

  it('learn rounds put missed words first, then new ones, and vary', () => {
    const p = emptyProgress();
    const ids = pool.map((w) => w.id);
    for (const id of ids.slice(0, 10)) for (let i = 0; i < 3; i++) recordAnswer(p, id, true);
    recordAnswer(p, 'frog', false);
    const set = pickLearnSet(pool, 6, p, seeded(5));
    expect(set.length).toBe(6);
    expect(set[0].id).toBe('frog');
    const known = new Set(ids.slice(0, 10).filter((id) => id !== 'frog'));
    expect(set.slice(1).every((w) => !known.has(w.id))).toBe(true);
    const other = pickLearnSet(pool, 6, p, seeded(99));
    expect(other.map((w) => w.id).join()).not.toBe(set.map((w) => w.id).join());
  });

  it('quizzes favour words already shown', () => {
    const p = emptyProgress();
    for (const w of pool.slice(0, 6)) recordSeen(p, w.id);
    const r = seeded(9);
    let seen = 0;
    for (let g = 0; g < 100; g++) seen += pickTargets(pool, 10, p, r).filter((w) => p.words[w.id]).length;
    const seenShare = seen / 1000;
    expect(seenShare).toBeGreaterThan(0.5);
  });

  it('choices contain the target once and are distinct', () => {
    const r = seeded(11);
    for (let i = 0; i < 50; i++) {
      const target = pool[i % pool.length];
      const c = choicesFor(target, pool, 4, r);
      expect(c.length).toBe(4);
      expect(c.filter((x) => x.id === target.id).length).toBe(1);
      expect(new Set(c.map((x) => x.id)).size).toBe(4);
    }
  });

  it('awards each sticker once', () => {
    const p = emptyProgress();
    const all = ['a', 'b', 'c'];
    const got = [awardSticker(p, all), awardSticker(p, all), awardSticker(p, all), awardSticker(p, all)];
    expect(new Set(got.slice(0, 3)).size).toBe(3);
    expect(got[3]).toBeNull();
  });
});

group('saving and limits', () => {
  it('round-trips through storage and fills new settings', () => {
    const mem: Record<string, string> = {};
    const st = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => (mem[k] = v) };
    const p = emptyProgress();
    p.stickers.push('fox');
    save(p, st);
    const raw = JSON.parse(Object.values(mem)[0]);
    delete raw.settings.rate;
    mem[Object.keys(mem)[0]] = JSON.stringify(raw);
    const back = load(st);
    expect(back.stickers).toEqual(['fox']);
    expect(back.settings.rate).toBe(0.85);
  });

  it('survives broken storage', () => {
    expect(load({ getItem: () => '{oops' }).stickers).toEqual([]);
  });

  it('counts minutes per day', () => {
    const p = emptyProgress();
    p.settings.limitMinutes = 2;
    addMinutes(p, 1, '2026-11-10');
    expect(overLimit(p, '2026-11-10')).toBe(false);
    addMinutes(p, 1, '2026-11-10');
    expect(overLimit(p, '2026-11-10')).toBe(true);
    expect(overLimit(p, '2026-11-11')).toBe(false);
    addMinutes(p, 1, '2026-11-11');
    expect(p.minutesToday.minutes).toBe(1);
  });
});

group('speech matching', () => {
  it('accepts the word inside a sentence', () => {
    expect(passes('cat', ["it's a cat"])).toBe(true);
    expect(passes('teddy bear', ['teddy bear'])).toBe(true);
  });

  it('accepts sound-alikes and digits', () => {
    expect(passes('two', ['2'])).toBe(true);
    expect(passes('four', ['for'])).toBe(true);
    expect(passes('eye', ['I'])).toBe(true);
    expect(passes('mom', ['mommy'])).toBe(true);
  });

  it('accepts close misspellings, rejects other words', () => {
    expect(passes('elephant', ['elefant'])).toBe(true);
    expect(passes('watermelon', ['water melon'])).toBe(true);
    expect(passes('elephant', ['banana'])).toBe(false);
    expect(passes('cat', [''])).toBe(false);
    expect(passes('dog', ['pizza'])).toBe(false);
  });

  it('uses the best alternative', () => {
    expect(passes('rabbit', ['ribbit', 'habit', 'rabbit'])).toBe(true);
    expect(scoreHeard('cat', 'cats')).toBeGreaterThan(0.9);
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});

group('grown-ups gate', () => {
  it('writes numbers in Vietnamese', () => {
    expect(viNumber(10)).toBe('mười');
    expect(viNumber(15)).toBe('mười lăm');
    expect(viNumber(21)).toBe('hai mươi mốt');
    expect(viNumber(34)).toBe('ba mươi tư');
    expect(viNumber(45)).toBe('bốn mươi lăm');
    expect(viNumber(70)).toBe('bảy mươi');
    expect(viNumber(99)).toBe('chín mươi chín');
  });
});

group('find it scene', () => {
  it('shows distinct pictures and asks only for ones in the scene, without repeats', () => {
    for (const t of topics) {
      for (const a of ['small', 'middle', 'big'] as const) {
        const c = levelConfig(a);
        const pool = wordsIn(t.id);
        const { items, targets } = pickScene(pool, c.sceneItems, c.finds, emptyProgress(), seeded(3));
        expect(items.length, t.id).toBe(c.sceneItems);
        expect(new Set(items.map((w) => w.id)).size).toBe(items.length);
        expect(targets.length).toBe(c.finds);
        expect(new Set(targets.map((w) => w.id)).size).toBe(targets.length);
        for (const w of targets) expect(items).toContain(w);
      }
    }
  });

  it('copes with a pool smaller than the scene', () => {
    const pool = wordsIn('animals').slice(0, 3);
    const { items, targets } = pickScene(pool, 6, 4, emptyProgress(), seeded(5));
    expect(items.length).toBe(3);
    expect(targets.length).toBe(3);
    expect(pickScene([], 6, 4, emptyProgress()).targets).toEqual([]);
  });

  it('asks for words the child keeps missing before well-known ones', () => {
    const pool = wordsIn('animals');
    const p = emptyProgress();
    for (const w of pool) for (let i = 0; i < 4; i++) recordAnswer(p, w.id, true);
    recordAnswer(p, 'cat', false);
    let hits = 0;
    for (let s = 1; s <= 200; s++) if (pickScene(pool, 6, 4, p, seeded(s)).targets.some((w) => w.id === 'cat')) hits++;
    expect(hits).toBeGreaterThan(60); // chance alone would be about 20 of 200
  });

  it('new games count toward topic stars', () => {
    const p = emptyProgress();
    recordStars(p, 'animals', 'find', 3);
    recordStars(p, 'animals', 'sing', 3);
    recordStars(p, 'animals', 'listen', 2);
    expect(topicStars(p, 'animals')).toBe(8);
  });
});

group('install prompt', () => {
  it('tells iPhone and iPad apart from other devices', () => {
    expect(isIos({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' })).toBe(true);
    expect(isIos({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(isIos({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(isIos({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' })).toBe(false);
  });

  it('knows when it already runs as an installed app', () => {
    const win = (mode: string, standalone = false) => ({
      navigator: { standalone },
      matchMedia: (q: string) => ({ matches: q === `(display-mode: ${mode})` }),
    });
    expect(isStandalone(win('browser'))).toBe(false);
    expect(isStandalone(win('fullscreen'))).toBe(true);
    expect(isStandalone(win('standalone'))).toBe(true);
    expect(isStandalone(win('browser', true))).toBe(true);
    expect(isStandalone({})).toBe(false);
  });
});

group('review', () => {
  it('only asks words the child has met and does not know well yet', () => {
    const p = emptyProgress();
    expect(pickReviewSet(words, 8, p)).toEqual([]);
    recordSeen(p, 'cat'); // met on a flashcard, never answered
    recordAnswer(p, 'apple', false); // missed
    recordAnswer(p, 'bus', true); // box 1
    for (let i = 0; i < 4; i++) recordAnswer(p, 'dog', true); // well known
    const ids = pickReviewSet(words, 8, p, seeded(2)).map((w) => w.id).sort();
    expect(ids).toEqual(['apple', 'bus', 'cat']);
    expect(ids.length).toBeLessThan(REVIEW_MIN);
  });

  it('mixes topics, never repeats, and keeps the missed words when there are too many', () => {
    const p = emptyProgress();
    for (const w of words.slice(0, 60)) recordSeen(p, w.id);
    const missed = ['sun', 'red', 'three', 'bus', 'nose'];
    for (const id of missed) recordAnswer(p, id, false);
    for (let s = 1; s <= 20; s++) {
      const set = pickReviewSet(words, 8, p, seeded(s));
      expect(set.length).toBe(8);
      expect(new Set(set.map((w) => w.id)).size).toBe(8);
      for (const id of missed) expect(set.map((w) => w.id)).toContain(id);
      expect(new Set(set.map((w) => w.topic)).size).toBeGreaterThan(1);
    }
  });
});

group('today session', () => {
  const idsOf = (t: { id: string }) => wordsIn(t.id).map((w) => w.id);

  it('starts with the first topic for a new child', () => {
    expect(pickTodayTopic(topics, idsOf, emptyProgress()).id).toBe(topics[0].id);
  });

  it('keeps going with the topic the child is in the middle of', () => {
    const p = emptyProgress();
    for (const id of idsOf(topics[0])) recordSeen(p, id); // first topic fully met
    for (const id of idsOf(topics[3]).slice(0, 5)) recordSeen(p, id);
    for (const id of idsOf(topics[5]).slice(0, 2)) recordSeen(p, id);
    expect(pickTodayTopic(topics, idsOf, p).id).toBe(topics[3].id);
  });

  it('opens the next new topic when nothing is half done', () => {
    const p = emptyProgress();
    for (const id of idsOf(topics[0])) recordSeen(p, id);
    expect(pickTodayTopic(topics, idsOf, p).id).toBe(topics[1].id);
  });

  it('returns to the least known topic once everything has been met', () => {
    const p = emptyProgress();
    for (const t of topics) for (const id of idsOf(t)) for (let i = 0; i < 3; i++) recordAnswer(p, id, true);
    for (const id of idsOf(topics[6])) recordAnswer(p, id, false);
    expect(pickTodayTopic(topics, idsOf, p).id).toBe(topics[6].id);
  });
});

group('new topics', () => {
  const w = (id: string) => words.find((x) => x.id === id)!;

  it('feelings and actions get their own sentences', () => {
    expect(describe(w('happy'))).toBe('I am happy.');
    expect(question(w('happy'))).toBe('Who is happy?');
    expect(describe(w('run'))).toBe('I can run.');
    expect(question(w('run'))).toBe('Who can run?');
    expect(nounPhrase(w('sad'))).toBe('sad');
  });

  it('shapes are ordinary nouns, and the two shared words keep their spoken form', () => {
    expect(describe(w('circle'))).toBe("It's a circle.");
    expect(describe(w('oval'))).toBe("It's an oval.");
    expect(question(w('triangle'))).toBe('Where is the triangle?');
    expect(w('star-shape').word).toBe('star');
    expect(w('heart-shape').word).toBe('heart');
  });

  it('only the feelings topic hides Find the shadow, and no topic has two words that sound the same', () => {
    expect(topics.filter((t) => t.noShadow).map((t) => t.id)).toEqual(['feelings']);
    for (const t of topics) {
      const spoken = wordsIn(t.id).map((x) => x.word);
      expect(new Set(spoken).size, t.id).toBe(spoken.length);
    }
  });
});

group('memory', () => {
  it('is generous with stars and always gives at least one', () => {
    expect(memoryStars(3, 3)).toBe(3);
    expect(memoryStars(6, 3)).toBe(3);
    expect(memoryStars(7, 3)).toBe(2);
    expect(memoryStars(9, 3)).toBe(2);
    expect(memoryStars(10, 3)).toBe(1);
    expect(memoryStars(99, 6)).toBe(1);
  });

  it('has an even deck that fits every topic at every age', () => {
    for (const a of ['small', 'middle', 'big'] as const) {
      const { pairs } = levelConfig(a);
      for (const t of topics) {
        const chosen = pickScene(wordsIn(t.id), pairs, pairs, emptyProgress(), seeded(4)).targets;
        expect(new Set(chosen.map((w) => w.id)).size, t.id).toBe(pairs);
      }
    }
  });
});

group('sticker names', () => {
  it('every sticker has a short spoken name and keeps its saved id', () => {
    expect(stickers.length).toBe(31);
    for (const s of stickers) expect(s.name, s.id).toMatch(/^[A-Za-z][a-z -]+$/);
    const byId = Object.fromEntries(stickers.map((s) => [s.id, s.name]));
    // ids are stored in the child's progress, so they must never change
    expect(byId['unicorn']).toBe('unicorn');
    expect(byId['spouting-whale']).toBe('whale');
    expect(byId['lady-beetle']).toBe('ladybug');
    expect(byId['teacup-without-handle']).toBe('tea');
    expect(byId['t-rex']).toBe('T-rex');
  });
});

group('sentences', () => {
  const all = allSentences();
  // what the child sees: two sentences with the same key would draw the same picture
  const look = (s: Sentence) =>
    s.kind + ':' + s.parts.map((p) => `${p.word.id}x${p.n}${p.size ?? ''}`).sort().join('+');

  it('builds a fixed list of natural sentences from words that exist', () => {
    for (const id of SENTENCE_NOUNS) expect(words.some((w) => w.id === id), id).toBe(true);
    expect(all.length).toBe(SENTENCE_NOUNS.length * 8);
    expect(new Set(all.map((s) => s.text)).size).toBe(all.length);
    expect(new Set(all.map(look)).size).toBe(all.length);
    const texts = all.map((s) => s.text);
    expect(texts).toContain('I see three cats.');
    expect(texts).toContain('I see a cat and a dog.');
    expect(texts).toContain('I see an apple and a banana.');
    expect(texts).toContain('The ball is big.');
    expect(texts).toContain('The egg is small.');
  });

  it('offers the right picture once, among different pictures of the same kind', () => {
    for (const s of all) {
      for (const n of [2, 3]) {
        const opts = sentenceOptions(s, n, seeded(all.indexOf(s) + 1));
        expect(opts.length).toBe(n);
        expect(opts.filter((o) => o.text === s.text).length).toBe(1);
        expect(new Set(opts.map(look)).size).toBe(n);
        for (const o of opts) expect(o.kind).toBe(s.kind);
      }
    }
  });

  it('wrong pictures share something with the sentence', () => {
    const target = all.find((s) => s.text === 'I see three cats.')!;
    for (let seed = 1; seed <= 20; seed++) {
      const wrong = sentenceOptions(target, 3, seeded(seed)).filter((o) => o.text !== target.text);
      for (const o of wrong) expect(o.parts[0].word.id === 'cat' || o.parts[0].n === 3, o.text).toBe(true);
    }
  });

  it('a game has different sentences of all three kinds, and none for the youngest', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const game = pickSentences(8, seeded(seed));
      expect(game.length).toBe(8);
      expect(new Set(game.map((s) => s.text)).size).toBe(8);
      expect(new Set(game.map((s) => s.kind)).size).toBe(3);
    }
    expect(levelConfig('small').sentenceRounds).toBe(0);
    expect(levelConfig('middle').sentenceRounds).toBeGreaterThan(0);
    expect(pickSentences(0)).toEqual([]);
  });
});

group('sentence options test the whole sentence', () => {
  it('always shows the same thing in another number or size, so the noun alone is not enough', () => {
    const shares = (a: Sentence, b: Sentence) => a.parts.some((p) => b.parts.some((q) => q.word.id === p.word.id));
    for (const s of allSentences()) {
      for (const n of [2, 3]) {
        for (let seed = 1; seed <= 5; seed++) {
          const wrong = sentenceOptions(s, n, seeded(seed)).filter((o) => o.text !== s.text);
          expect(wrong.some((o) => shares(o, s)), `${s.text} / ${wrong.map((o) => o.text).join(' | ')}`).toBe(true);
          if (n === 3) expect(wrong.some((o) => !shares(o, s)), s.text).toBe(true);
        }
      }
    }
  });
});

group('days in a row', () => {
  it('counts one per day, grows on the next day and starts again after a gap', () => {
    const p = emptyProgress();
    expect(currentStreak(p, '2026-03-01')).toBe(0);
    expect(markDay(p, '2026-03-01')).toBe(true);
    expect(markDay(p, '2026-03-01')).toBe(false);
    expect(currentStreak(p, '2026-03-01')).toBe(1);
    markDay(p, '2026-03-02');
    markDay(p, '2026-03-03');
    expect(currentStreak(p, '2026-03-03')).toBe(3);
    // the next morning, before playing, the run is still alive
    expect(currentStreak(p, '2026-03-04')).toBe(3);
    // a whole day missed ends it
    expect(currentStreak(p, '2026-03-05')).toBe(0);
    markDay(p, '2026-03-05');
    expect(currentStreak(p, '2026-03-05')).toBe(1);
  });

  it('crosses month and year ends', () => {
    const p = emptyProgress();
    markDay(p, '2026-02-28');
    markDay(p, '2026-03-01');
    expect(currentStreak(p, '2026-03-01')).toBe(2);
    markDay(p, '2026-12-31');
    markDay(p, '2027-01-01');
    expect(currentStreak(p, '2027-01-01')).toBe(2);
  });

  it('survives old saved data that has no streak', () => {
    const p = load({ getItem: () => JSON.stringify({ stickers: ['fox'], streak: 'oops' }) });
    expect(p.streak).toEqual({ count: 0, last: '' });
    expect(p.look).toBe(null);
    expect(markDay(p, '2026-03-01')).toBe(true);
  });
});

group('things Chip can wear', () => {
  it('unlock one by one as stickers are collected, the last before the album is full', () => {
    expect(unlockedLooks(0)).toEqual([]);
    expect(unlockedLooks(2)).toEqual([]);
    expect(unlockedLooks(3).map((l) => l.id)).toEqual(['ribbon']);
    expect(unlockedLooks(12).map((l) => l.id)).toEqual(['ribbon', 'cap', 'glasses']);
    expect(unlockedLooks(stickers.length).length).toBe(LOOKS.length);
    const needs = LOOKS.map((l) => l.need);
    expect([...needs].sort((a, b) => a - b)).toEqual(needs);
    expect(Math.max(...needs)).toBeLessThanOrEqual(stickers.length);
    for (const l of LOOKS) {
      expect(fs.existsSync(path.join(process.cwd(), 'public/img', `look-${l.id}.svg`)), l.id).toBe(true);
    }
  });
});

group('backup code', () => {
  const sample = () => {
    const p = emptyProgress();
    for (const w of words) recordSeen(p, w.id);
    recordAnswer(p, 'cat', true);
    recordAnswer(p, 'dog', false);
    recordStars(p, 'animals', 'listen', 3);
    p.stickers.push('fox', 'unicorn');
    p.settings.age = 'big';
    p.settings.rate = 0.7;
    p.settings.limitMinutes = 30;
    markDay(p, '2026-03-01');
    p.look = 'ribbon';
    p.looksSeen = 1;
    return p;
  };

  it('brings back everything except the minutes played today', () => {
    const p = sample();
    p.minutesToday = { date: '2026-03-01', minutes: 12 };
    const code = exportCode(p);
    expect(code.startsWith('CHIP1:')).toBe(true);
    expect(code).toMatch(/^[A-Za-z0-9+/=.:]+$/);
    const back = importCode(`  ${code}
`)!;
    expect(back.words).toEqual(p.words);
    expect(back.best).toEqual(p.best);
    expect(back.stickers).toEqual(p.stickers);
    expect(back.settings).toEqual(p.settings);
    expect(back.streak).toEqual(p.streak);
    expect(back.look).toBe('ribbon');
    expect(back.minutesToday).toEqual({ date: '', minutes: 0 });
  });

  it('refuses anything that is not a backup code', () => {
    for (const bad of ['', 'hello', 'CHIP1:', 'CHIP1:!!!', 'CHIP1:' + btoa('{"w":"no"}'), 'CHIP2:' + btoa('{"w":[]}')]) {
      expect(importCode(bad), bad).toBe(null);
    }
  });

  it('drops odd values instead of trusting them', () => {
    const code = 'CHIP1:' + btoa(JSON.stringify({
      w: [['cat', 99, -5, 'x', 2], [42, 1, 1, 1, 1], 'junk'],
      b: { 'animals:listen': 7, 'animals:find': 2 },
      s: ['fox', 'fox', 3],
      set: { age: 'giant', rate: 50, limitMinutes: -1, playback: 'yes' },
      st: { count: 4, last: 'yesterday' },
      look: 'cape',
      ls: 99,
    }));
    const p = importCode(code)!;
    expect(p.words).toEqual({ cat: { box: 4, right: 0, wrong: 0, seen: 2 } });
    expect(p.best).toEqual({ 'animals:find': 2 });
    expect(p.stickers).toEqual(['fox']);
    expect(p.settings).toEqual(emptyProgress().settings);
    expect(p.streak).toEqual({ count: 0, last: '' });
    expect(p.look).toBe(null);
    expect(p.looksSeen).toBe(LOOKS.length);
  });
});

group('arrow keys', () => {
  // a 3 x 2 grid of tiles, then one wide button underneath
  const box = (left: number, top: number, width = 100, height = 100) => ({ left, top, width, height });
  const grid = [box(0, 0), box(120, 0), box(240, 0), box(0, 120), box(120, 120), box(240, 120), box(0, 240, 340, 60)];

  it('moves along a row and down a column', () => {
    expect(nextInDirection(grid, 0, 'right')).toBe(1);
    expect(nextInDirection(grid, 1, 'right')).toBe(2);
    expect(nextInDirection(grid, 2, 'left')).toBe(1);
    expect(nextInDirection(grid, 1, 'down')).toBe(4);
    expect(nextInDirection(grid, 4, 'up')).toBe(1);
  });

  it('stays put at an edge instead of jumping somewhere odd', () => {
    expect(nextInDirection(grid, 2, 'right')).toBe(-1);
    expect(nextInDirection(grid, 0, 'left')).toBe(-1);
    expect(nextInDirection(grid, 1, 'up')).toBe(-1);
    expect(nextInDirection(grid, 6, 'down')).toBe(-1);
    expect(nextInDirection([], 0, 'down')).toBe(-1);
  });

  it('reaches a wide button below a grid and comes back up', () => {
    expect(nextInDirection(grid, 4, 'down')).toBe(6);
    expect(nextInDirection(grid, 3, 'down')).toBe(6);
    expect([3, 4, 5]).toContain(nextInDirection(grid, 6, 'up'));
  });

  it('every tile of a grid can be reached from the first one', () => {
    const seen = new Set([0]);
    const queue = [0];
    while (queue.length) {
      const at = queue.shift()!;
      for (const dir of ['up', 'down', 'left', 'right'] as const) {
        const next = nextInDirection(grid, at, dir);
        if (next >= 0 && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect(seen.size).toBe(grid.length);
  });
});

group('review by time', () => {
  it('a word rests longer the better it is known, and a miss brings it back the same day', () => {
    const p = emptyProgress();
    expect(INTERVAL_DAYS).toEqual([0, 1, 3, 7, 14]);
    recordAnswer(p, 'cat', true, '2026-03-01'); // box 1
    expect(stat(p, 'cat').due).toBe('2026-03-02');
    recordAnswer(p, 'cat', true, '2026-03-02'); // box 2
    expect(stat(p, 'cat').due).toBe('2026-03-05');
    recordAnswer(p, 'cat', true, '2026-03-05'); // box 3
    expect(stat(p, 'cat').due).toBe('2026-03-12');
    recordAnswer(p, 'cat', true, '2026-03-12'); // box 4
    expect(stat(p, 'cat').due).toBe('2026-03-26');
    recordAnswer(p, 'cat', false, '2026-03-26'); // missed
    expect(stat(p, 'cat').due).toBe('2026-03-26');
    expect(stat(p, 'cat').box).toBe(0);
  });

  it('crosses month ends', () => {
    const p = emptyProgress();
    for (const d of ['2026-01-20', '2026-01-21', '2026-01-24']) recordAnswer(p, 'dog', true, d);
    expect(stat(p, 'dog').due).toBe('2026-01-31');
    recordAnswer(p, 'dog', true, '2026-01-31');
    expect(stat(p, 'dog').due).toBe('2026-02-14');
  });

  it('knows when a word is due', () => {
    const p = emptyProgress();
    expect(isDue(stat(p, 'cat'), '2026-03-01')).toBe(false); // never met
    recordSeen(p, 'cat');
    expect(isDue(stat(p, 'cat'), '2026-03-01')).toBe(true); // met on a card, never answered
    recordAnswer(p, 'cat', true, '2026-03-01');
    expect(isDue(stat(p, 'cat'), '2026-03-01')).toBe(false);
    expect(isDue(stat(p, 'cat'), '2026-03-02')).toBe(true);
    // progress saved before this feature has no dates: those words count as due
    expect(isDue({ box: 4, right: 4, wrong: 0, seen: 4 }, '2026-03-01')).toBe(true);
  });

  it('a learned word is left alone until its day, then asked again', () => {
    const p = emptyProgress();
    for (const d of ['2026-03-01', '2026-03-02', '2026-03-05']) recordAnswer(p, 'cat', true, d); // box 3, due 03-12
    const s = stat(p, 'cat');
    expect(weightOf(s, '2026-03-06')).toBeLessThan(0.5);
    expect(weightOf(s, '2026-03-12')).toBeGreaterThan(3);
    // Review leaves it out while it rests and brings it back when due
    for (const w of ['apple', 'bus', 'sun', 'dog']) recordSeen(p, w);
    expect(pickReviewSet(words, 8, p, seeded(1), '2026-03-06').map((w) => w.id)).not.toContain('cat');
    expect(pickReviewSet(words, 8, p, seeded(1), '2026-03-12').map((w) => w.id)).toContain('cat');
  });

  it('missed words still come first, then learned words that are due', () => {
    const p = emptyProgress();
    for (const w of words.slice(0, 40)) recordSeen(p, w.id);
    for (const id of ['sun', 'bus']) for (const d of ['2026-03-01', '2026-03-02', '2026-03-05']) recordAnswer(p, id, true, d);
    recordAnswer(p, 'red', false, '2026-03-12');
    const set = pickReviewSet(words, 3, p, seeded(4), '2026-03-12').map((w) => w.id).sort();
    expect(set).toEqual(['bus', 'red', 'sun']);
    expect(dueCount(p, words.map((w) => w.id), '2026-03-12')).toBeGreaterThanOrEqual(3);
  });
});

group('weekly report', () => {
  it('adds up seven days ending today and lists the words learned in them', () => {
    const p = emptyProgress();
    addMinutes(p, 5, '2026-03-01'); // a week and a day back: outside the report
    addMinutes(p, 12, '2026-03-03');
    addMinutes(p, 7, '2026-03-08');
    markDay(p, '2026-03-03');
    markDay(p, '2026-03-03');
    markDay(p, '2026-03-08');
    for (const d of ['2026-03-03', '2026-03-04', '2026-03-08']) recordAnswer(p, 'cat', true, d);
    recordAnswer(p, 'dog', false, '2026-03-08');
    const r = weekReport(p, '2026-03-08');
    expect(r.days.map((d) => d.date)).toEqual(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08']);
    expect(r.days.map((d) => d.min)).toEqual([0, 12, 0, 0, 0, 0, 7]);
    expect(r.min).toBe(19);
    expect(r.games).toBe(3);
    expect(r.right).toBe(3);
    expect(r.wrong).toBe(1);
    expect(r.activeDays).toBe(3);
    expect(r.learned).toEqual(['cat']);
    expect(weekReport(emptyProgress(), '2026-03-08').min).toBe(0);
  });

  it('keeps about five weeks of days and survives old saved data', () => {
    const p = emptyProgress();
    addMinutes(p, 1, '2026-01-01');
    addMinutes(p, 1, '2026-01-20');
    addMinutes(p, 1, '2026-03-01');
    expect(Object.keys(p.days).sort()).toEqual(['2026-03-01']);
    const old = load({ getItem: () => JSON.stringify({ stickers: ['fox'], days: 'oops' }) });
    expect(old.days).toEqual({});
    addMinutes(old, 3, '2026-03-01');
    expect(weekReport(old, '2026-03-01').min).toBe(3);
  });

  it('travels in the backup code, with the review dates', () => {
    const p = emptyProgress();
    addMinutes(p, 9, '2026-03-08');
    markDay(p, '2026-03-08');
    recordAnswer(p, 'cat', true, '2026-03-08');
    const back = importCode(exportCode(p))!;
    expect(back.days).toEqual(p.days);
    expect(back.words.cat.due).toBe('2026-03-09');
    // a code made before these fields existed still loads
    const oldCode = 'CHIP1:' + btoa(JSON.stringify({ w: [['cat', 2, 2, 0, 2]], b: {}, s: [], set: {} }));
    const o = importCode(oldCode)!;
    expect(o.words.cat).toEqual({ box: 2, right: 2, wrong: 0, seen: 2 });
    expect(o.days).toEqual({});
    // junk days are dropped
    const junk = 'CHIP1:' + btoa(JSON.stringify({ w: [], d: { nope: { min: 5 }, '2026-03-08': { min: -4, games: 'x', learned: [1, 'cat'] } } }));
    expect(importCode(junk)!.days).toEqual({ '2026-03-08': { min: 0, games: 0, right: 0, wrong: 0, learned: ['cat'] } });
  });
});

group('ABC', () => {
  const letters = wordsIn('abc');

  it('has all 26 letters in order, each with a word that starts with it', () => {
    expect(letters.map((w) => w.word).join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    for (const w of letters) {
      expect(w.kind).toBe('letter');
      expect(w.example, w.word).toBeTruthy();
      // X has no everyday word that starts with it, so it borrows the end of "fox"
      if (w.word !== 'X') expect(w.example![0].toUpperCase(), w.word).toBe(w.word);
      else expect(w.example).toContain('x');
    }
  });

  it('says what each letter is for and asks for it by name', () => {
    const w = (id: string) => words.find((x) => x.id === id)!;
    expect(describe(w('letter-a'))).toBe('A is for apple.');
    expect(describe(w('letter-q'))).toBe('Q is for queen.');
    expect(describe(w('letter-x'))).toBe('X is for fox.');
    expect(question(w('letter-b'))).toBe('Find the letter B.');
    expect(nounPhrase(w('letter-z'))).toBe('Z');
  });

  it('accepts what speech recognition writes for a letter name', () => {
    expect(passes('B', ['bee'])).toBe(true);
    expect(passes('C', ['see'])).toBe(true);
    expect(passes('W', ['double you'])).toBe(true);
    expect(passes('Z', ['zee'])).toBe(true);
    expect(passes('A', ['a'])).toBe(true);
    expect(passes('K', ['banana'])).toBe(false);
    expect(passes('B', ['dog'])).toBe(false);
  });
});

group('odd one out', () => {
  it('every topic has topics to take the odd picture from, never itself', () => {
    for (const t of topics) {
      expect(ODD_FROM[t.id]?.length, t.id).toBeGreaterThan(0);
      expect(ODD_FROM[t.id]).not.toContain(t.id);
      for (const other of ODD_FROM[t.id]) expect(topics.some((x) => x.id === other), other).toBe(true);
    }
    expect(ACTIVITY_IDS).toContain('odd');
  });

  it('each round has one picture from another topic and the rest from this one', () => {
    for (const t of topics) {
      for (const choices of [3, 4]) {
        const rounds = pickOddRounds(t.id, 10, choices, seeded(7));
        expect(rounds.length, t.id).toBe(10);
        for (const r of rounds) {
          expect(r.options.length).toBe(choices);
          expect(new Set(r.options.map((w) => w.id)).size).toBe(choices);
          const outsiders = r.options.filter((w) => w.topic !== t.id);
          expect(outsiders).toEqual([r.odd]);
          expect(ODD_FROM[t.id]).toContain(r.odd.topic);
        }
      }
    }
  });

  it('does not show the same odd picture twice in a row and leaves out in-between pictures', () => {
    const rounds = pickOddRounds('animals', 40, 4, seeded(3));
    rounds.forEach((r, i) => {
      if (i) expect(r.odd.id).not.toBe(rounds[i - 1].odd.id);
      expect(r.options.map((w) => w.id)).not.toContain('teddy bear');
    });
    expect(pickOddRounds('no-such-topic', 5, 3)).toEqual([]);
  });

  it('has its own number of rounds and pictures for each age', () => {
    expect(levelConfig('small').oddChoices).toBe(3);
    expect(levelConfig('big').oddChoices).toBe(4);
    expect(levelConfig('small').oddRounds).toBeLessThan(levelConfig('big').oddRounds);
  });
});

group('off-screen challenges', () => {
  it('every topic has at least two, each with a line for the grown-up', () => {
    for (const t of topics) expect(allChallenges().filter((c) => c.topic === t.id).length, t.id).toBeGreaterThanOrEqual(2);
    for (const c of allChallenges()) {
      expect(c.text).toMatch(/^[A-Z].*[!?]$/);
      expect(c.vi.length, c.text).toBeGreaterThan(5);
      if (c.word) expect(c.word.topic).toBe(c.topic);
    }
    expect(new Set(allChallenges().map((c) => c.text)).size).toBe(allChallenges().length);
  });

  it('builds the sentence from the word', () => {
    const texts = allChallenges().map((c) => c.text);
    for (const t of [
      'Find something red!',
      'Find something orange!',
      'Show me one finger!',
      'Show me two fingers!',
      'Clap three times!',
      'Touch your nose!',
      'What does the cow say?',
      'Can you jump like a rabbit?',
      'Can you walk like an elephant?',
      'Can you dance?',
      'Show me a happy face!',
      'Show me an angry face!',
      'Find a circle!',
      'Find a star!',
      'Find a book!',
    ]) {
      expect(texts, t).toContain(t);
    }
  });

  it('prefers a word the child has met and does not repeat the last one', () => {
    const p = emptyProgress();
    recordSeen(p, 'blue');
    for (let seed = 1; seed < 20; seed++) expect(pickChallenge('colors', p, '', seeded(seed))!.text).toBe('Find something blue!');
    // the only met word was just given: another one comes instead of the same again
    expect(pickChallenge('colors', p, 'Find something blue!', seeded(2))!.text).not.toBe('Find something blue!');
    // nothing met yet: any challenge of the topic
    expect(pickChallenge('body', emptyProgress(), '', seeded(4))!.topic).toBe('body');
    expect(pickChallenge('no-such-topic', p)).toBe(null);
  });
});

group('stories', () => {
  it('each has four pages with pictures and two questions with one right picture', () => {
    expect(stories.length).toBeGreaterThanOrEqual(6);
    expect(new Set(stories.map((s) => s.id)).size).toBe(stories.length);
    for (const s of stories) {
      expect(s.pages.length, s.id).toBe(4);
      expect(s.questions.length, s.id).toBe(2);
      for (const pg of s.pages) {
        expect(pg.pics.length).toBeGreaterThan(0);
        expect(pg.pics.length).toBeLessThanOrEqual(2);
      }
      const shown = new Set(s.pages.flatMap((pg) => pg.pics.map((w) => w.id)));
      for (const q of s.questions) {
        // the answer was on a page; a wrong picture never was, unless the question is about one moment
        expect(shown.has(q.answer.id), `${s.id}: ${q.text}`).toBe(true);
        expect(q.wrong.length).toBe(2);
        expect(q.wrong.map((w) => w.id)).not.toContain(q.answer.id);
      }
    }
  });

  it('offers the answer among the pictures, for two or three choices', () => {
    for (const s of stories) {
      for (const q of s.questions) {
        for (const n of [2, 3]) {
          const opts = questionOptions(q, n, seeded(5));
          expect(opts.length).toBe(n);
          expect(opts).toContain(q.answer);
          expect(new Set(opts.map((w) => w.id)).size).toBe(n);
        }
      }
    }
  });

  it('lists a title, the pages and the questions as lines to voice', () => {
    expect(storyPhrases().length).toBe(stories.length * 7);
    expect(storyPhrases()).toContain('The hungry cat.');
    // a spoken title has three words or more, so its clip is not cut like a single word
    for (const s of stories) expect(s.title.split(' ').length, s.title).toBeGreaterThanOrEqual(3);
  });
});

group('stories and the sticker picture in the saved progress', () => {
  it('keeps them through a backup code', () => {
    const p = emptyProgress();
    p.stories = ['hungry-cat', 'bear-bed'];
    p.scene = [
      ['unicorn', 12.5, 80],
      ['rocket', 50, 50],
    ];
    p.sceneBg = 2;
    p.settings.challenges = false;
    const back = importCode(exportCode(p))!;
    expect(back.stories).toEqual(['hungry-cat', 'bear-bed']);
    expect(back.scene).toEqual([
      ['unicorn', 12.5, 80],
      ['rocket', 50, 50],
    ]);
    expect(back.sceneBg).toBe(2);
    expect(back.settings.challenges).toBe(false);
  });

  it('drops or clamps odd values', () => {
    expect(cleanScene('nope')).toEqual([]);
    expect(cleanScene([['a', -5, 250], ['b'], [3, 1, 1], 'x', ['c', 'q', null]])).toEqual([
      ['a', 0, 100],
      ['b', 50, 50],
      ['c', 50, 50],
    ]);
    expect(cleanScene(Array.from({ length: 80 }, (_, i) => [`s${i}`, 1, 1])).length).toBe(SCENE_MAX);
    const junk = 'CHIP1:' + btoa(JSON.stringify({ w: [], str: [1, 'ok', 'ok', {}], sc: 'x', bg: 99, set: { challenges: 'yes' } }));
    const p = importCode(junk)!;
    expect(p.stories).toEqual(['ok']);
    expect(p.scene).toEqual([]);
    expect(p.sceneBg).toBe(0);
    expect(p.settings.challenges).toBe(true);
  });

  it('loads progress saved before these existed', () => {
    const old = { getItem: () => JSON.stringify({ stickers: ['unicorn'], settings: { age: 'big' } }) };
    const p = load(old);
    expect(p.stories).toEqual([]);
    expect(p.scene).toEqual([]);
    expect(p.sceneBg).toBe(0);
    expect(p.settings.challenges).toBe(true);
  });
});

group('pictures drawn for the app', () => {
  it('a word marked as art uses its own picture, named after its id', () => {
    const w = (id: string) => words.find((x) => x.id === id)!;
    expect(w('mom').img).toMatch(/img\/art\/mom\.webp$/);
    expect(w('police officer').img).toMatch(/img\/art\/police-officer\.webp$/);
    // a whole topic is drawn in one style, never half of it
    for (const t of ['family', 'vehicles', 'actions', 'body', 'food', 'animals']) {
      for (const x of wordsIn(t)) expect(x.img, x.id).toMatch(/\.webp$/);
    }
  });

  it('a letter shows the same picture as its example word', () => {
    const w = (id: string) => words.find((x) => x.id === id)!;
    expect(w('letter-n').img).toBe(w('nose').img);
    expect(w('letter-v').img).toBe(w('van').img);
    expect(w('letter-a').img).toBe(w('apple').img);
    expect(w('letter-c').img).toBe(w('cat').img);
    expect(w('letter-c').img).toMatch(/\.webp$/);
  });
});

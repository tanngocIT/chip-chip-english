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
  topicStars,
} from './progress';
import { passes, scoreHeard, levenshtein } from './match';
import { words, topics, wordsIn, nounPhrase, describe, question, stickers } from './content';
import { viNumber } from './vi';
import { isIos, isStandalone } from './install';

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

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
} from './progress';
import { passes, scoreHeard, levenshtein } from './match';
import { words, topics, wordsIn, nounPhrase, describe, question, stickers } from './content';
import { viNumber } from './vi';

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

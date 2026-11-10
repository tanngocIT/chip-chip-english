import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { allPhrases, phraseKey } from './phrases';

describe('giọng đọc có sẵn', () => {
  it('mỗi câu có một key riêng', () => {
    const seen = new Map<string, string>();
    for (const p of allPhrases()) {
      const k = phraseKey(p);
      expect(seen.get(k) ?? p, `"${p}" trùng key với "${seen.get(k)}"`).toBe(p);
      seen.set(k, p);
    }
  });

  it('mỗi câu đều có file mp3 (thiếu thì chạy: node scripts/gen-voice.mjs <python> <model.onnx>)', () => {
    const missing = allPhrases().filter((p) => !existsSync(`public/voice/${phraseKey(p)}.mp3`));
    expect(missing).toEqual([]);
  });
});

// Sinh file giọng đọc mp3 cho mọi câu của app bằng Piper (mã nguồn mở, chạy trên máy, miễn phí).
// Giọng: en_US-kristin-medium (public domain, LibriVox).
//
// Cần Python có piper-tts và soundfile:
//   python -m venv .venv-voice && .venv-voice/Scripts/pip install piper-tts soundfile scipy faster-whisper
// Chạy:
//   node scripts/gen-voice.mjs <python> <đường dẫn en_US-kristin-medium.onnx>
// Kết quả: public/voice/<key>.mp3 và public/voice/manifest.json (danh sách key có file).
// Chỉ sinh những câu chưa có file, nên thêm từ mới rồi chạy lại rất nhanh.

import { buildSync } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [python, model] = process.argv.slice(2);
if (!python || !model) {
  console.error('Dùng: node scripts/gen-voice.mjs <python> <model.onnx>');
  process.exit(1);
}

// Gói src/lib/phrases.ts (TypeScript + JSON) thành một module ESM để import.
const out = buildSync({
  entryPoints: [join(root, 'src/lib/phrases.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  define: { 'import.meta.env': '{"BASE_URL":"./"}' },
});
const code = out.outputFiles[0].text;
const { allPhrases, phraseKey } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

const phrases = allPhrases();
const byKey = new Map();
for (const p of phrases) {
  const k = phraseKey(p);
  if (byKey.has(k) && byKey.get(k) !== p) throw new Error(`Hai câu trùng key "${k}": "${byKey.get(k)}" và "${p}"`);
  byKey.set(k, p);
}

const dir = join(root, 'public/voice');
mkdirSync(dir, { recursive: true });
const todo = [...byKey].filter(([k]) => !existsSync(join(dir, k + '.mp3')));
console.log(`${byKey.size} câu, ${todo.length} câu cần sinh.`);

if (todo.length) {
  const job = join(dir, '..', '.voice-job.json');
  writeFileSync(job, JSON.stringify({ model, dir, items: todo }));
  const r = spawnSync(python, [join(root, 'scripts/gen-voice.py'), job], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
  try {
    (await import('node:fs')).rmSync(job);
  } catch {}
}

const keys = readdirSync(dir)
  .filter((f) => f.endsWith('.mp3'))
  .map((f) => f.slice(0, -4))
  .sort();
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(keys));
console.log(`Xong. manifest có ${keys.length} file.`);

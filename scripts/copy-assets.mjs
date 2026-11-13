// Copies the Fluent Emoji (MIT, Microsoft) flat SVGs this app uses into public/img.
// Usage: node scripts/copy-assets.mjs /path/to/fluentui-emoji
// Get the source with:
//   git clone --depth 1 --filter=blob:none --sparse https://github.com/microsoft/fluentui-emoji.git
//   cd fluentui-emoji && git sparse-checkout set --no-cone '/assets/*/Flat/*' '/assets/*/Medium-Light/Flat/*' '/LICENSE'
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = process.argv[2];
if (!src) {
  console.error('Pass the path to a fluentui-emoji checkout.');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(path.join(root, 'src/data/words.json'), 'utf8'));
const out = path.join(root, 'public/img');
fs.mkdirSync(path.join(out, 'stickers'), { recursive: true });

export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function findSvg(asset, skin) {
  const base = path.join(src, 'assets', asset);
  const dir = skin ? path.join(base, 'Medium-Light', 'Flat') : path.join(base, 'Flat');
  const alt = path.join(base, 'Default', 'Flat');
  for (const d of [dir, alt]) {
    if (fs.existsSync(d)) {
      const f = fs.readdirSync(d).find((x) => x.endsWith('.svg'));
      if (f) return path.join(d, f);
    }
  }
  return null;
}

let missing = 0;
const copy = (asset, dest, skin = false, fallback) => {
  let file = findSvg(asset, skin) ?? (fallback ? findSvg(fallback, skin) : null);
  if (!file) {
    console.error('missing', asset);
    missing++;
    return;
  }
  fs.copyFileSync(file, dest);
};

const seen = new Set();
for (const w of data.words) {
  // drawn for this app (shapes, the art set): already in public/img, nothing to copy
  if (w.custom || w.art) continue;
  const name = slug(w.asset);
  if (seen.has(name)) continue;
  seen.add(name);
  copy(w.asset, path.join(out, `${name}.svg`), w.skin, w.fallback);
}


const stickers = JSON.parse(fs.readFileSync(path.join(root, 'src/data/stickers.json'), 'utf8'));
const stickerArt = JSON.parse(fs.readFileSync(path.join(root, 'src/data/sticker-art.json'), 'utf8'));
for (const s of stickers) if (!stickerArt.includes(slug(s))) copy(s, path.join(out, 'stickers', `${slug(s)}.svg`));

fs.copyFileSync(path.join(src, 'LICENSE'), path.join(out, 'LICENSE-fluentui-emoji.txt'));
console.log(`copied ${seen.size} word images, ${stickers.length} stickers, missing ${missing}`);
process.exit(missing ? 1 : 0);

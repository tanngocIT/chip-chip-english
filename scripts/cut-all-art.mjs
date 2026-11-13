// Cuts every sheet listed in art-inbox/sheets.json into public/img/art/<word id>.webp.
// sheets.json maps a sheet file (in art-inbox/) to the word ids on it, in reading order.
// Usage: node scripts/cut-all-art.mjs <python>     (python needs pillow, numpy, scipy)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const python = process.argv[2];
if (!python) {
  console.error('Usage: node scripts/cut-all-art.mjs <python>');
  process.exit(1);
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const sheets = JSON.parse(fs.readFileSync('art-inbox/sheets.json', 'utf8'));
const tmp = 'art-inbox/cut';
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync('public/img/art', { recursive: true });
let failed = 0;
for (const [file, ids] of Object.entries(sheets)) {
  const r = spawnSync(python, ['scripts/cut-art.py', path.join('art-inbox', file), tmp, ids.join(',')], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`${file}: ${r.stderr.trim().split('\n').pop()}`);
    failed++;
    continue;
  }
  for (const id of ids) fs.copyFileSync(path.join(tmp, `${id}.webp`), path.join('public/img/art', `${slug(id)}.webp`));
  console.log(`${file}: ${ids.length}`);
}
process.exit(failed ? 1 : 0);

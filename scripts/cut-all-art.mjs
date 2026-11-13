// Cuts every sheet listed in art-inbox/sheets.json into public/img/art/<word id>.webp.
// sheets.json maps a sheet file (in art-inbox/) to the word ids on it, in reading order.
// Usage: node scripts/cut-all-art.mjs <python>     (python needs pillow, numpy, scipy)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const python = process.argv[2];
// optional: only the sheets whose file name contains this text
const only = process.argv[3] ?? '';
if (!python) {
  console.error('Usage: node scripts/cut-all-art.mjs <python>');
  process.exit(1);
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const sheets = JSON.parse(fs.readFileSync('art-inbox/sheets.json', 'utf8'));
const tmp = 'art-inbox/cut';
fs.mkdirSync(tmp, { recursive: true });
fs.mkdirSync('public/img/art', { recursive: true });
let failed = 0;
for (const [file, entry] of Object.entries(sheets)) {
  // an entry is the list of ids, or { ids, join } when a picture on the sheet was drawn in loose pieces
  const ids = Array.isArray(entry) ? entry : entry.ids;
  const extra = Array.isArray(entry) ? [] : ['320', String(entry.join)];
  if (!file.includes(only)) continue;
  const r = spawnSync(python, ['scripts/cut-art.py', path.join('art-inbox', file), tmp, ids.join(','), ...extra], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`${file}: ${r.stderr.trim().split('\n').pop()}`);
    failed++;
    continue;
  }
  for (const id of ids) fs.copyFileSync(path.join(tmp, `${id}.webp`), path.join('public/img/art', `${slug(id)}.webp`));
  console.log(`${file}: ${ids.length}`);
}
process.exit(failed ? 1 : 0);

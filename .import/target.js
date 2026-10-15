// V3: plays .import/vectors/target.sql against what proper gathers, and
// runs every ```sql block of the README (each must answer, with rows). Run
// from the repo, after the importer, under crew run 6G:
//
//   node .import/target.js
//
// Says each check, held or not, and exits 1 if any is not.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const counts = JSON.parse(fs.readFileSync(path.join(__dirname, 'companies/counts.json'), 'utf8'));
counts.faq_questions = (fs.readFileSync(path.join(__dirname, 'faq.md'), 'utf8').match(/^### Question: /gm) || []).length;

function query(sql) {
  const p = spawnSync('proper', ['query', sql], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 << 20 });
  const out = (p.stdout || '') + (p.stderr || '');
  const rows = out.split('\n').filter((l) => l.startsWith('|'));
  if (p.status || rows.length < 2) return { rows: null, out: out.trim() };
  return { rows: rows.slice(2), out };
}

let failed = 0;
const text = fs.readFileSync(path.join(__dirname, 'vectors/target.sql'), 'utf8');
for (const block of text.split(/\n(?=-- name: )/)) {
  const m = block.match(/^-- name: ([^\n]*)\n-- want: ([^\n]*)\n([\s\S]*)/);
  if (!m) continue;
  const want = m[2].trim().replace(/\{(\w+)\}/g, (_, k) => String(counts[k]));
  const { rows, out } = query(m[3].trim().replace(/;\s*$/, ''));
  const have = rows ? rows[0].replace(/^\|\s*|\s*\|$/g, '').trim() : out;
  const ok = have === want;
  failed += !ok;
  console.log(`${ok ? 'held' : 'NOT HELD'}  ${m[1]}${ok ? '' : `\n    want ${want}\n    have ${have}`}`);
}
const readme = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
[...readme.matchAll(/```sql\n([\s\S]*?)```/g)].forEach((b, i) => {
  const { rows, out } = query(b[1]);
  const ok = Boolean(rows && rows.length);
  failed += !ok;
  console.log(`${ok ? 'held' : 'NOT HELD'}  README.md, query ${i + 1}: ${rows ? rows.length : 0} rows${ok ? '' : '\n    ' + out.slice(0, 400)}`);
});
console.log(failed ? `${failed} not held` : 'every check held');
process.exit(failed ? 1 : 0);

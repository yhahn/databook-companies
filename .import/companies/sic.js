// A company's industry, as the SEC classes it: the Standard Industrial
// Classification (SIC) code the SEC gives each filer, as its filings in the
// Financial Statement Data Sets carry it (sub.txt, `sic`), the code's title
// from the SEC's own list, and its division, the SIC Manual's (1987) top
// level, which the book takes as its sectors (DECISIONS 25). All public
// domain, the SEC's and the Department of Labor's.
//
//   node .import/companies/sic.js --fetch     the SEC's list of codes, into the cache

const fs = require('fs');
const path = require('path');

const CACHE = path.join(process.env.HOME, '.cache/proper/earnings');
const LIST_URL = 'https://www.sec.gov/search-filings/standard-industrial-classification-sic-code-list';
const LIST = path.join(CACHE, 'sic', 'sic-code-list.html');

// The SIC Manual's divisions (1987; OSHA keeps it, osha.gov/data/sic-manual),
// each the run of two-digit major groups it holds. Ten lines of a standard,
// written here as the manual gives them (its site refuses a program: 403).
const DIVISIONS = [
  ['A', 1, 9, 'Agriculture, Forestry, and Fishing'],
  ['B', 10, 14, 'Mining'],
  ['C', 15, 17, 'Construction'],
  ['D', 20, 39, 'Manufacturing'],
  ['E', 40, 49, 'Transportation, Communications, Electric, Gas, and Sanitary Services'],
  ['F', 50, 51, 'Wholesale Trade'],
  ['G', 52, 59, 'Retail Trade'],
  ['H', 60, 67, 'Finance, Insurance, and Real Estate'],
  ['I', 70, 89, 'Services'],
  ['J', 91, 97, 'Public Administration'],
  ['K', 99, 99, 'Nonclassifiable Establishments'],
].map(([letter, from, to, name]) => ({ letter, from, to, name }));

function division(code) {
  const g = Math.floor(Number(code) / 100);
  return DIVISIONS.find((d) => g >= d.from && g <= d.to) || null;
}

const unescape = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#0?39;|&rsquo;/g, "'").replace(/&nbsp;| /g, ' ').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

// The SEC's list: code -> its title. Its shape checked first (V1): a table
// headed SIC Code, Office, Industry Title, of 400 codes or more.
function titles(file = LIST) {
  const html = fs.readFileSync(file, 'utf8');
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => unescape(c[1])));
  const head = rows.find((r) => r[0] === 'SIC Code');
  if (!head || head.join('|') !== 'SIC Code|Office|Industry Title') throw new Error(`${file}: the SEC's list of SIC codes has changed its head: ${head && head.join(', ')}`);
  const out = new Map(rows.filter((r) => /^\d+$/.test(r[0]) && r.length === 3).map((r) => [r[0].padStart(4, '0'), r[2]]));
  if (out.size < 400) throw new Error(`${file}: ${out.size} SIC codes; the list had 444`);
  return out;
}

// Each CIK's SIC code, from its latest 10-K or 10-Q in the quarters cached
// ('' where none is there). `ciks` are ten-digit strings.
function codes(ciks, fsdsDir, quarters) {
  const want = new Set(ciks.map((c) => String(Number(c))));
  const best = new Map();
  for (const q of quarters) {
    const lines = fs.readFileSync(path.join(fsdsDir, q, 'sub.txt'), 'utf8').split('\n');
    const col = Object.fromEntries(lines[0].split('\t').map((h, i) => [h, i]));
    for (const line of lines.slice(1)) {
      const f = line.split('\t');
      if (!want.has(f[col.cik]) || !/^10-[KQ]/.test(f[col.form]) || !f[col.sic]) continue;
      const p = best.get(f[col.cik]);
      if (!p || f[col.filed] > p.filed) best.set(f[col.cik], { sic: f[col.sic].padStart(4, '0'), filed: f[col.filed] });
    }
  }
  return new Map(ciks.map((c) => [c, best.get(String(Number(c)))?.sic || '']));
}

async function fetchList() {
  const body = await require('./sec').get(LIST_URL);
  if (!body) throw new Error(`${LIST_URL}: not found`);
  fs.mkdirSync(path.dirname(LIST), { recursive: true });
  fs.writeFileSync(LIST + '.part', body);
  titles(LIST + '.part'); // whole, and of its shape, before it is kept
  fs.renameSync(LIST + '.part', LIST);
  console.log(`${LIST_URL}: ${titles().size} codes`);
}

module.exports = { DIVISIONS, division, titles, codes, LIST_URL };
if (require.main === module && process.argv.includes('--fetch')) fetchList().catch((e) => { console.error(e.message); process.exit(1); });

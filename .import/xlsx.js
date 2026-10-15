// A workbook's first sheet as rows of cells (strings and numbers), read
// from the .xlsx's own XML with unzip: the one spreadsheet this book
// reads (SPDR's SPY holdings, members.js) needs no more.

const { execFileSync } = require('child_process');

const unzip = (file, part) => execFileSync('unzip', ['-p', file, part], { maxBuffer: 64 << 20 }).toString('utf8');
const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');

function sheet(file) {
  const strings = [...unzip(file, 'xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((m) => unescape([...m[1].matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')));
  const rows = [];
  for (const r of unzip(file, 'xl/worksheets/sheet1.xml').matchAll(/<row r="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row = [];
    for (const c of (r[2] || '').matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const col = [...c[1]].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const v = /<v>([\s\S]*?)<\/v>/.exec(c[3] || '');
      const inline = /<is>([\s\S]*?)<\/is>/.exec(c[3] || '');
      const t = (/ t="(\w+)"/.exec(c[2]) || [])[1];
      row[col] = t === 's' && v ? strings[+v[1]] : t === 'inlineStr' && inline ? unescape(inline[1].replace(/<[^>]+>/g, ''))
        : v ? (t === 'str' ? unescape(v[1]) : Number(v[1])) : null;
    }
    rows[+r[1] - 1] = row;
  }
  return rows;
}

module.exports = { sheet };

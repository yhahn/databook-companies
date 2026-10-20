// A reader's way in (SPEC R2, R3): the questions and findings written by
// hand in .import/reading.md, their words filled from the values the
// importer reckons (.import/companies/reckon.js), and the values kept in
// .import/reading.json, so a rerun whose finding turns warns
// `finding-turned`, and faq.js can hold a page to the source
// (`page-drifted`). HUD's reading.py, in the importer's language. Used by
// .import/companies/import.js (a sector's and a company's page) and
// .import/companies/readme.js (the front page); not run itself.
//
// A record's words hold `{name}`, `{name:$}` (dollars), `{name:%}` (a
// percent), `{name:,}` (a count) and `{name:th}` (a rank); a value that
// is a list is written "a, b and c". A value reckoned as null leaves the
// record's answer as the book not saying, never a guess.

const fs = require('fs');
const path = require('path');

const KEYS = ['Page', 'Ask', 'Answer', 'Alone', 'Measure', 'Picture', 'Turns on', 'FAQ', 'FAQ page', 'Holds', 'Says'];
const FILE = path.join(__dirname, 'reading.md');

let cache = null;
function records() {
  if (cache) return cache;
  const text = fs.readFileSync(FILE, 'utf8');
  const out = {};
  for (const block of text.split(/\n(?=### (?:Question|Finding): )/).slice(1)) {
    const [, kind, id] = /^### (Question|Finding): (\S+)\s*\n/.exec(block);
    if (out[id]) throw new Error(`reading.md: ${id} twice`);
    const rec = { kind, id };
    for (const line of block.split('\n')) {
      const m = /^- ([^:]+):[ \t]*(.*)$/.exec(line);
      if (m && KEYS.includes(m[1])) rec[m[1]] = m[2].trim();
    }
    rec.turns = (rec['Turns on'] || '').split(',').map((s) => s.trim()).filter(Boolean);
    out[id] = rec;
  }
  return (cache = out);
}

const ofPage = (page) => Object.values(records()).filter((r) => r.Page === page);

// Dollars (the book's millions) as a reader says them: $16.61 trillion,
// $112.0 billion, $950 million
function money(v) {
  const a = Math.abs(v) * 1e6, s = v < 0 ? '−' : '';
  if (a >= 1e12) return `${s}$${(a / 1e12).toFixed(2)} trillion`;
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(1)} billion`;
  return `${s}$${Math.round(a / 1e6).toLocaleString('en-US')} million`;
}
function percent(v) {
  const s = (Math.round(v * 10) / 10).toFixed(1);
  return (s.endsWith('.0') ? s.slice(0, -2) : s).replace(/^-/, '−') + '%';
}
const ordinal = (n) => n + ((n % 100 >= 11 && n % 100 <= 13) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
function listed(v) {
  v = v.map(String);
  if (v.length > 6) return `${v.slice(0, 3).join(', ')} and ${v.length - 3} more`;
  return v.length === 1 ? v[0] : `${v.slice(0, -1).join(', ')} and ${v[v.length - 1]}`;
}
function shown(v, spec) {
  if (Array.isArray(v)) return listed(v);
  if (spec === '$') return money(v);
  if (spec === '%') return percent(v);
  if (spec === ',') return Number(v).toLocaleString('en-US');
  if (spec === 'th') return ordinal(v);
  return String(v);
}

const NEED = /\{(\w+)(?::([^}]*))?\}/g;

// The words, each {name} filled: from `words` (a value already written as
// words, links and all) where it has the name, else from `values`. Null
// if a value it needs is null.
function fill(template, values, words = {}) {
  for (const [, k] of template.matchAll(NEED)) {
    if (!(k in words) && !(k in values)) throw new Error(`reading.md: no value ${k} for "${template.slice(0, 60)}…"`);
    if ((k in words ? words[k] : values[k]) == null) return null;
  }
  return template.replace(NEED, (_, k, spec) => (k in words ? words[k] : shown(values[k], spec)));
}

// A question's sentence (its Alone where asked), or a finding's (Says);
// where a value is missing, the book says so.
function answer(rec, values, words = {}, alone = false) {
  const t = alone && rec.Alone ? rec.Alone : rec.Answer || rec.Says;
  const said = fill(t, values, words);
  if (said === null) return 'The book does not say: its filings give no value this needs.';
  return said[0].toUpperCase() + said.slice(1);
}

const ask = (rec, names = {}) => rec.Ask.replace(/\{(\w+)\}/g, (m, k) => (k in names ? names[k] : m));

// The values a record uses (its words', its turns', its Holds'), as kept
// in reading.json: plain JSON.
function kept(values, rec) {
  const words = ['Answer', 'Alone', 'Says'].map((k) => rec[k] || '').join(' ');
  const used = new Set([...[...words.matchAll(NEED)].map((m) => m[1]), ...rec.turns,
    ...(rec.Holds || '').split(',').filter((p) => p.includes('=')).map((p) => p.split('=')[0].trim())]);
  return Object.fromEntries(Object.entries(values).filter(([k, v]) => used.has(k) && (v === null || ['number', 'string'].includes(typeof v) || Array.isArray(v))));
}

// Warn of each finding turned since the last release: pages is {page:
// {record id: values}}; the last release's are in `file`. Returns the
// warnings, each also printed.
function turned(file, pages) {
  let before = {};
  try { before = JSON.parse(fs.readFileSync(file, 'utf8')).pages || {}; } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const recs = records(), said = [];
  for (const page of Object.keys(pages).sort()) {
    for (const [id, now] of Object.entries(pages[page])) {
      const was = before[page]?.[id];
      if (!was) continue;
      for (const k of recs[id].turns) {
        if (k in was && JSON.stringify(was[k]) !== JSON.stringify(now[k])) said.push(`finding-turned: ${page}, ${id}: ${k} was ${JSON.stringify(was[k])}, now ${JSON.stringify(now[k])}`);
      }
    }
  }
  for (const s of said) console.log(s);
  return said;
}

// Keys sorted, so a rerun unchanged writes the same file
const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
function save(file, pages) {
  fs.writeFileSync(file, JSON.stringify(sorted({ about: 'The values each page of the book was filled with (.import/reading.md), by the importer: a rerun warns finding-turned where one turns, and faq.js holds them to the source (page-drifted). Not by hand.', pages }), null, 1) + '\n');
}

module.exports = { records, ofPage, fill, answer, ask, kept, turned, save, money, percent, ordinal, listed };

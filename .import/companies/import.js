// databook-companies' importer: the SEC's filings (companyfacts, FSDS)
// of the S&P 500's members (.import/members.json), a page a company.
// Every page is written here; nothing by hand (SPEC B1).
//
//   node .import/companies/import.js
//
// Writes companies/<Sector>.md and companies/<Sector>/<Company>.md, a
// sector the SIC division of the SEC's code for the company (sic.js); the
// README; .import/companies/counts.json and skipped.json; and
// .import/reading.json, the values the reading pages were filled with
// (reckon.js, .import/reading.md).

const fs = require('fs');
const path = require('path');
const { COLUMNS, ledger, days } = require('./edgar');
const fsds = require('./fsds');
const sic = require('./sic');
const { reckon } = require('./reckon');
const reading = require('../reading');

const REPO = path.resolve(__dirname, '../..');
const CACHE = path.join(process.env.HOME, '.cache/proper/earnings');

// B7: names made safe, links that proper and the bench both read back
const safe = (name) => name.normalize('NFC').replace(/[/\\]/g, '-').replace(/[:*?"<>|\x00-\x1f]/g, '').split(/\s+/).filter(Boolean).join(' ').replace(/^[. ]+/, '').replace(/[. ]+$/, '');
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()).replace(/%2C/g, ',');
const link = (p) => './' + p.split('/').map(enc).join('/');
const up = (p) => '../' + p.split('/').map(enc).join('/');

// Dollars as millions, exactly (a shift of the point, no rounding); EPS
// as filed; a blank where the filings give none.
const millions = (v) => (v === null || v === undefined ? '' : String(v / 1e6));
const cell = (name, v) => (name === 'EPS diluted' ? (v === null ? '' : String(v)) : millions(v));
const row = (cells) => `| ${cells.join(' | ')} |`;
const table = (heads, rows, quote = '') => [row(heads), row(heads.map(() => '---')), ...rows.map(row)].map((l) => quote + l).join('\n');

// One company: its page. `span` is the annual card's years, the same for
// every company (SPEC B4). `sector` is its SIC division's name, `sic` and
// `industry` the SEC's code for it and its title; `reading` the lines its
// page opens with (the questions of reading.md, answered), or none.
// `name` is the SEC's list of tickers' (companyfacts' own entityName can
// be a co-registrant's: Bank of America's is BofA Finance LLC's);
// `before` a CIK the company filed under before (successors.json), and
// why; `tickers` its shares in the index.
function company({ facts, fsdsRows, exchange, ticker, tickers, span, name, before, page: pageName, sic: code, industry, sector, reading: opening }) {
  const l = ledger(facts);
  if (l.skip) return { skip: l.skip };
  l.name = name;
  const page = pageName || safe(name);
  const seg = fsdsRows ? fsds.segments(fsdsRows, l.spans) : { rows: [], subtotals: [], changes: [] };
  const lastQ = l.quarters[l.quarters.length - 1];
  const out = {};
  const dir = `companies/${safe(sector)}`;

  const L = [];
  L.push(`# Company: ${l.name}`, '');
  L.push(`- CIK: ${l.cik}`);
  L.push(`- Ticker: ${ticker || ''}`);
  L.push(`- Exchange: ${exchange}`);
  L.push(`- SIC: ${code || ''}`);
  L.push(`- Industry: ${industry || ''}`);
  L.push(`- Sector: ${sector}`);
  L.push(`- First year: FY${l.first}`);
  L.push(`- Last quarter: ${lastQ ? `FY${lastQ.year} Q${lastQ.q}` : ''}`);
  L.push(`- Last quarter ended: ${lastQ && lastQ.end ? lastQ.end : ''}`);
  L.push(`- CIK before: ${before ? before.cik : ''}`, '');
  const shares = tickers && tickers.length > 1 ? ` Its shares in the S&P 500: ${tickers.join(', ')}.` : '';
  const filer = before ? ` The SEC's list gives ${ticker} to CIK ${l.cik}; its filings before are under CIK ${before.cik}, and are taken from there, each filing from the CIK that filed it: ${before.why}` : '';
  L.push(`${l.name}, as it files with the SEC (CIK ${l.cik}): its fiscal years and quarters from its XBRL filings, FY${l.first} to FY${l.last}${l.inProgress ? ` (FY${l.last} through Q${l.quarters.filter((q) => q.year === l.last).length})` : ''}. Dollars are in millions; EPS in dollars a share. Capex and buybacks are cash paid out, so negative. EPS diluted is as filed, a share as it was when filed${l.splits.length ? ` (before ${l.splits.map((s) => s.filed).join(' and ')}, a share before a split: see the changes)` : ''}; EPS adjusted is a share as it is now, each split since divided out. A quarter the filings give only as a running total is the total less the quarters before it; Q4 is the year less the first three.${shares}${filer}`, '');
  if (opening) L.push(...opening);

  L.push('## Annual', '');
  const items = COLUMNS.filter(([n]) => n !== 'EPS diluted');
  const byYear = new Map(l.annual.map((a) => [a.year, a]));
  L.push(`> [!CARD:line] ${l.name}, by fiscal year, $ millions`);
  L.push(table(['Line item', ...span.map((y) => `FY${y}`)], items.map(([n]) => {
    const i = COLUMNS.findIndex(([m]) => m === n);
    return [n, ...span.map((y) => (byYear.has(y) ? millions(byYear.get(y).values[i]) : ''))];
  }), '> '), '');
  const eps = COLUMNS.findIndex(([n]) => n === 'EPS diluted');
  L.push('#### EPS by year', '');
  L.push(table(['Fiscal year', 'Started', 'Ended', 'EPS diluted', 'EPS adjusted'], l.annual.map((a) => [`FY${a.year}`, a.start || '', a.end || '', a.values[eps] === null ? '' : String(a.values[eps]), a.epsAdjusted === null ? '' : String(a.epsAdjusted)])), '');

  L.push('## Quarterly', '');
  L.push(table(['Quarter', 'Fiscal year', 'Fiscal quarter', 'Ended', ...COLUMNS.map(([n]) => n), 'EPS adjusted'],
    l.quarters.map((q) => [`FY${q.year} Q${q.q}`, String(q.year), String(q.q), q.end || '', ...COLUMNS.map(([n], i) => cell(n, q.values[i])), q.epsAdjusted === null ? '' : String(q.epsAdjusted)])), '');

  L.push('## Segments', '');
  if (seg.rows.length) {
    L.push(`Revenue by business segment, product and geography, as ${l.name} files them in the SEC's Financial Statement Data Sets (${fsds.cachedQuarters(path.join(CACHE, 'fsds')).join(', ')}), in millions. Each filing gives its quarter and the year before. Members are the company's own names.${seg.subtotals.length ? ' A member that is the sum of others is left out: ' + seg.subtotals.map((s) => `${s.member} (${s.of.join(' + ')})`).join('; ') + '.' : ''}`, '');
    L.push(table(['Quarter', 'Axis', 'Member', 'Revenue'], seg.rows.map((r) => [`FY${r.year} Q${r.q}`, r.axis, r.member, millions(r.value)])), '');
  } else {
    L.push(`${l.name} files no revenue by segment, product or geography in the Financial Statement Data Sets cached.`, '');
  }

  L.push('## Tags', '');
  L.push('The us-gaap tag each line item was taken from, its years in runs: a line item moves between tags over the years, and each move is a change below.', '');
  const runs = [];
  for (const t of l.tags) {
    const ys = [...t.byYear.keys()].sort((a, b) => a - b);
    let start = null;
    ys.forEach((y, i) => {
      if (start === null) start = y;
      const next = ys[i + 1];
      if (next === undefined || t.byYear.get(next) !== t.byYear.get(y) || next !== y + 1) {
        runs.push([t.name, `FY${start}`, `FY${y}`, `us-gaap:${t.byYear.get(y)}`]);
        start = null;
      }
    });
  }
  L.push(table(['Line item', 'From', 'To', 'Tag'], runs), '');

  // D5: every change a record, last on the page
  const changes = [
    ...l.changes.map((c) => ({ title: `${c.what}, ${c.boundary.replace(/ to .*/, '')}`, ...c, source: 'SEC EDGAR companyfacts' })),
    ...(before ? [{ title: `CIK, ${before.since.slice(0, 4)}`, what: 'CIK', boundary: `the filing of ${before.since}`, was: before.cik, now: l.cik, crosswalk: 'the company record carries both (CIK, CIK before); every filing is read from the CIK that filed it', source: "SEC's list of tickers; SEC EDGAR submissions" }] : []),
    ...seg.changes.map((c) => ({ title: `${c.what}, ${c.filed}`, what: c.what, boundary: `the filing of ${c.filed}`, was: c.was, now: c.now, crosswalk: 'the filing itself: it restates the quarter a year before under the new members', source: 'SEC Financial Statement Data Sets' })),
  ];
  if (changes.length) {
    L.push('## Changes', '');
    for (const c of changes) {
      L.push(`### Change: ${l.name}, ${c.title}`, '');
      L.push(`- CIK: ${l.cik}`, `- What: ${c.what}`, `- Boundary: ${c.boundary}`, `- Was: ${c.was}`, `- Now: ${c.now}`, `- Crosswalk: ${c.crosswalk}`, `- Source: ${c.source}`, '');
    }
  }
  out[`${dir}/${page}.md`] = L.join('\n').replace(/\n+$/, '\n');
  // years whose four quarters do not sum to them (V3 counts the same):
  // a year restated whose quarters were not all filed again
  let unreconciled = 0;
  for (const a of l.annual) {
    const qs = l.quarters.filter((q) => q.year === a.year);
    for (const i of [0, 3, 5]) {
      const vs = qs.map((q) => q.values[i]);
      if (qs.length !== 4 || vs.some((v) => v === null) || a.values[i] === null) continue;
      if (Math.abs(vs.reduce((x, y) => x + y, 0) - a.values[i]) > Math.max(3e6, Math.abs(a.values[i]) * 0.0005)) unreconciled++;
    }
  }
  return {
    pages: out, cik: l.cik, name: l.name, page, exchange, ticker, before, sector, sic: code, industry, path: `${dir}/${page}.md`,
    first: l.first, lastQ: lastQ ? `FY${lastQ.year} Q${lastQ.q}` : '',
    counts: { annual: l.annual.length, quarters: l.quarters.length, segments: seg.rows.length, changes: changes.length, tagChanges: l.changes.filter((c) => c.what.endsWith('tag')).length, yearChanges: l.changes.filter((c) => c.what === 'Fiscal year end').length, splits: l.splits.length, unreconciled, segmentChanges: seg.changes.length },
  };
}

// A link from one page of the book to another, as proper and the bench read it back
const rel = (from, to) => {
  const r = path.posix.relative(path.posix.dirname(from), to);
  return (r.startsWith('../') ? '' : './') + r.split('/').map((x) => (x === '..' ? x : enc(x))).join('/');
};

// A company's year, from its ledger: each line its annual card's figure, or
// where the card has none, its four quarters summed where all four are
// filed (reading.md). In millions, as the book writes them; capex and
// buybacks as cash paid out, positive. For the reading pages (reckon.js).
const LINES = { rev: 'Revenue', ni: 'Net income', ocf: 'Operating cash flow', capex: 'Capex', bb: 'Buybacks' };
function yearsOf(l) {
  const ix = Object.fromEntries(Object.entries(LINES).map(([k, n]) => [k, COLUMNS.findIndex(([m]) => m === n)]));
  const sign = { rev: 1, ni: 1, ocf: 1, capex: -1, bb: -1 };
  const years = new Map();
  const ys = [...new Set([...l.annual.map((a) => a.year), ...l.quarters.map((q) => q.year)])].sort((a, b) => a - b);
  for (const y of ys) {
    const a = l.annual.find((x) => x.year === y), qs = l.quarters.filter((q) => q.year === y);
    const v = {};
    for (const k of Object.keys(LINES)) {
      let x = a ? a.values[ix[k]] : null;
      if ((x === null || x === undefined) && qs.length === 4 && qs.every((q) => q.values[ix[k]] !== null && q.values[ix[k]] !== undefined)) x = qs.reduce((t, q) => t + q.values[ix[k]], 0);
      v[k] = x === null || x === undefined ? null : sign[k] * x / 1e6;
    }
    if (Object.values(v).some((x) => x !== null)) years.set(y, { ...v, end: a ? a.end : qs.length === 4 ? qs[3].end : null });
  }
  return years;
}

// The words a reading value stands for: a company's ticker its name,
// linked from the page it is written on; a sector its name, linked.
function wordsFor(values, from, book) {
  const name = (t) => { const c = book.byTicker.get(t); return `[${c.name}](${rel(from, c.path)})`; };
  const sector = (s) => `[${s}](${rel(from, `companies/${safe(s)}.md`)})`;
  const out = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === 'string' && book.byTicker.has(v) && /top|loser|only|next/.test(k)) out[k] = name(v);
    else if (Array.isArray(v) && /next/.test(k)) out[k] = reading.listed(v.map(name));
    else if (typeof v === 'string' && /sector|best|worst/.test(k) && book.sectors.has(v)) out[k] = sector(v);
  }
  return out;
}

// The questions of a page, answered: "**Ask** Answer" a paragraph each,
// with what goes after each (a picture), by the record's id.
function asked(heads, recs, values, words, after = {}, alone = false, names = {}) {
  const L = [];
  for (const r of recs) {
    if (r.kind !== 'Question') continue;
    if (heads[r.id]) L.push(`## ${heads[r.id]}`, '');
    L.push(`**${reading.ask(r, names)}** ${reading.answer(r, values, words, alone)}`, '');
    if (after[r.id]) L.push(...after[r.id]);
  }
  return L;
}

// A sector's page (B7, R2, R4): its record; the questions a reader asks of
// it, answered, its growth drawn and its companies set side by side in a
// grid, largest first; then its companies listed, linked, by name.
function sectorPage(d, done, R, book) {
  const p = `companies/${safe(d.name)}.md`, v = R.sectors[d.name];
  const recs = reading.ofPage('companies/<Sector>.md');
  const words = { ...wordsFor(v, p, book), losers: v.losers === 0 ? 'none' : String(v.losers) };
  const years = R.pictures.years.map((y) => `FY${y}`);
  const after = {};
  if (v.series) {
    after['sector-growth'] = [`The rise in revenue since FY${R.B}, each year, in percent: the sector's ${v.n_same === 1 ? 'one company' : `${v.n_same} companies`} with a revenue and a net income in every year, and all the S&P 500's such companies.`, '',
      '> [!CARD:line] Revenue, rise since FY' + R.B,
      table(['', ...years], [[d.name, ...v.series.sector.map(String)], ['All companies', ...v.series.all.map(String)]], '> '), '> - Unit: percent', ''];
  }
  after['sector-leaders'] = [`Each company by its ticker, the largest by its revenue in FY${R.Y} first: its net income over its revenue each year, in percent, a loss in red (blank where the book has not both); at the right its revenue in FY${R.Y}, in billions, and its revenue's rise since FY${R.B}, in percent.`, '',
    '> [!CARD:grid] Net income over revenue, a company a row',
    table(['Ticker', ...years, 'Revenue', 'Rise'], v.grid.map((g) => [g.c.ticker, ...g.margins.map((m) => (m === null ? '' : String(m))), g.rev === null ? '' : String(g.rev), g.rise === null ? '' : String(g.rise)]), '> '),
    '> - Gutter: Revenue', '> - Gutter: Rise', '> - Top: 30', '> - Bad: -10000--0.1', '> - Unit: percent of revenue kept as net income', ''];
  const values = { ...v, sector: d.name };
  const L = [
    `# Sector: ${d.name}`, '',
    `- Division: ${d.letter}`,
    `- Major groups: ${String(d.from).padStart(2, '0')} to ${d.to}`,
    `- Companies: ${done.length}`, '',
    `The S&P 500's companies whose industry, as the SEC classes it, falls in division ${d.letter} of the Standard Industrial Classification, ${d.name} (its major groups ${String(d.from).padStart(2, '0')} to ${d.to}): ${done.length === 1 ? 'one company' : `${done.length} companies`}, a page each. A year is each company's own fiscal year as it names it; FY${R.Y} is the latest that nearly all of them have closed and filed (see the [front page](${rel(p, 'README.md')})). Dollars are as filed.`, '',
    ...asked({ 'sector-size': 'Size', 'sector-growth': 'Growth', 'sector-leaders': 'Compared' }, recs, values, words, after, v.alone, { sector: d.name }),
    '## Companies', '',
    table(['Company', 'CIK', 'Ticker', 'Exchange', 'Industry', 'First year', 'Last quarter'], [...done].sort((a, b) => a.name.localeCompare(b.name)).map((c) => [
      `[${c.name}](${rel(p, c.path)})`, c.cik, c.ticker || '', c.exchange, c.industry || '', `FY${c.first}`, c.lastQ])), '',
  ];
  return { text: L.join('\n'), kept: Object.fromEntries(recs.map((r) => [r.id, reading.kept(values, r)])) };
}

// A company's opening (R2): the questions of reading.md, answered, after
// its record and before its tables.
function companyOpening(c, R, book) {
  const v = R.companies.get(c.cik), recs = reading.ofPage('companies/<Sector>/<Company>.md');
  const values = { ...v, sector: c.sector, company: c.name };
  const words = { ...wordsFor(v, c.path, book), sector: `[${c.sector}](${rel(c.path, `companies/${safe(c.sector)}.md`)})`,
    loss_n: v.loss_n === 0 ? 'none' : String(v.loss_n),
    loss_list: v.losses.length === 0 ? '' : v.losses.length <= 4 ? ` (${v.losses.map((y) => `FY${y}`).join(', ')})` : ` (${v.losses.slice(0, 3).map((y) => `FY${y}`).join(', ')} and ${v.losses.length - 3} more)` };
  const L = [];
  for (const r of recs) {
    const alone = (r.id === 'company-size' && v.rank === null) || (r.id === 'company-earn' && v.margin === null) || (r.id === 'company-cash' && v.ocf === null);
    L.push(`**${reading.ask(r, { company: c.name })}** ${reading.answer(r, values, words, alone)}`, '');
  }
  return { lines: L, kept: Object.fromEntries(recs.map((r) => [r.id, reading.kept(values, r)])) };
}

// Names alike but for case take their key (B7)
function pageNames(list) {
  const n = new Map();
  for (const c of list) { const k = safe(c.name).toLowerCase(); n.set(k, (n.get(k) || 0) + 1); }
  return list.map((c) => safe(c.name) + (n.get(safe(c.name).toLowerCase()) > 1 ? ` (${c.cik})` : ''));
}

// Two filers' facts as one company's: each tag's rows from both, a
// filing given under both CIKs (a joint filing) once.
function merged(a, b) {
  const out = { cik: a.cik, entityName: a.entityName, facts: {} };
  for (const f of [b, a]) {
    for (const [ns, tags] of Object.entries(f.facts)) {
      out.facts[ns] = out.facts[ns] || {};
      for (const [tag, node] of Object.entries(tags)) {
        const into = (out.facts[ns][tag] = out.facts[ns][tag] || { units: {} });
        for (const [u, rows] of Object.entries(node.units)) {
          const have = (into.units[u] = into.units[u] || []);
          const seen = new Set(have.map((r) => `${r.accn}|${r.start}|${r.end}|${r.val}`));
          for (const r of rows) if (!seen.has(`${r.accn}|${r.start}|${r.end}|${r.val}`)) have.push(r);
        }
      }
    }
  }
  return out;
}

// Why a company's facts give no page, in words true of them: which
// standard it files in, what it has filed yet, and where its revenue is.
function why(facts) {
  const ns = Object.keys(facts.facts);
  const gaap = facts.facts['us-gaap'] || {};
  if (!Object.keys(gaap).length && ns.includes('ifrs-full')) return 'files in IFRS (ifrs-full), not US GAAP: the importer reads us-gaap only';
  const forms = new Set(), rev = [];
  for (const [tag, node] of Object.entries(gaap)) {
    for (const rows of Object.values(node.units)) {
      for (const r of rows) {
        forms.add(r.form);
        if (COLUMNS[0][1].includes(tag) && r.start) rev.push({ ...r, tag, span: days(r.end) - days(r.start) });
      }
    }
  }
  if (!forms.has('10-K') && !forms.has('10-Q')) return `no 10-K or 10-Q filed yet: a new filer, its facts only ${ns.map((n) => (n === 'ffd' ? 'ffd (its filing fees)' : n)).join(', ')}${forms.size ? ` from ${[...forms].join(', ')}` : ''}`;
  const bank = gaap.InterestIncomeExpenseNet && gaap.NoninterestIncome ? '; a bank, it files net interest income and noninterest income instead' : '';
  if (!rev.length) return `no revenue under the tags the importer reads (${COLUMNS[0][1].join(', ')})${bank}`;
  const range = (rs) => { const e = rs.map((r) => r.end).sort(); return e[0] === e[e.length - 1] ? e[0] : `${e[0]} to ${e[e.length - 1]}`; };
  const years = rev.filter((r) => r.span >= 350 && r.span <= 380), quarters = rev.filter((r) => r.span < 350);
  if (!years.length) {
    return `no fiscal year's revenue ${forms.has('10-K') ? 'under the tags the importer reads, its revenue under them' : 'filed yet (no 10-K), its revenue'} only for parts of a year, ending ${range(quarters)} (${[...new Set(quarters.map((r) => `${r.form} us-gaap:${r.tag}`))].join(', ')})${bank}`;
  }
  if (!forms.has('10-Q')) return `revenue for whole years only (${range(years)}), no 10-Q filed yet to give its quarters`;
  return `revenue for whole years only (${range(years)}, us-gaap:${years[0].tag}), its 10-Qs filing no total revenue under the tags the importer reads${bank}`;
}

// the days the facts were fetched: one, or the first and the last
function fetched(files) {
  const d = files.filter((f) => fs.existsSync(f)).map((f) => fs.statSync(f).mtime.toISOString().slice(0, 10)).sort();
  return d[0] === d[d.length - 1] ? d[0] : `${d[0]} to ${d[d.length - 1]}`;
}

function main() {
  const edgarDir = path.join(CACHE, 'edgar');
  const members = JSON.parse(fs.readFileSync(path.join(__dirname, '../members.json'), 'utf8'));
  // a name as the company goes by it: the SEC's list marks some with their
  // state of incorporation ("BANK OF AMERICA CORP /DE/"), which is no part of it
  for (const m of members.members) m.name = m.name.replace(/\s*\/[A-Z]{2}\/?\s*$/, '').trim();
  const successors = new Map(JSON.parse(fs.readFileSync(path.join(__dirname, 'successors.json'), 'utf8')).successors.map((s) => [s.cik, s]));
  const file = (cik) => path.join(edgarDir, `CIK${cik}.json`);
  // a company's facts, read when wanted (2 GB in all), with its old filer's
  const load = (m) => {
    if (!fs.existsSync(file(m.cik))) return null;
    const facts = JSON.parse(fs.readFileSync(file(m.cik), 'utf8'));
    const s = successors.get(m.cik);
    return s ? merged(facts, JSON.parse(fs.readFileSync(file(s.filer), 'utf8'))) : facts;
  };
  const fsdsDir = path.join(CACHE, 'fsds');
  const extracted = fsds.extractAll([...members.members.map((m) => m.cik), ...[...successors.values()].map((s) => s.filer)], fsdsDir);
  if (extracted) console.log(`FSDS: ${extracted} companies' rows read from ${fsds.cachedQuarters(fsdsDir).join(', ')}`);

  // each member's industry: the SEC's code from its latest filing in the
  // FSDS cached (a moved company's, from either filer), its title and division
  const quarters = fsds.cachedQuarters(fsdsDir);
  const codes = sic.codes([...members.members.map((m) => m.cik), ...[...successors.values()].map((s) => s.filer)], fsdsDir, quarters);
  const titles = sic.titles();
  const industryOf = (m) => {
    const s = successors.get(m.cik);
    const code = codes.get(m.cik) || (s ? codes.get(s.filer) : '') || '';
    const d = code ? sic.division(code) : null;
    if (code && !titles.has(code)) throw new Error(`${m.name}: SIC ${code} is not in the SEC's list`);
    return { sic: code, industry: code ? titles.get(code) : '', division: d };
  };

  // the first pass: the annual card's years, every company's, one span; and
  // each company's years for the reading pages
  let lo = Infinity, hi = -Infinity;
  const yearsBy = new Map();
  for (const m of members.members) {
    const facts = load(m);
    const l = facts && ledger(facts);
    if (!l || l.skip) continue;
    for (const a of l.annual) { lo = Math.min(lo, a.year); hi = Math.max(hi, a.year); }
    yearsBy.set(m.cik, yearsOf(l));
  }
  const span = [];
  for (let y = lo; y <= hi; y++) span.push(y);

  // the reading's figures, from the book's own (reckon.js); a company with
  // no SIC code in the FSDS cached stops the import: its sector is unknown
  const names = pageNames(members.members);
  const book = { byTicker: new Map(), sectors: new Set() };
  const rows = [];
  members.members.forEach((m, i) => {
    if (!yearsBy.has(m.cik)) return;
    const ind = industryOf(m);
    if (!ind.division) throw new Error(`${m.name} (CIK ${m.cik}): no SIC code in the FSDS cached (${quarters.join(', ')}), so no sector`);
    const sector = ind.division.name;
    book.byTicker.set(m.ticker, { name: m.name, path: `companies/${safe(sector)}/${names[i]}.md` });
    book.sectors.add(sector);
    rows.push({ cik: m.cik, ticker: m.ticker, sector, years: yearsBy.get(m.cik) });
  });
  const R = reckon(rows);
  const kept = {};

  const pages = {}, done = [], skipped = [];
  members.members.forEach((m, i) => {
    const facts = load(m);
    if (!facts) { skipped.push({ cik: m.cik, name: m.name, ticker: m.ticker, reason: 'the SEC has no companyfacts for its CIK' }); return; }
    const s = successors.get(m.cik);
    // the new filer's first 10-Q or 10-K, from its own facts
    const since = s && Object.values(JSON.parse(fs.readFileSync(file(m.cik), 'utf8')).facts['us-gaap'] || {})
      .flatMap((n) => Object.values(n.units).flat()).filter((r) => /^10-[KQ]$/.test(r.form)).map((r) => r.filed).sort()[0];
    const fr = [m.cik, ...(s ? [s.filer] : [])].flatMap((c) => fsds.companyRows(c, fsdsDir).rows);
    const ind = industryOf(m);
    const input = { facts, fsdsRows: fr, exchange: m.exchange || 'No exchange listed', ticker: m.ticker, tickers: m.tickers, span, name: m.name, page: names[i], before: s ? { cik: s.filer, why: s.why, since } : null,
      sic: ind.sic, industry: ind.industry, sector: ind.division ? ind.division.name : '' };
    if (yearsBy.has(m.cik)) {
      const o = companyOpening({ cik: m.cik, name: m.name, sector: input.sector, path: book.byTicker.get(m.ticker).path }, R, book);
      input.reading = o.lines;
      kept[book.byTicker.get(m.ticker).path] = o.kept;
    }
    const c = company(input);
    if (c.skip) { skipped.push({ cik: m.cik, name: m.name, ticker: m.ticker, reason: why(facts) }); return; }
    Object.assign(pages, c.pages);
    done.push(c);
  });
  const sectors = sic.DIVISIONS.filter((d) => done.some((c) => c.sector === d.name));
  for (const d of sectors) {
    const sp = sectorPage(d, done.filter((c) => c.sector === d.name), R, book);
    pages[`companies/${safe(d.name)}.md`] = sp.text;
    kept[`companies/${safe(d.name)}.md`] = sp.kept;
  }

  // write: the companies folder whole, so a page no longer made is gone
  fs.rmSync(path.join(REPO, 'companies'), { recursive: true, force: true });
  for (const [p, text] of Object.entries(pages)) {
    fs.mkdirSync(path.dirname(path.join(REPO, p)), { recursive: true });
    fs.writeFileSync(path.join(REPO, p), text);
  }
  const sum = (k) => done.reduce((a, c) => a + c.counts[k], 0);
  const counts = {
    about: 'What the importer wrote, for target.sql (V3) to compare with what proper gathers.',
    members_as_of: members.as_of, members: members.companies, stocks_held: members.stocks_held,
    companies: done.length, skipped: skipped.length,
    sectors: sectors.length, year: R.Y,
    annual: sum('annual'), quarters: sum('quarters'), segments: sum('segments'), changes: sum('changes'),
    tag_changes: sum('tagChanges'), splits: sum('splits'), unreconciled: sum('unreconciled'), year_changes: sum('yearChanges'), segment_changes: sum('segmentChanges'),
    successors: done.filter((c) => c.before).length,
    span: `FY${span[0]} to FY${span[span.length - 1]}`, pages: Object.keys(pages).length,
    fsds_quarters: fsds.cachedQuarters(fsdsDir).join(', '),
    classes: members.members.filter((m) => m.tickers.length > 1).map((m) => m.tickers.join(' and ')).join('; '),
    facts_fetched: fetched([...members.members.map((m) => m.cik), ...[...successors.values()].map((s) => s.filer)].map(file)),
  };
  if (counts.companies + counts.skipped !== counts.members) throw new Error(`${counts.companies} written and ${counts.skipped} skipped, of ${counts.members} members`);
  fs.writeFileSync(path.join(__dirname, 'counts.json'), JSON.stringify(counts, null, 1) + '\n');
  fs.writeFileSync(path.join(__dirname, 'skipped.json'), JSON.stringify(skipped, null, 1) + '\n');
  const front = require('./readme').write({ counts, skipped, sectors, done, members, R, book, rel, rows });
  kept['README.md'] = front;
  // a finding turned since the last release is said (R3): news, or a fault
  const readingFile = path.join(__dirname, '../reading.json');
  const turned = reading.turned(readingFile, kept);
  reading.save(readingFile, kept);
  if (turned.length) console.log(`${turned.length} findings turned since the last release: read each, and say it in the release`);
  console.log(`${done.length} companies of ${counts.members} members, ${skipped.length} listed with their reasons, ${counts.pages} pages, ${counts.changes} changes`);
}

module.exports = { company, sectorPage, yearsOf, safe, link, rel, pageNames, merged };
if (require.main === module) main();

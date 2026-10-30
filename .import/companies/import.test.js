// The importer's tests: every vector in vectors/ (V2: a company's facts
// and FSDS rows in, its pages out, exactly), the splits found and not
// found across the members, and the derivations v1 held (proper.md-v1
// packages/earnings/test).
//
//   node --test .import/companies/import.test.js

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { company, safe, link, pageNames, merged, yearsOf, rel } = require('./import');
const { reckon, theYear } = require('./reckon');
const reading = require('../reading');
const sic = require('./sic');
const { periodValues, fiscalLabels, splits, ledger } = require('./edgar');
const { subsetSummingTo } = require('./fsds');

const dir = path.join(__dirname, 'vectors');
const vectors = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
test('there are vectors', () => assert.ok(vectors.length > 0));
for (const f of vectors) {
  const v = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  test(`${f} (${v.rule}): ${v.about}`, () => {
    const built = company(v.input);
    const pages = built.pages || { skip: built.skip };
    assert.deepStrictEqual(Object.keys(pages).sort(), Object.keys(v.output).sort());
    for (const [k, t] of Object.entries(v.output)) assert.strictEqual(pages[k], t, k);
  });
}

// the splits: a company's facts in, the splits found out (D2)
const splitDir = path.join(dir, 'splits');
for (const f of fs.readdirSync(splitDir).filter((x) => x.endsWith('.json')).sort()) {
  const v = JSON.parse(fs.readFileSync(path.join(splitDir, f), 'utf8'));
  test(`splits/${f} (${v.rule}): ${v.about}`, () => assert.deepStrictEqual(splits(v.input.facts), v.output.splits));
}

// two filers' facts as one company's: each filing once (K1)
test('K1: a new filer and the old, their facts together, a joint filing once', () => {
  const row = (accn, end, val) => ({ start: end.slice(0, 8) + '01', end, val, accn, fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-03' });
  const a = { cik: '2115436', entityName: 'New', facts: { 'us-gaap': { Revenues: { units: { USD: [row('x-1', '2026-06-30', 2), row('j-1', '2026-03-31', 1)] } } } } };
  const b = { cik: 34088, entityName: 'Old', facts: { 'us-gaap': { Revenues: { units: { USD: [row('j-1', '2026-03-31', 1), row('o-1', '2025-12-31', 9)] } } }, dei: {} } };
  const m = merged(a, b);
  assert.strictEqual(m.cik, '2115436');
  assert.deepStrictEqual(m.facts['us-gaap'].Revenues.units.USD.map((r) => r.accn).sort(), ['j-1', 'o-1', 'x-1']);
});

// v1's derivations, on the first vector's facts (Apple's own)
const apple = JSON.parse(fs.readFileSync(path.join(dir, 'apple-fy2024-2025.json'), 'utf8')).input.facts;
const label = fiscalLabels(apple);
test('periods are classed by their dates; Q4 is the year less nine months', () => {
  const y = periodValues(apple, 'RevenueFromContractWithCustomerExcludingAssessedTax', label).get(2024);
  assert.deepStrictEqual(y.quarters, [119575000000, 90753000000, 85777000000, 94930000000]);
  assert.strictEqual(y.fy, 391035000000);
});
test('cash flow filed only as running totals: its quarters sum to the year', () => {
  const y = periodValues(apple, 'NetCashProvidedByUsedInOperatingActivities', label).get(2025);
  assert.ok(y.quarters.every((v) => v !== null));
  assert.strictEqual(y.quarters.reduce((a, b) => a + b, 0), y.fy);
});
test('a fiscal year is named as the company names it', () => {
  assert.strictEqual(label('2023-10-01', '2024-09-28'), 2024);
});
test('a subtotal member is found by a subset summing to it', () => {
  assert.deepStrictEqual(subsetSummingTo([10, 20, 5, 7], 27), [1, 3]);
  assert.strictEqual(subsetSummingTo([10, 20], 31), null);
});

// B7: names made safe, links read back, names alike but for case keyed
test('B7: names and links', () => {
  assert.strictEqual(safe('WELLS        FARGO & COMPANY/MN'), 'WELLS FARGO & COMPANY-MN');
  assert.strictEqual(safe('Apple Inc.'), 'Apple Inc');
  assert.strictEqual(link('Nasdaq/Apple Inc/2024.md'), './Nasdaq/Apple%20Inc/2024.md');
  assert.strictEqual(link('NYSE/LOWE’S COMPANIES, INC.md'), './NYSE/LOWE%E2%80%99S%20COMPANIES,%20INC.md');
  assert.deepStrictEqual(pageNames([{ name: 'Dup Co', cik: '1' }, { name: 'DUP CO', cik: '2' }, { name: 'Other', cik: '3' }]), ['Dup Co (1)', 'DUP CO (2)', 'Other']);
});

// The reading pages (SPEC R2, R3): a company's year, the year compared, words filled
test('R: a year the annual card lacks is its four quarters summed, where all four are filed', () => {
  const q = (year, n, rev, ni) => ({ year, q: n, end: `${year}-0${n * 2}-28`, values: [rev, null, null, ni, null, null, null, null] });
  const l = { annual: [{ year: 2024, end: '2024-12-31', values: [100e6, null, null, 10e6, null, null, -5e6, null] }],
    quarters: [q(2025, 1, 30e6, 3e6), q(2025, 2, 30e6, 3e6), q(2025, 3, 30e6, null), q(2025, 4, 40e6, 4e6)] };
  const y = yearsOf(l);
  assert.deepStrictEqual(y.get(2024), { rev: 100, ni: 10, ocf: null, capex: 5, bb: null, end: '2024-12-31' });
  assert.deepStrictEqual(y.get(2025), { rev: 130, ni: null, ocf: null, capex: null, bb: null, end: '2025-08-28' });
});
test('R: the year compared is the latest that 95 of every 100 companies with the year before have', () => {
  const c = (t, ys) => ({ cik: t, ticker: t, sector: 'S', years: new Map(ys.map((y) => [y, { rev: 1, ni: 1, ocf: 1, capex: 0, bb: 0 }])) });
  const cs = Array.from({ length: 20 }, (_, i) => c(`T${i}`, i < 19 ? [2023, 2024, 2025] : [2023, 2024]));
  assert.strictEqual(theYear(cs), 2025); // 19 of 20
  cs[18].years.delete(2025);
  assert.strictEqual(theYear(cs), 2024); // 18 of 20
});
test('R: a value the book lacks leaves the answer saying so, never a guess', () => {
  const rec = { Answer: 'It sold {rev:$}, the {rank:th} most, {m:%}.' };
  assert.strictEqual(reading.answer(rec, { rev: 416161, rank: 4, m: 26.9 }), 'It sold $416.2 billion, the 4th most, 26.9%.');
  assert.match(reading.answer(rec, { rev: null, rank: 4, m: 1 }), /^The book does not say/);
});
test('R: a sector is the SIC division of the SEC\'s code', () => {
  assert.strictEqual(sic.division('3571').name, 'Manufacturing');
  assert.strictEqual(sic.division('6021').name, 'Finance, Insurance, and Real Estate');
  assert.strictEqual(sic.division('1311').name, 'Mining');
  assert.strictEqual(rel('companies/Mining/X.md', 'companies/Services/Y Z.md'), '../Services/Y%20Z.md');
});

// DECISIONS 35: a figure under 1/500 of its neighbours is a stop, and names the company-year
test('V2: a unit gone wrong in a 10-K (net income 1,346 thousand-fold small) is a stop naming the company-year', () => {
  const facts = JSON.parse(JSON.stringify(JSON.parse(fs.readFileSync(path.join(dir, 'con-edison-proxy-scale.json'), 'utf8')).input.facts));
  assert.deepStrictEqual(ledger(facts).stops, []);
  for (const r of facts.facts['us-gaap'].NetIncomeLoss.units.USD) if (r.end === '2021-12-31' && r.form === '10-K') r.val /= 1000;
  const stops = ledger(facts).stops;
  assert.strictEqual(stops.length, 1);
  assert.match(stops[0], /CONSOLIDATED EDISON INC, FY2021, Net income: 1\.346 million against 1101 and 1660/);
});
test('V2: a company-year the unit check stopped and a filing showed true is not a stop (unit-checked.json)', () => {
  const checked = JSON.parse(fs.readFileSync(path.join(__dirname, 'unit-checked.json'), 'utf8')).checked;
  assert.ok(checked.length > 0 && checked.every((k) => k.cik && k.year && k.line && k.why));
});
test('D5: a magnitude guard on a tag move: a sliver tag is kept out of the line and said', () => {
  for (const f of ['metlife-revenue-sliver.json', 'crown-castle-revenue-sliver.json']) {
    const out = Object.values(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).output)[0];
    assert.match(out, /- What: Revenue tag kept/);
  }
});
test('D5: net income moving between tags, the two far apart, is said in its Change (Ares, FY2014)', () => {
  const out = Object.values(JSON.parse(fs.readFileSync(path.join(dir, 'ares-net-income-tags.json'), 'utf8')).output)[0];
  assert.match(out, /- What: Net income tag\n[^]*- Crosswalk: FY2014 under both: 545662000 and 34988000; the new tag's figure is under half/);
});

// DECISIONS 46-49 (the third mend): a quarter is no year; a part is no revenue; a gap and a restatement are said
const pageOf = (f) => Object.values(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).output)[0];
test('V2: a 10-Q row of a year equal to its own quarter is not read, a 10-Q recast of a year is (Comfort Systems, Ecolab)', () => {
  const row = (start, end, val, form, accn, filed) => ({ start, end, val, form, accn, filed, fy: 2025, fp: 'FY' });
  const rows = [
    row('2025-01-01', '2025-12-31', 9000e6, '10-K', 'k-1', '2026-02-19'),
    row('2025-01-01', '2025-03-31', 1800e6, '10-Q', 'q-1', '2026-04-23'),
    row('2025-01-01', '2025-12-31', 1800e6, '10-Q', 'q-1', '2026-04-23'),
  ];
  const f = { cik: 1, entityName: 'X', facts: { 'us-gaap': { Revenues: { units: { USD: rows } } } } };
  const year = (fs_) => periodValues(fs_, 'Revenues', fiscalLabels(fs_)).get(2025);
  assert.strictEqual(year(f).fy, 9000e6);
  // the same year recast in a later 10-Q, a value of its own: read
  rows.push(row('2025-01-01', '2025-12-31', 8000e6, '10-Q', 'q-2', '2026-07-23'));
  assert.strictEqual(year(f).fy, 8000e6);
});
test('D5: a revenue under a tenth of the year\'s net income is a part: the first filed whole year, or blank (Camden)', () => {
  const out = pageOf('camden-fy2017-revenue-part.json');
  assert.strictEqual((out.match(/- What: Revenue part/g) || []).length, 2);
  assert.match(out, /\| Revenue \| 876\.447 \| 900\.896 \| 954\.505 \|  \|  \|  \|/);
});
test('D6: a gap is a Change that fills nothing: the cells stay empty, the filings\' words beside them (Pfizer)', () => {
  const out = pageOf('pfizer-fy2014-revenue-gap.json');
  assert.match(out, /- What: Revenue gap\n- Boundary: FY2014\n[^]*- Now: no figure for FY2014 to FY2015; FY2016: 52824/);
  assert.match(out, /\| Revenue \|[^\n]* 51584 \|  \|  \| 52824 \|/);
});
test('B10: years a later filing states under half or over twice what the first gave are a Restatement, a run a record (Motorola, Erie)', () => {
  const m = pageOf('motorola-fy2008-restated.json');
  assert.match(m, /- What: Revenue restatement\n- Boundary: FY2008\n[^]*FY2008: 30146 first filed \(10-K, 2010-02-16\), 8140 last filed \(8-K, 2011-05-12\)/);
  assert.strictEqual((m.match(/- What: Revenue restatement/g) || []).length, 1);
  assert.match(pageOf('erie-fy2013-restated.json'), /- What: Revenue restatement\n- Boundary: FY2013/);
});

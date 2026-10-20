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
const { periodValues, fiscalLabels, splits } = require('./edgar');
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

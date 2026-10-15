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
const { company, safe, link, pageNames, merged } = require('./import');
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

// faq.js, held by five questions, one of each Type, their answers worked
// out from the sources and their records frozen (SPEC B9, V2). A change
// here is a change in what FAQ.md says: say why in DECISIONS.md.
//   node --test .import/faq.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const faq = require('./faq');

const questions = faq.parse(fs.readFileSync(path.join(__dirname, 'faq.md'), 'utf8'));
const q = (id) => questions.find((x) => x.id === id);
const FIVE = ['co-lookup-1', 'co-page-1', 'co-across-4', 'co-gap-1', 'co-change-1'];
const A = faq.compute(FIVE);

test('faq.md: 35 questions, ids unique, every one with the same keys', () => {
  assert.strictEqual(questions.length, 35);
  assert.strictEqual(new Set(questions.map((x) => x.id)).size, 35);
  for (const x of questions) assert.deepStrictEqual(Object.keys(x), ['id', 'Tier', 'Ask', 'Type', 'Tolerance', 'Rules', 'How', 'Look in']);
});

test('every rung of the ladder, at least two Gap and two Analysis', () => {
  const n = (t) => questions.filter((x) => x.Tier === t).length;
  for (const t of ['Lookup', 'Page', 'Across', 'Join', 'Change', 'Nearby']) assert.ok(n(t) >= 1, t);
  assert.ok(n('Gap') >= 2 && n('Analysis') >= 2);
});

test('one of each Type', () => {
  assert.deepStrictEqual(FIVE.map((id) => q(id).Type), ['number', 'set', 'list', 'none', 'judge']);
});

test('the answers, from the source', () => {
  assert.strictEqual(A['co-lookup-1'].answer, 391035);
  assert.deepStrictEqual(A['co-page-1'].answer, ['Nasdaq']);
  assert.deepStrictEqual(A['co-across-4'].answer, ['WMT', 'AMZN', 'UNH', 'AAPL', 'CVS']);
  assert.strictEqual(A['co-gap-1'].answer, null);
  assert.deepStrictEqual(A['co-change-1'].answer, [11.89, 2.97]);
});

const RECORDS = {
  "co-lookup-1": `### Question: co-lookup-1

- Tier: Lookup
- Ask: What was Apple's revenue in its fiscal year 2024, in millions of dollars?
- Answer: 391035
- Type: number
- Tolerance: 0
- Look in: [companies/Manufacturing/Apple Inc](./companies/Manufacturing/Apple%20Inc.md)

companyfacts CIK0000320193, us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax, 2023-10-01 to 2024-09-28 (Apple's fiscal 2024), latest filed: 391035000000.
`,
  "co-page-1": `### Question: co-page-1

- Tier: Page
- Ask: On which exchange do Walmart's shares trade, as the SEC lists it?
- Answer: Nasdaq
- Type: set
- Tolerance:
- Look in: [companies/Retail Trade/Walmart Inc](./companies/Retail%20Trade/Walmart%20Inc.md)

company_tickers_exchange.json: CIK 104169, Walmart Inc., WMT, Nasdaq. (Walmart moved its listing from the NYSE to Nasdaq in December 2025.)
`,
  "co-across-4": `### Question: co-across-4

- Tier: Across
- Ask: Which five companies in this book had the most revenue in the year each calls its fiscal 2024, most first?
- Answer: WMT (642637), AMZN (637959), UNH (400278), AAPL (391035), CVS (372809)
- Type: list
- Tolerance:
- Look in: [companies/Retail Trade/Walmart Inc](./companies/Retail%20Trade/Walmart%20Inc.md), [companies/Retail Trade/AMAZON COM INC](./companies/Retail%20Trade/AMAZON%20COM%20INC.md), [companies/Finance, Insurance, and Real Estate/UNITEDHEALTH GROUP INC](./companies/Finance,%20Insurance,%20and%20Real%20Estate/UNITEDHEALTH%20GROUP%20INC.md), [companies/Manufacturing/Apple Inc](./companies/Manufacturing/Apple%20Inc.md), [companies/Retail Trade/CVS HEALTH Corp](./companies/Retail%20Trade/CVS%20HEALTH%20Corp.md)

Revenue (the first of the revenue tags filed for the year and in its 10-Qs) for the year each company names 2024, latest filed: WMT 2023-02-01 to 2024-01-31, us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax; AMZN 2024-01-01 to 2024-12-31, us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax; UNH 2024-01-01 to 2024-12-31, us-gaap:Revenues; AAPL 2023-10-01 to 2024-09-28, us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax; CVS 2024-01-01 to 2024-12-31, us-gaap:Revenues.
`,
  "co-gap-1": `### Question: co-gap-1

- Tier: Gap
- Ask: What was Apple's closing price on 2008-01-02?
- Answer: The book does not say.
- Type: none
- Tolerance:
- Look in:

The book holds no prices: it is the SEC's filings alone (DECISIONS 15).
`,
  "co-change-1": `### Question: co-change-1

- Tier: Change
- Ask: Apple's diluted earnings per share for its fiscal year 2019: what did Apple first file, and what is it a share as the shares are now? Why do they differ?
- Answer: 11.89 as first filed (2019-10-31); 2.97 as filed since 2020-10-30, a share after the 4 for 1 split of August 2020
- Type: judge
- Tolerance:
- Look in: [companies/Manufacturing/Apple Inc](./companies/Manufacturing/Apple%20Inc.md)

us-gaap:EarningsPerShareDiluted, 2018-09-30 to 2019-09-28: first filed and latest filed.
`,
};

for (const id of FIVE) {
  test(`the record of ${id}, as FAQ.md writes it`, () => {
    assert.strictEqual(faq.record(q(id), A[id]), RECORDS[id]);
  });
}

test('a Look in that leads nowhere is refused', () => {
  assert.throws(() => faq.record({ ...q('co-lookup-1'), 'Look in': 'companies/Nowhere.md' }, A['co-lookup-1']), /Nowhere/);
});

test('a Gap question with no Look in is let be; any other is refused', () => {
  assert.throws(() => faq.record({ ...q('co-lookup-1'), 'Look in': '' }, A['co-lookup-1']), /Look in/);
});

test('a Gap question given an answer is refused', () => {
  assert.throws(() => faq.record(q('co-gap-1'), { answer: 1, note: '' }), /Gap/);
});

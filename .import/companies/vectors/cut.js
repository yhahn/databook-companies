// Cuts the vectors (SPEC V2) from the cache: a few of a real company's
// facts and FSDS rows in, its pages out as the importer writes them
// now. Run only on purpose, after the output has been read against the
// source (each vector's `about` says what was checked); then the output
// is frozen, and import.test.js holds the importer to it.
//
//   node .import/companies/vectors/cut.js

const fs = require('fs');
const path = require('path');
const { company, merged } = require('../import');
const { splits } = require('../edgar');

const CACHE = path.join(process.env.HOME, '.cache/proper/earnings');
const facts = (cik) => JSON.parse(fs.readFileSync(path.join(CACHE, 'edgar', `CIK${cik}.json`), 'utf8'));

// a company's facts, cut to some tags and the periods ending in [from, to]
// (and the SEC's split facts, of any period)
function trim(f, tags, from, to) {
  const out = { cik: f.cik, entityName: f.entityName, facts: { 'us-gaap': {} } };
  tags = [...tags, ...Object.keys(f.facts['us-gaap']).filter((t) => /StockSplitConversionRatio/.test(t))];
  for (const tag of tags) {
    const node = f.facts['us-gaap'][tag];
    if (!node) continue;
    const units = {};
    for (const [u, rows] of Object.entries(node.units)) {
      const kept = rows.filter((r) => (r.end >= from && r.end <= to) || /StockSplitConversionRatio/.test(tag))
        .map(({ start, end, val, accn, fy, fp, form, filed }) => ({ start, end, val, accn, fy, fp, form, filed }));
      if (kept.length) units[u] = kept;
    }
    out.facts['us-gaap'][tag] = { units };
  }
  return out;
}

// a split vector: a company's facts in, the splits found out
function splitVector(file, rule, about, facts) {
  const v = { rule, about, input: { facts }, output: { splits: splits(facts) } };
  fs.mkdirSync(path.join(__dirname, 'splits'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'splits', file), JSON.stringify(v, null, 1) + '\n');
  console.log(`splits/${file}`, v.output.splits.length, 'splits');
}

function vector(file, rule, about, input) {
  const built = company(input);
  const v = { rule, about, input, output: built.pages || { skip: built.skip } };
  fs.writeFileSync(path.join(__dirname, file), JSON.stringify(v, null, 1) + '\n');
  console.log(file, Object.keys(v.output).length, 'pages');
}

const AAPL = '0000320193';
const apple = facts(AAPL);
const extract = JSON.parse(fs.readFileSync(path.join(CACHE, 'fsds/extract', `CIK${AAPL}.json`), 'utf8')).rows;

vector('apple-fy2024-2025.json', 'V2',
  "Apple's FY2024 and FY2025 from its own facts: revenue filed a quarter at a time; operating cash flow, capex and buybacks only as running totals (3, 6, 9 months, the year), so each quarter is the total less the one before and Q4 the year less nine months. Checked against Apple's 10-Ks and 10-Qs: FY2024 revenue 119,575, 90,753, 85,777, 94,930 = 391,035 ($M); FY2025 operating cash flow by quarter sums to its year, 111,482. No segments: the page says so.",
  { facts: trim(apple, ['RevenueFromContractWithCustomerExcludingAssessedTax', 'GrossProfit', 'NetIncomeLoss', 'EarningsPerShareDiluted', 'NetCashProvidedByUsedInOperatingActivities', 'PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsForRepurchaseOfCommonStock'], '2023-10-01', '2025-09-30'),
    fsdsRows: [], exchange: 'Nasdaq', ticker: 'AAPL', name: 'Apple Inc.', span: [2024, 2025] });

vector('apple-revenue-tags.json', 'D5',
  "Apple's revenue under three tags: SalesRevenueNet to FY2016, Revenues in FY2017, RevenueFromContractWithCustomerExcludingAssessedTax (ASC 606) from FY2018. Each move a Change, said and not split; the crosswalk the boundary year under both tags where both were filed (FY2017 229,234 under both, FY2018 265,595 under both). The Tags table gives the runs.",
  { facts: trim(apple, ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'], '2015-09-01', '2018-09-30'),
    fsdsRows: [], exchange: 'Nasdaq', ticker: 'AAPL', name: 'Apple Inc.', span: [2016, 2017, 2018] });

const ms = facts('0000895421');
vector('morgan-stanley-year-end.json', 'D5',
  "Morgan Stanley's fiscal year moved: FY2008 ended 2008-11-30, FY2009 2009-12-31, with December 2008 a transition month between, filed apart (revenue -937, as the 10-K for 2010 restates it; -968 in 2009's): the crosswalk. Calendar 2008's quarters, refiled after the move as comparatives, are none of fiscal 2008's (Dec-Nov) and are not placed in it: FY2008's quarters are blank, its year whole. Checked against its 10-K for 2009, which reports the one-month transition period apart.",
  { facts: trim(ms, ['Revenues', 'NetIncomeLoss'], '2007-11-30', '2010-12-31'),
    fsdsRows: [], exchange: 'NYSE', ticker: 'MS', name: 'MORGAN STANLEY', span: [2008, 2009, 2010] });

vector('apple-segments.json', 'V2',
  "Apple's FY2025 Q1 and Q2 segments from FSDS (its 10-Qs filed 2025-01-31 and 2025-05-02: Product, the four hardware lines' sum, left out as a subtotal).",
  { facts: trim(apple, ['RevenueFromContractWithCustomerExcludingAssessedTax'], '2024-09-01', '2025-09-30'),
    fsdsRows: extract.filter((r) => r.qtrs === 1 && (r.ddate === '2024-12-31' || r.ddate === '2025-03-31') && r.filed < '20250601'),
    exchange: 'Nasdaq', ticker: 'AAPL', name: 'Apple Inc.', span: [2025] });

vector('apple-split-2014.json', 'D2',
  "Apple's 7 for 1 split of 2014, found in its filings: FY2012's EPS filed 44.15 (10-K, 2012-10-31), then 6.31 (10-K, 2014-10-27); its FY2013 quarters likewise, all by filings within a year: one split, dated by the first filing restating (the 10-Q of 2014-07-23). A Change says it, with that period both ways; EPS adjusted divides by 7 what was filed before it (FY2012 Q1, 13.87 as filed, 1.9814 adjusted), and leaves what was filed after. Checked against Apple's 10-K for FY2014, which restates FY2012 and FY2013 per share.",
  { facts: trim(apple, ['SalesRevenueNet', 'EarningsPerShareDiluted'], '2011-09-24', '2014-09-27'),
    fsdsRows: [], exchange: 'Nasdaq', ticker: 'AAPL', name: 'Apple Inc.', span: [2012, 2013, 2014] });

vector('amazon-2011-refiled.json', 'V2',
  "Amazon's 2011 quarters: its 10-K for 2012 files 2012's quarters again under 2011's dates (Q1 13,185, where its 10-Q and 10-K for 2011 filed 9,857), so as last filed they sum 13,016 past the year's 48,077. As first filed they sum to it, and are taken: 9,857, 9,913, 10,876, 17,431 (checked against Amazon's 10-K for 2011, its quarterly results).",
  { facts: trim(facts('0001018724'), ['SalesRevenueNet'], '2011-01-01', '2011-12-31'),
    fsdsRows: [], exchange: 'Nasdaq', ticker: 'AMZN', name: 'AMAZON COM INC', span: [2011] });

vector('foreign-filer.json', 'V2',
  'A company whose facts hold no us-gaap revenue (a foreign filer, its statements in IFRS) writes no page, and is listed as skipped.',
  { facts: { cik: 1, entityName: 'A Foreign Filer', facts: { 'us-gaap': {} } }, fsdsRows: [], exchange: 'NYSE', ticker: 'FF', name: 'A Foreign Filer', span: [2025] });

// The splits, after the FAQ (10-15): one period restated is no split; a
// split the EPS of one period and its shares agree on is one.
const EPS_SHARES = ['EarningsPerShareDiluted', 'EarningsPerShareBasic', 'WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingBasic'];
vector('amd-2018-no-split.json', 'D2',
  "AMD's 2017 quarters, restated in 2018 for a new revenue standard (ASC 606): Q1 EPS -0.08 then -0.04, the nine months -0.02 then -0.01, a ratio of 2 in cents too few to tell from chance, and its shares refiled 1,039 million then 952 million, no split's inverse. No split: no Change, and EPS adjusted is EPS as filed. AMD has not split since 2000 (its 10-K for 2018 names none).",
  { facts: trim(facts('0000002488'), ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', ...EPS_SHARES], '2017-01-01', '2017-12-31'),
    fsdsRows: [], exchange: 'Nasdaq', ticker: 'AMD', name: 'ADVANCED MICRO DEVICES INC', span: [2017] });

vector('bank-of-america-name.json', 'B7',
  "A company is named by the SEC's list of tickers: Bank of America's companyfacts give its entityName as BofA Finance LLC, a co-registrant's (its debt issuer); the list names CIK 0000070858 BANK OF AMERICA CORP /DE/, and so does its page.",
  { facts: trim(facts('0000070858'), ['Revenues', 'NetIncomeLoss'], '2024-01-01', '2024-12-31'),
    fsdsRows: [], exchange: 'NYSE', ticker: 'BAC', name: 'BANK OF AMERICA CORP /DE/', span: [2024] });

const xomFiler = { cik: '0000034088', why: 'ExxonMobil Holdings Corp (CIK 0002115436) became Exxon Mobil Corporation\'s parent in 2026 and took the ticker XOM; Exxon Mobil Corporation\'s filings, to its 10-Q of 2026-05-04, are under CIK 0000034088.', since: '2026-08-03' };
vector('exxon-new-cik.json', 'K1',
  "Exxon Mobil: the SEC's list gives XOM to ExxonMobil Holdings Corp (CIK 0002115436), whose first 10-Q (2026-08-03) files 2026's second quarter; the years before are Exxon Mobil Corporation's, under CIK 0000034088. The two filers' facts together, each filing from the CIK that filed it: FY2025's revenue 332,238 (10-K, 2026-02-18, CIK 0000034088) and FY2026 Q2's 116,017 (10-Q, 2026-08-03, CIK 0002115436). Keyed by the new CIK, the old beside it (CIK before) and a Change saying so.",
  { facts: merged(trim(facts('0002115436'), ['Revenues', 'NetIncomeLoss'], '2025-01-01', '2026-06-30'), trim(facts('0000034088'), ['Revenues', 'NetIncomeLoss'], '2025-01-01', '2026-06-30')),
    fsdsRows: [], exchange: 'NYSE', ticker: 'XOM', name: 'ExxonMobil Holdings Corp', span: [2025], before: xomFiler });

splitVector('shopify-2022.json', 'D2',
  "Shopify's 10 for 1 of 2022 (June 2022), in one period only: FY2021's EPS 22.90 (40-F, 2022-02-16), then 2.29 (40-F, 2023-02-16), and its shares 127,364,735 then 1,273,647,350. Its EPS and its shares agree: a split, dated by that filing. Checked against Shopify's 40-F for 2022, which restates FY2021 per share for the split. (Shopify files annually, a 40-F, and is not in the S&P 500: the case is the detector's.)",
  trim(facts('0001594805'), EPS_SHARES, '2021-01-01', '2022-12-31'));

splitVector('amd-2018.json', 'D2',
  "AMD's 2017 quarters restated in 2018 for ASC 606 (Q1 EPS -0.08, then -0.04): cents too few to tell a ratio, and the shares refiled beside them no split's inverse. No split. AMD has not split since 2000.",
  trim(facts('0000002488'), EPS_SHARES, '2016-06-01', '2018-12-31'));

splitVector('copart-2022-2023.json', 'D2',
  "Copart's 2 for 1 of 2022 (November) and of 2023 (August): FY2022's EPS 4.52 (10-K, 2022-09-27), then 1.13 (10-K, 2023-09-28), both splits at once, which is no 4 for 1 of its own; the first quarter of FY2023, 0.51 as filed after the first split (2022-11-18), then 0.25 (2023-11-21), the second. Two splits of 2 for 1, the second dated by the 10-K of 2023-09-28, the first filing made after both. Checked against Copart's 10-K for FY2023, which restates per share for both.",
  trim(facts('0000900075'), EPS_SHARES, '2020-08-01', '2023-07-31'));

splitVector('keurig-dr-pepper-2018.json', 'D2',
  "Keurig Dr Pepper's EPS for 2017, refiled after the merger of 2018 as Maple's (Keurig's) history: the nine months 3.09, then 0.29, and its shares 183.5 million, then 790.5 million, up and not down. A merger's history put in the company's place, no split: the shares say so.",
  trim(facts('0001418135'), EPS_SHARES, '2016-10-01', '2018-12-31'));

splitVector('amazon-2013.json', 'D2',
  "Amazon's 10-K for 2012 files 2012's quarters under 2011's dates (DECISIONS 12): 2011 Q1's basic EPS 0.44, then 0.29, near 3 for 2, in two periods; its shares refiled beside them unmoved (453 million against 451). No split.",
  trim(facts('0001018724'), EPS_SHARES, '2011-01-01', '2012-12-31'));

splitVector('cf-industries-2015.json', 'D2',
  "CF Industries' 5 for 1 of 2015 (June): restated from the 10-Q of 2015-08-06; an 8-K of 2015-12-16 refiles the old values of 2013 and 2014, and the 10-K of 2016-02-25 restates them again. One split, dated 2015-08-06: what a restatement restates is dated by its first filing, not by the 8-K.",
  trim(facts('0001324404'), EPS_SHARES, '2013-01-01', '2015-12-31'));

splitVector('texas-pacific-land-2024-2025.json', 'D2',
  "Texas Pacific Land's 3 for 1 of 2024 (March) and of 2025 (December): FY2023's EPS 52.77, then 17.59 (2025-02-19), then 5.86 (2026-02-18), restated by both. Two splits, the second its own (its first filing more than a year after the first's).",
  trim(facts('0001811074'), EPS_SHARES, '2022-01-01', '2025-12-31'));

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
const sic = require('../sic');

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

// each vector's company's SIC code, as the FSDS cached give it (sic.js), its
// title and its sector (SIC division); the foreign filer, none
const SIC = { AAPL: '3571', MS: '6211', AMZN: '5961', FF: '', AMD: '3674', BAC: '6021', XOM: '2911', GOOGL: '7370', F: '3711', EQIX: '6798', MET: '6311', ED: '4931', ERIE: '6411', ARES: '6282', CCI: '6798', BKNG: '4700', MTB: '6021', TECH: '2836', CPT: '6798', FIX: '1700', PFE: '2834', MSI: '3663' };
const titles = sic.titles();
function vector(file, rule, about, input) {
  const code = SIC[input.ticker];
  Object.assign(input, { sic: code, industry: code ? titles.get(code) : '', sector: code ? sic.division(code).name : 'Nonclassifiable Establishments' });
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

// A line's tag changed partway through a year (10-20, DECISIONS 31): the
// year is taken from the tag that files it whole.
vector('alphabet-fy2025-revenue.json', 'V2',
  "Alphabet's FY2025 revenue: its ASC 606 tag (RevenueFromContractWithCustomerExcludingAssessedTax) files FY2024 whole and FY2025's first quarter only (90,234, 10-Q of 2025-04-25), then stops; `Revenues` files FY2025's quarters and the year, 402,836 (10-K of 2026-02-05). The year and its four quarters are taken from `Revenues` (90,234, 96,428, 102,346, 113,829), and a Change says the move from FY2025. Checked against Alphabet's 10-K for 2025. Before the mend the year and its last three quarters were blank.",
  { facts: trim(facts('0001652044'), ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues'], '2024-01-01', '2025-12-31'),
    fsdsRows: [], exchange: 'Nasdaq', ticker: 'GOOGL', name: 'Alphabet Inc.', span: [2024, 2025] });

vector('ford-fy2025-net-income.json', 'V2',
  "Ford's FY2025 net income: `NetIncomeLoss` files FY2024 whole and FY2025's first two quarters (471 and -36, its 10-Qs), then stops; `ProfitLoss` files the year, -8,162 (10-K of 2026-02-11), and its running totals (444 for six months, 2,892 for nine), so its quarters are 473, -29, 2,448 and -11,054. The year and its quarters are taken from `ProfitLoss`. Checked against Ford's 10-K for 2025 (net income, including noncontrolling interests, -8,162). Before the mend the year was blank.",
  { facts: trim(facts('0000037996'), ['RevenueFromContractWithCustomerExcludingAssessedTax', 'NetIncomeLoss', 'ProfitLoss'], '2024-01-01', '2025-12-31'),
    fsdsRows: [], exchange: 'NYSE', ticker: 'F', name: 'FORD MOTOR CO', span: [2024, 2025] });

vector('equinix-fy2011-capex.json', 'V2',
  "Equinix's capex, FY2011: `PaymentsToAcquirePropertyPlantAndEquipment` files 495,515 for its first nine months (refiled in the 10-Qs of 2012) and no year; `PaymentsToAcquireProductiveAssets` files the year, 28,066 (10-K of 2013-02-26), less than nine months of the other. Not one line moved but another line: the year is not taken from it, and FY2011's capex stays blank, its quarters the first tag's (175,115, 188,875, 131,525). (FY2010's -14,861 under the first tag is as filed, and as small: Equinix's capex tags are muddled, and the book says no more than they do.)",
  { facts: trim(facts('0001101239'), ['Revenues', 'SalesRevenueNet', 'PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'], '2010-01-01', '2011-12-31'),
    fsdsRows: [], exchange: 'Nasdaq', ticker: 'EQIX', name: 'EQUINIX INC', span: [2010, 2011] });

// The mend (DECISIONS 34-36, 10-27): the four faults a break hunt found in
// the importer's own pages, and one more of the same kind.
const REV = ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax'];
vector('metlife-revenue-sliver.json', 'D5',
  "MetLife's revenue: `Revenues` files 62,308 for FY2017 and 67,941 for FY2018 (total revenues, its 10-Ks); the ASC 606 tag, `RevenueFromContractWithCustomerExcludingAssessedTax`, files FY2018 as 1,256, a sliver of it (contract revenue only), and from then on. The cascade used to move to the new tag and the line fell to 1,256. Now the new tag's figure, under half the old in the boundary year filed under both, is not taken: the line stays on `Revenues` (FY2018 67,941; FY2019 69,620), and a Change, `Revenue tag kept`, says it with both figures. Checked against MetLife's 10-K for 2018 (total revenues 67,941).",
  { facts: trim(facts('0001099219'), [...REV, 'NetIncomeLoss'], '2016-01-01', '2019-12-31'),
    fsdsRows: [], exchange: 'NYSE', ticker: 'MET', name: 'METLIFE INC', span: [2016, 2017, 2018, 2019] });

const conEd = trim(facts('0001047862'), ['Revenues', 'NetIncomeLoss', 'ProfitLoss'], '2020-01-01', '2022-12-31');
vector('con-edison-proxy-scale.json', 'D8',
  "Con Edison's net income for 2021: its 10-K files 1,346,000,000 (and again in the 10-Ks of 2023 and 2024); its proxy statement (DEF 14A, 2026-04-08) files the same year as 1,346,000, a thousandth. As the latest filed the proxy won, and the card read 1.346 beside FY2020's 1,101. A proxy statement is not read where a 10-K gives the period: FY2021 is 1,346, FY2022 1,660. Checked against Con Edison's 10-K for 2021 (net income for common stock 1,346).",
  { facts: conEd, fsdsRows: [], exchange: 'NYSE', ticker: 'ED', name: 'CONSOLIDATED EDISON INC', span: [2020, 2021, 2022] });

vector('erie-fy2013-restated.json', 'B10',
  "Erie Indemnity's revenue for FY2013: 6,271 in the 10-K of 2014-02-27, 1,297.331 in that of 2016-02-25 (the Erie Insurance Exchange no longer in its books); FY2014 likewise, 6,124 then 1,407.119. The card takes the latest, and the page's `Annual figures, filed` table says which filing gave each figure (form, filed, accession), flags the restated ones, and keeps the first value, form, date and accession beside them: FY2012 (5,512, never restated) and FY2013 stand on two bases. Net income is not restated. Checked against companyfacts' own rows.",
  { facts: trim(facts('0000922621'), ['Revenues', 'NetIncomeLoss'], '2012-01-01', '2014-12-31'),
    fsdsRows: [], exchange: 'Nasdaq', ticker: 'ERIE', name: 'ERIE INDEMNITY CO', span: [2012, 2013, 2014] });

vector('ares-net-income-tags.json', 'D5',
  "Ares Management's net income: `ProfitLoss` (all the income, with the funds it consolidates) to FY2013 where `NetIncomeLoss` (the part for Ares) is not filed, 545.662 for FY2014; `NetIncomeLoss` files FY2014 as 34.988. The line is the parent's where it is filed, so FY2014 is 34.988, and the Change says the move: both figures, and that they differ by more than half (a stop, said). The seam FY2013 to FY2014 is the book's, named, and not mended: no figure fills FY2012-13 for the parent's. Checked against Ares' 10-K for 2014 (net income 545.7, attributable to Ares 35.0).",
  { facts: trim(facts('0001176948'), [...REV, 'NetIncomeLoss', 'ProfitLoss'], '2012-01-01', '2015-12-31'),
    fsdsRows: [], exchange: 'NYSE', ticker: 'ARES', name: 'Ares Management Corp', span: [2012, 2013, 2014, 2015] });

const cci = facts('0001051470');
vector('crown-castle-revenue-sliver.json', 'D5',
  "Crown Castle's revenue: `SalesRevenueNet` to FY2017 (4,355.605); the ASC 606 tag files FY2017 as 521 (contract revenue only, a sliver) and FY2018 on as less than the total, which is under `Revenues` (5,423 in the 10-K of 2019-02-25, 5,370 as the 10-K of 2021 restates it). FY2017 stays on `SalesRevenueNet`, and a Change, `Revenue tag kept`, says the sliver; from FY2018 the old tag is not filed, and the line is held against the other tags of the cascade: a figure under half another tag's whole year is a sliver of it, so the line takes `Revenues`, and the move is a Change (Crosswalk none). Before, the line fell to 215 million by FY2025. Checked against Crown Castle's 10-K for 2018 (revenues 5,423).",
  { facts: trim(cci, [...REV, 'SalesRevenueNet'], '2016-01-01', '2019-12-31'),
    fsdsRows: [], exchange: 'NYSE', ticker: 'CCI', name: 'CROWN CASTLE INC', span: [2016, 2017, 2018, 2019] });

vector('m-and-t-revenue-sliver-blank.json', 'D6',
  "M&T Bank's revenue: `Revenues` files FY2022 as 8,179 and FY2023 as 9,643; the ASC 606 tag files FY2023 as 1,484 and FY2024 and FY2025 as 1,657 and so on, and no total after FY2023 under any tag the book reads. The line stays on `Revenues` in FY2023 and a Change says the sliver; FY2024 and FY2025 are blank (the new tag's sliver is not the revenue, and nothing is filled across, D6); net income, filed whole, is written. Checked against M&T's 10-K for 2023 (total revenue 9,643).",
  { facts: trim(facts('0000036270'), [...REV, 'NetIncomeLoss'], '2021-01-01', '2025-12-31'),
    fsdsRows: [], exchange: 'NYSE', ticker: 'MTB', name: 'M&T BANK CORP', span: [2022, 2023, 2024, 2025] });

vector('booking-proxy-only.json', 'D8',
  "Booking Holdings' net income for 2021 and 2022: no 10-K files it under `NetIncomeLoss` or `ProfitLoss`; its proxy statements (PRE 14A 2026-04-10, DEF 14A 2026-04-21) do, 1,165 and 3,058, in the scale of dollars. A proxy's row is read only where no other filing gives the period, so these two are written, and the page's `Annual figures, filed` table says DEF 14A is the filing that gave them. Before the mend (all proxies skipped) they were blank.",
  { facts: trim(facts('0001075531'), ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'NetIncomeLoss'], '2021-01-01', '2022-12-31'),
    fsdsRows: [], exchange: 'Nasdaq', ticker: 'BKNG', name: 'Booking Holdings Inc.', span: [2021, 2022] });

vector('bio-techne-fy2013-unit-slip.json', 'D8',
  "Bio-Techne's operating income for the year ended 2013-06-30: 158,469,000 in its 10-Ks of 2013 and 2014; 158,469 in that of 2015-08-31, a thousandth (the 10-K gives its figures in thousands there, and the facts carry the scale lost). A row a thousandth or a millionth of another row's for the same period is a unit slip and is not read: FY2013 is 158.469, not 0.158469.",
  { facts: trim(facts('0000842023'), ['Revenues', 'SalesRevenueNet', 'OperatingIncomeLoss'], '2012-07-01', '2013-06-30'),
    fsdsRows: [], exchange: 'Nasdaq', ticker: 'TECH', name: 'BIO-TECHNE Corp', span: [2013] });

// The third mend (DECISIONS 46-49, 10-30): a quarter filed as a year, a
// revenue that is a part under one tag, a gap said, a restatement said.
vector('comfort-fy2025-quarter-as-year.json', 'V2',
  "Comfort Systems' FY2025: its 10-K of 2026-02-19 files revenue 9,101.641 for 2025-01-01 to 2025-12-31 (gross profit, operating income likewise); its 10-Q of 2026-04-23 files the first quarter, 1,831.286, once for 2025-01-01 to 2025-03-31 and once for 2025-01-01 to 2025-12-31 (a context spanning the year: gross profit 403.416 and operating income 209.098 likewise). A 10-Q's row of a year whose value is a shorter period's of the same filing from the same first day is that period's, and is not read: the year stays the 10-K's 9,101.6 (it was 1,831.3, its Q4 -4,624). Checked against Comfort Systems' 10-K for 2025.",
  { facts: trim(facts('0001035983'), ['Revenues', 'GrossProfit', 'OperatingIncomeLoss', 'NetIncomeLoss'], '2024-01-01', '2026-06-30'),
    fsdsRows: [], exchange: 'NYSE', ticker: 'FIX', name: 'COMFORT SYSTEMS USA INC', span: [2024, 2025] });

vector('camden-fy2017-revenue-part.json', 'D5',
  "Camden Property Trust's revenue: `RevenueFromContractWithCustomerExcludingAssessedTax` is its only revenue tag. Its 10-K of 2019-02-15 files FY2016 876.447, FY2017 900.896, FY2018 954.505; its 10-Ks of 2020 and 2021 file the same periods again as 8.176 and 7.231, and later years 8.7, 10.8, 10.5 (a part: net income is 196 to 654). No other tag, no earlier filing, so the cascade's sliver rule saw none (net margin 2,623% to 13,129%). A revenue under a tenth of the year's net income is a part: FY2017 and FY2018 take the figure first filed (the quarters of FY2018 do not sum to it: blank), FY2019 on are blank, and two Changes, `Revenue part`, say so. Checked against Camden's 10-K for 2018 (total revenues 900.9).",
  { facts: trim(facts('0000906345'), ['RevenueFromContractWithCustomerExcludingAssessedTax', 'NetIncomeLoss'], '2016-01-01', '2021-12-31'),
    fsdsRows: [], exchange: 'NYSE', ticker: 'CPT', name: 'CAMDEN PROPERTY TRUST', span: [2016, 2017, 2018, 2019, 2020, 2021] });

vector('pfizer-fy2014-revenue-gap.json', 'D6',
  "Pfizer's revenue: 51,584 for FY2013 and 52,824 for FY2016 in the facts, and none for FY2014 and FY2015 under any tag the book reads (FY2014: only quarters of 3 and 6 months). A line with no figure for years inside its run is a Change, `Revenue gap`, saying what the filings give; nothing is filled across. The 10-Ks of 2015 and 2016 file the years as 49,605 and 48,851 under `SalesRevenueGoodsNet`, a tag outside the cascade: not read, said in the Change's words as what the filings do not give under the tags read.",
  { facts: trim(facts('0000078003'), ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'NetIncomeLoss'], '2012-01-01', '2017-12-31'),
    fsdsRows: [], exchange: 'NYSE', ticker: 'PFE', name: 'PFIZER INC', span: [2012, 2013, 2014, 2015, 2016, 2017] });

vector('motorola-fy2008-restated.json', 'B10',
  "Motorola Solutions' revenue: FY2007 36,622 (8-K of 2010-05-05) beside FY2008 8,140 (8-K of 2011-05-12), FY2009 6,947 and FY2010 7,617: the 10-Ks of 2010 filed FY2008 as 30,146 and FY2009 as 22,044, and a later 8-K and the 10-Ks of 2012 and 2013 restate them (the cause is not in the data). Each year restated to under half of its first filing is a flag; a run of them is a Change, `Revenue restatement`, with both figures and both filings of each year, and the seam at FY2008. The card takes the last filed. Which basis is the revenue is not decided.",
  { facts: trim(facts('0000068505'), ['Revenues', 'NetIncomeLoss'], '2006-12-31', '2011-12-31'),
    fsdsRows: [], exchange: 'NYSE', ticker: 'MSI', name: 'Motorola Solutions, Inc.', span: [2007, 2008, 2009, 2010, 2011] });

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

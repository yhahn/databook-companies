// The README, the importer's (SPEC B6): what the book holds and its span,
// how it is keyed, queries that run (target.js plays each), its sources
// and their terms, how to make it again, and the changes (D5). Written
// for a stranger: no path of the maker's machine is in it.

const fs = require('fs');
const path = require('path');
const { link, safe } = require('./import');
const reading = require('../reading');

const REPO = path.resolve(__dirname, '../..');

// The front page's reading (SPEC R2-R5): what the data points to, then
// each question of reading.md answered, its picture after it. Returns
// the lines and the values kept for reading.json.
function front({ R, book, rel, rows, sectors }) {
  const v = R.front, P = R.pictures, Y = R.Y, B = R.B, page = 'README.md';
  const recs = reading.ofPage(page), by = Object.fromEntries(recs.map((r) => [r.id, r]));
  const name = (t) => { const c = book.byTicker.get(t); return `[${c.name}](${rel(page, c.path)})`; };
  const sector = (s) => `[${s}](${rel(page, `companies/${safe(s)}.md`)})`;
  const words = {};
  for (const k of ['rev_top', 'ni_top', 'bb_top']) words[k] = name(v[k]);
  words.losers = v.losers === 0 ? 'none' : v.losers.toLocaleString('en-US');
  for (const k of ['rev_next', 'ni_next']) words[k] = reading.listed(v[k].map(name));
  for (const k of ['big_sector', 'best', 'worst']) words[k] = sector(v[k]);
  const say = (id) => reading.answer(by[id], v, words);
  const q = (id) => `**${by[id].Ask}** ${say(id)}`;
  const years = P.years.map((y) => `FY${y}`);
  const bn = (x) => String(Math.round(x / 100) / 10);
  // a year, by example: four companies' FY{Y}, and the companies without one
  const end = (t) => { const r = rows.find((x) => x.ticker === t); return r && r.years.get(Y) ? r.years.get(Y).end : null; };
  const examples = [['AAPL', 'Apple'], ['MSFT', 'Microsoft'], ['WMT', 'Walmart'], ['GOOGL', 'Alphabet']].filter(([t]) => end(t)).map(([t, n]) => `${n}'s to ${end(t)}`);
  const missing = rows.filter((r) => !(r.years.get(Y)?.rev != null && r.years.get(Y)?.ni != null)).map((r) => r.ticker).sort();
  const L = [
    '## What the data points to', '',
    recs.filter((r) => r.kind === 'Finding').map((r) => say(r.id)).join(' '), '',
    `A year here is each company's own fiscal year, as it names it: FY${Y} is ${reading.listed(examples)}. FY${Y} is the latest year that nearly all the companies have closed and filed (of every 100 with a revenue in FY${Y - 1}, at least 95 have one in FY${Y}), and ten years run from FY${B}. Of the ${rows.length} companies, ${missing.length === 0 ? 'every one has' : `${missing.length} have no revenue or no net income for FY${Y} in the book, and are left out of its totals: ${missing.map(name).join(', ')}`}${missing.length ? '' : ' a revenue and a net income for it'}. Dollars are as filed, not made real; a company's figure is its annual card's, or where the card has none, its four quarters summed. The questions and findings, and how each is reckoned, are kept in \`.import/reading.md\`; their numbers are worked out from the book's own figures at every release.`, '',
    '## What they sell and keep', '',
    q('front-size'), '',
    '## Growth', '',
    q('front-growth'), '',
    `The rise since FY${B}, each year, in percent, of the ${v.n_same} companies with a revenue and a net income in every year: their revenue summed, and their net income.`, '',
    `> [!CARD:line] Rise since FY${B}, the same ${v.n_same} companies`,
    table(['Rise, %', ...years], [['Revenue', ...P.growth.rev.map(String)], ['Net income', ...P.growth.ni.map(String)]], '> '),
    '> - Unit: percent', '',
    '## The largest', '',
    q('front-leaders'), '',
    '## The sectors', '',
    q('front-sectors'), '',
    `Each sector's share, in FY${Y}, of the companies' revenue, of their net income, and of the companies themselves (those with both for the year). A sector is the division of the Standard Industrial Classification that the SEC's code for a company falls in.`, '',
    '> [!CARD:bars] The sectors, FY' + Y,
    table(['', ...sectors.map((d) => d.name)], [
      ['Revenue', ...sectors.map((d) => bn(R.sectors[d.name].rev))],
      ['Net income', ...sectors.map((d) => bn(Math.max(0, R.sectors[d.name].ni)))],
      ['Companies', ...sectors.map((d) => String(R.sectors[d.name].n))]], '> '),
    '> - Bars: parts', '',
    '### Each sector', '',
    `Each sector, its page linked: its companies with a revenue and a net income for FY${Y}, their revenue and net income in billions, the share of revenue kept as net income, and the rise in revenue since FY${B} of its companies with every year, in percent.`, '',
    table(['Sector', 'Companies', 'Revenue', 'Net income', 'Kept', 'Rise'], sectors.map((d) => { const s = R.sectors[d.name]; return [sector(d.name), String(s.n), bn(s.rev), bn(s.ni), s.margin === null ? '' : String(s.margin), s.rise === null ? '' : String(s.rise)]; })), '',
    '## Cash', '',
    q('front-cash'), '',
    `What the ${P.cash_n} companies with an operating cash flow in every year from FY${B} brought in from their operations, and what they paid out for plant and equipment and to buy back their own shares, each year, in billions.`, '',
    '> [!CARD:line] Cash in and out, $ billions',
    table(['$ billions', ...years], [['Operating cash flow', ...P.cash.ocf.map(String)], ['Capex', ...P.cash.capex.map(String)], ['Buybacks', ...P.cash.bb.map(String)]], '> '),
    '> - Unit: $ billions', '',
  ];
  return { lines: L, kept: Object.fromEntries(recs.map((r) => [r.id, reading.kept(v, r)])) };
}

const row = (cells) => `| ${cells.join(' | ')} |`;
const table = (heads, rows, quote = '') => [row(heads), row(heads.map(() => '---')), ...rows.map(row)].map((l) => quote + l).join('\n');

function write({ counts: c, skipped, sectors, done, R, book, rel, rows }) {
  const fr = front({ R, book, rel, rows, sectors });
  const where = (d) => link(d.path);
  const kinds = new Map();
  for (const d of done) {
    for (const [k, label] of [['tagChanges', 'A line item filed under another tag'], ['yearChanges', 'A fiscal year that moved'], ['segmentChanges', 'Segment, product or geography members changed'], ['splits', 'Shares split (or joined)']]) {
      if (!d.counts[k]) continue;
      if (!kinds.has(label)) kinds.set(label, { n: 0, who: [] });
      kinds.get(label).n += d.counts[k];
      kinds.get(label).who.push(`[${d.ticker}](${where(d)})`);
    }
  }
  const moved = done.filter((d) => d.before);
  if (moved.length) kinds.set('A company filing under a new CIK', { n: moved.length, who: moved.map((d) => `[${d.ticker}](${where(d)})`) });
  const faqN = (fs.readFileSync(path.join(REPO, '.import/faq.md'), 'utf8').match(/^### Question: /gm) || []).length;
  const [first, last] = c.span.split(' to ');
  const text = `# The S&P 500 in its SEC filings, ${first} to ${last}

The companies of the S&P 500, as the index stood on ${c.members_as_of}, as
they report to the US Securities and Exchange Commission: what each
sold, earned, made in cash, spent on plant and bought back of its own
shares, a fiscal year and a quarter at a time, ${first} on; its earnings
a share, as filed and as a share is now, across its splits; and its
revenue by segment, product and geography where it files them. ${c.companies}
of the index's ${c.members} companies are here; the ${c.skipped} it cannot read are
listed below, each with its reason. Read it as a book, a sector a page
and a company a page; or gather it with
[proper.md](https://github.com/proper-md/proper.md) and ask it in SQL.

It is a *databook*: a repo of data only, written whole by its importer
(\`.import/\`) from its sources, never edited by hand, and made again,
the same, by running the importer again. It holds no prices.

[Questions and answers](./FAQ.md): ${faqN} questions a reader of this book can answer, from one company's revenue in one year to what a split did to its earnings a share, each with its answer and the page to look in.

${fr.lines.join('\n')}
## The S&P 500, as of ${c.members_as_of}

The members are the stocks SPDR's S&P 500 ETF Trust (SPY) held on
${c.members_as_of}, by its daily holdings file: ${c.stocks_held} stocks of ${c.members}
companies (some have two classes in the index: ${c.classes}). A fund
that follows the index holds its members; their names and tickers are
facts, and nothing else of the file is kept (not its weights, holdings
or security codes). Each ticker is matched to its filer by the SEC's
list of tickers (\`.import/members.json\`, written by
\`.import/members.js\`). A company that leaves the index leaves the book
at the next release; one that joins it comes in.

## Its sources and their terms

The book's data is all public domain, works of the US government:

- **SEC EDGAR companyfacts** (\`data.sec.gov/api/xbrl/companyfacts\`):
  each company's XBRL facts from its 10-K and 10-Q filings, fetched
  ${c.facts_fetched}, as the SEC's fair-access rules ask (a named User-Agent,
  fewer than ten requests a second).
- **The SEC's list of tickers and exchanges**
  (\`sec.gov/files/company_tickers_exchange.json\`): each company's
  name, ticker and exchange, as of ${c.members_as_of}.
- **SEC Financial Statement Data Sets** (DERA, quarterly): revenue by
  segment, product and geography, ${c.fsds_quarters}; and each
  company's industry, the Standard Industrial Classification (SIC) code
  the SEC gives it, from its latest filing there.
- **The SEC's list of SIC codes**
  (\`sec.gov/search-filings/standard-industrial-classification-sic-code-list\`):
  each code's title. A code's division, the book's sector, is the SIC
  Manual's (1987, the Department of Labor's): major groups 01 to 09
  Agriculture, 10 to 14 Mining, 15 to 17 Construction, 20 to 39
  Manufacturing, 40 to 49 Transportation, Communications, Electric,
  Gas, and Sanitary Services, 50 and 51 Wholesale Trade, 52 to 59 Retail
  Trade, 60 to 67 Finance, Insurance, and Real Estate, 70 to 89 Services.

The members' list is read from SPY's daily holdings file, published by
State Street (\`ssga.com\`): the index's members only, as above.

## Licence

This book, its pages and its importer, is given to the public domain
under CC0 1.0 ([LICENSE](LICENSE)): copy it, change it and use it as you
like, without asking. Its sources are free of copyright too, as above;
citing them is still the courteous thing.

## Making it again

\`\`\`sh
node .import/members.js --fetch       # SPY's holdings and the SEC's tickers: the members
node .import/companies/fetch.js       # each member's companyfacts, from data.sec.gov
node .import/companies/sic.js --fetch # the SEC's list of SIC codes and their titles
sh .import/build.sh                   # every page, the README and FAQ.md; the tests; what proper gathers checked
\`\`\`

The fetch keeps what it has fetched in a local cache and, stopped part
way, goes on where it stopped; the SEC asks a contact in each request's
User-Agent, taken from \`SEC_USER_AGENT\` or the fetcher's own git
address. The Financial Statement Data Sets are the SEC's quarterly
files (\`sec.gov/dera/data/financial-statement-data-sets\`), unpacked
into the same cache. FAQ.md's answers are worked out again from the
sources at every release, never copied from the pages.

## How it is laid out

- \`companies/<Sector>.md\`: a sector (\`Sector\`), the division of the
  Standard Industrial Classification its companies' SEC codes fall in
  (${sectors.map((d) => d.name).join('; ')}): the questions a reader asks
  of it, answered; its growth (\`Sector_Growth\`) and its companies side by
  side (\`Sector_Compared\`, a company a row by its ticker, its net income
  over its revenue a year a column); and its companies listed and linked
  (\`Sector_Companies\`).
- \`companies/<Sector>/<Company>.md\`: a company. Its record (\`Company\`),
  keyed by its CIK, with its exchange, its SIC code and the SEC's title
  for it (\`Industry\`), and its sector; the questions a reader asks of it,
  answered; its years as a card (\`Company_Annual\`, a line item a
  row, a year a column, $ millions) and EPS by year (\`Company_EPS_by_year\`);
  its quarters (\`Company_Quarterly\`, a quarter a row); its segments
  (\`Company_Segments\`); the tags each line item was read from
  (\`Company_Tags\`); and its changes (\`Change\`).

A table is joined to its record by the file it is in: \`join … using (_file)\`.

## Keys

- **CIK**, the SEC's key for a filer, written as the SEC writes it, ten
  digits with their leading zeros (\`0000320193\`). proper gathers it as a
  number today (320193); every page writes it the same way. A company
  whose ticker the SEC now gives to a new filer (a holding company put
  over it) is keyed by the new CIK, with the old as **CIK before**, and
  each filing read from the CIK that filed it.
- **Ticker**, the SEC's list of tickers as it stands (the first it lists
  for a company, of those in the index).
- **Fiscal year**, as the company names it: \`FY2025\` is the year its
  10-K calls 2025, whatever month it ends (Apple's ends in September;
  Home Depot's FY2025 ended 2026-02-01). A quarter is \`FY2025 Q1\`, with
  the day it **Ended**.

## Queries

Apple's last eight quarters, $ millions:

\`\`\`sql
select q.Quarter, q.Ended, q.Revenue, q."Net income", q."EPS diluted", q.Buybacks
from Company_Quarterly q join Company c using (_file)
where c.Ticker = 'AAPL' order by q.Ended desc limit 8
\`\`\`

Earnings a share across splits: NVIDIA's EPS as filed and as a share
is now, by fiscal year.

\`\`\`sql
select e."Fiscal year", e.Ended, e."EPS diluted", e."EPS adjusted"
from Company_EPS_by_year e join Company c using (_file)
where c.Ticker = 'NVDA' order by e.Ended desc limit 12
\`\`\`

Who bought back the most of their own shares in their last full year,
$ millions:

\`\`\`sql
select c.Ticker, c.CIK, sum(q.Buybacks) as Buybacks, sum(q."Net income") as "Net income"
from Company_Quarterly q join Company c using (_file)
where q."Fiscal year" = (select max(q2."Fiscal year") from Company_Quarterly q2 where q2._file = q._file and q2."Fiscal quarter" = 4)
group by all having count(*) = 4 order by Buybacks limit 10
\`\`\`

Apple's revenue by product, its last four quarters:

\`\`\`sql
select s.Quarter, s.Member, s.Revenue
from Company_Segments s join Company c using (_file)
where c.Ticker = 'AAPL' and s.Axis = 'Product'
  and s.Quarter in (select Quarter from Company_Segments s2 where s2._file = s._file order by Quarter desc limit 4)
order by s.Quarter desc, s.Revenue desc
\`\`\`

The splits, newest first:

\`\`\`sql
select c.Ticker, ch.Now, ch.Crosswalk from Change ch join Company c using (_file)
where ch.What = 'Shares split' order by ch.Boundary desc
\`\`\`

The sectors, and each one's companies with a revenue in its annual
card for FY${R.Y}, their revenue summed, $ millions:

\`\`\`sql
select c.Sector, count(*) as Companies, sum(a."FY${R.Y}") as Revenue
from Company c join Company_Annual a using (_file)
where a."Line item" = 'Revenue' and a."FY${R.Y}" is not null
group by c.Sector order by Revenue desc
\`\`\`

A sector's companies side by side: Manufacturing's ten largest by
revenue in FY${R.Y}, each one's net income over its revenue that year:

\`\`\`sql
select Ticker, "FY${R.Y}" as Kept, Revenue as "Revenue, $ billions" from Sector_Compared
where _file = 'companies/Manufacturing.md' order by Revenue desc nulls last limit 10
\`\`\`

The changes, by what changed:

\`\`\`sql
select What, count(*) as Changes from Change group by What order by Changes desc
\`\`\`

## Counts

| | Written |
|---|---|
| Members of the S&P 500 | ${c.members} |
| Companies written | ${c.companies} |
| Sectors | ${c.sectors} |
| Listed, not read | ${c.skipped} |
| Fiscal years | ${c.annual} |
| Quarters | ${c.quarters} |
| Segment rows | ${c.segments} |
| Changes | ${c.changes} |

## Changes

A change in what a value means or names (SPEC D5) is a \`Change\` record
on its company's page, last: Was, Now, Boundary, Crosswalk, Source.

| What | Changes | Companies |
|---|---|---|
${[...kinds].map(([k, v]) => `| ${k} | ${v.n} | ${v.who.join(', ')} |`).join('\n')}

A split is a change of unit, a share. The filings show it where they
restate what they filed before: a period's EPS filed again in a split's
ratio (Apple's FY2012 EPS, 44.15 as first filed, 6.31 after its 7 for
1), and the shares it was earned over filed again in the inverse. A
split is taken where filings agree on it in two periods or more, or in
one period's EPS and its shares both, or in its EPS and the SEC's own
split fact (\`StockholdersEquityNoteStockSplitConversionRatio1\` and its
kin), where the company files one; one period's EPS restated alone is
no split (a new accounting standard restates too). Each is a
\`Change\`, its crosswalk that period both ways and what it rests on, and
**EPS adjusted** stands beside EPS diluted, every split since divided
out (D8: the value as filed, its adjustment beside it).

A line item filed under another tag (ASC 606 moved most revenue to
\`RevenueFromContractWithCustomerExcludingAssessedTax\` in 2018) is said
and not split: the same line item, filed under another name. The
crosswalk is the boundary year under both tags, where both were filed.

## Not read

${c.skipped} of the index's companies file nothing this book can read, each for its reason:

| Company | CIK | Ticker | Why |
|---|---|---|---|
${skipped.map((s) => `| ${s.name} | ${s.cik} | ${s.ticker || ''} | ${s.reason} |`).join('\n')}
`;
  fs.writeFileSync(path.join(REPO, 'README.md'), text);
  return fr.kept;
}

module.exports = { write };
